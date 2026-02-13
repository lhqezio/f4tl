import { z } from 'zod';
import type { DatabaseConnector } from '../../core/database-connector.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const querySchema = z.object({
  sql: z.string().describe('SELECT query to execute (read-only)'),
  params: z.array(z.unknown()).optional().describe('Parameterized query values ($1, $2, ...)'),
});

export const schemaSchema = z.object({
  tables: z
    .array(z.string())
    .optional()
    .describe('Specific tables to inspect (defaults to all allowed)'),
});

export const explainSchema = z.object({
  sql: z.string().describe('SELECT query to explain'),
  params: z.array(z.unknown()).optional().describe('Parameterized query values'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class DatabaseTools {
  constructor(private db: DatabaseConnector) {}

  async query(params: z.infer<typeof querySchema>): Promise<ToolResult> {
    try {
      const result = await this.db.query(params.sql, params.params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                rowCount: result.rowCount,
                duration: `${result.duration}ms`,
                rows: result.rows,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async schema(params: z.infer<typeof schemaSchema>): Promise<ToolResult> {
    try {
      const info = await this.db.getSchema(params.tables);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async explain(params: z.infer<typeof explainSchema>): Promise<ToolResult> {
    try {
      const result = await this.db.explain(params.sql, params.params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                duration: `${result.duration}ms`,
                plan: result.rows,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
}
