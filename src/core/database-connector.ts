import pg from 'pg';
import type { DatabaseConfig, QueryResult, SchemaInfo, TableInfo } from '../types/index.js';

const DDL_KEYWORDS =
  /\b(CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|INSERT|UPDATE|DELETE|MERGE|UPSERT|COPY|IMPORT)\b/i;

export class DatabaseConnector {
  private pool: pg.Pool | null = null;

  constructor(private config: DatabaseConfig) {}

  async connect(): Promise<void> {
    if (this.pool) return;

    const poolConfig: pg.PoolConfig = {
      max: this.config.maxConnections,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };

    if (this.config.connectionString) {
      poolConfig.connectionString = this.config.connectionString;
    } else {
      poolConfig.host = this.config.host;
      poolConfig.port = this.config.port;
      poolConfig.database = this.config.database;
      poolConfig.user = this.config.user;
      poolConfig.password = this.config.password;
    }

    this.pool = new pg.Pool(poolConfig);

    // Verify connectivity
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.validateQuery(sql);

    const pool = this.getPool();
    const start = Date.now();

    const client = await pool.connect();
    try {
      // Set statement timeout
      await client.query(`SET statement_timeout = ${this.config.queryTimeout}`);

      // Wrap in READ ONLY transaction
      await client.query('BEGIN READ ONLY');

      // Auto-inject LIMIT if not present
      const limitedSql = this.injectLimit(sql);

      const result = await client.query(limitedSql, params);

      await client.query('COMMIT');

      return {
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
        duration: Date.now() - start,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getSchema(tables?: string[]): Promise<SchemaInfo> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN READ ONLY');

      // Get tables
      let tableQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      `;
      const tableParams: string[] = [];

      const targetTables = tables ?? this.config.allowedTables;
      if (targetTables?.length) {
        tableQuery += ` AND table_name = ANY($1)`;
        tableParams.push(targetTables as unknown as string);
      }

      tableQuery += ` ORDER BY table_name`;

      const tablesResult = await client.query(tableQuery, tableParams.length ? [targetTables] : []);
      const tableInfos: TableInfo[] = [];

      for (const row of tablesResult.rows as { table_name: string }[]) {
        const tableName = row.table_name;

        // Get columns
        const colResult = await client.query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [tableName],
        );

        // Get foreign keys
        const fkResult = await client.query(
          `SELECT
             kcu.column_name,
             ccu.table_name AS references_table,
             ccu.column_name AS references_column
           FROM information_schema.table_constraints AS tc
           JOIN information_schema.key_column_usage AS kcu
             ON tc.constraint_name = kcu.constraint_name
           JOIN information_schema.constraint_column_usage AS ccu
             ON ccu.constraint_name = tc.constraint_name
           WHERE tc.constraint_type = 'FOREIGN KEY'
             AND tc.table_schema = 'public'
             AND tc.table_name = $1`,
          [tableName],
        );

        tableInfos.push({
          name: tableName,
          columns: (
            colResult.rows as {
              column_name: string;
              data_type: string;
              is_nullable: string;
              column_default: string | null;
            }[]
          ).map((c) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable === 'YES',
            defaultValue: c.column_default ?? undefined,
          })),
          foreignKeys: (
            fkResult.rows as {
              column_name: string;
              references_table: string;
              references_column: string;
            }[]
          ).map((fk) => ({
            column: fk.column_name,
            referencesTable: fk.references_table,
            referencesColumn: fk.references_column,
          })),
        });
      }

      await client.query('COMMIT');
      return { tables: tableInfos };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async explain(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.validateQuery(sql);
    return this.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`, params);
  }

  private validateQuery(sql: string): void {
    // Layer 1: Block DDL/DML keywords
    if (DDL_KEYWORDS.test(sql)) {
      throw new Error('Query contains prohibited keywords. Only SELECT queries are allowed.');
    }

    // Layer 2: Table allowlist validation
    if (this.config.allowedTables?.length) {
      const fromMatches = sql.match(/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi);
      const joinMatches = sql.match(/\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi);
      const allTableRefs = [...(fromMatches ?? []), ...(joinMatches ?? [])].map((m) =>
        (m.split(/\s+/).pop() ?? '').replace(/^public\./, ''),
      );

      for (const table of allTableRefs) {
        if (!this.config.allowedTables.includes(table)) {
          throw new Error(`Table "${table}" is not in the allowed tables list.`);
        }
      }
    }
  }

  private injectLimit(sql: string): string {
    const normalized = sql.trim().replace(/;\s*$/, '');
    if (/\bLIMIT\b/i.test(normalized)) return normalized;
    return `${normalized} LIMIT 1000`;
  }

  private getPool(): pg.Pool {
    if (!this.pool) throw new Error('Database not connected. Call connect() first.');
    return this.pool;
  }
}
