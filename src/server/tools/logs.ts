import { z } from 'zod';
import type { LogCollector } from '../../core/log-collector.js';
import type { ToolResult, LogLevel } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const tailSchema = z.object({
  source: z.string().describe('Log source name'),
  lines: z.number().default(50).describe('Number of recent lines to return'),
});

export const getLogsSchema = z.object({
  source: z.string().optional().describe('Filter by source name'),
  level: z
    .enum(['debug', 'info', 'warn', 'error', 'fatal'])
    .optional()
    .describe('Minimum log level'),
  since: z.number().optional().describe('Start timestamp (epoch ms)'),
  until: z.number().optional().describe('End timestamp (epoch ms)'),
  limit: z.number().default(200).describe('Max entries to return'),
});

export const searchLogsSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for in log messages'),
  source: z.string().optional().describe('Limit search to this source'),
  caseSensitive: z.boolean().default(false).describe('Case-sensitive search'),
  limit: z.number().default(100).describe('Max results'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class LogTools {
  constructor(private collector: LogCollector) {}

  async tail(params: z.infer<typeof tailSchema>): Promise<ToolResult> {
    try {
      const entries = this.collector.tail(params.source, params.lines);
      const formatted = entries.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        level: e.level,
        source: e.source,
        message: e.message,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { source: params.source, count: formatted.length, entries: formatted },
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

  async getLogs(params: z.infer<typeof getLogsSchema>): Promise<ToolResult> {
    try {
      const entries = this.collector.getLogs({
        source: params.source,
        level: params.level as LogLevel | undefined,
        since: params.since,
        until: params.until,
        limit: params.limit,
      });

      const formatted = entries.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        level: e.level,
        source: e.source,
        message: e.message,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                sources: this.collector.getSourceNames(),
                count: formatted.length,
                entries: formatted,
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

  async searchLogs(params: z.infer<typeof searchLogsSchema>): Promise<ToolResult> {
    try {
      const entries = this.collector.search(params.pattern, {
        source: params.source,
        caseSensitive: params.caseSensitive,
        limit: params.limit,
      });

      const formatted = entries.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        level: e.level,
        source: e.source,
        message: e.message,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { pattern: params.pattern, count: formatted.length, entries: formatted },
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
