import { z } from 'zod';
import type { SessionHistory } from '../../core/session-history.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const getHistorySchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum number of sessions to return'),
  since: z
    .number()
    .optional()
    .describe('Unix timestamp (ms) — only include sessions started after this time'),
  groupBy: z
    .enum(['url', 'actionType', 'context'])
    .optional()
    .describe('Group results by URL coverage, action type usage, or context'),
});

export const getBugsSchema = z.object({
  severity: z
    .enum(['critical', 'major', 'minor', 'cosmetic'])
    .optional()
    .describe('Filter bugs by severity'),
  url: z.string().optional().describe('Filter bugs by URL'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum number of bug entries to return'),
});

export const compareSchema = z.object({
  sessionA: z.string().describe('Session ID of the first session'),
  sessionB: z.string().describe('Session ID of the second session'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class LearningTools {
  constructor(private history: SessionHistory) {}

  async getHistory(params: z.infer<typeof getHistorySchema>): Promise<ToolResult> {
    try {
      const entries = await this.history.getHistory({
        limit: params.limit,
        since: params.since,
      });

      if (entries.length === 0) {
        return {
          content: [{ type: 'text', text: 'No session history found.' }],
        };
      }

      // Apply groupBy aggregation if requested
      if (params.groupBy) {
        const grouped = this.aggregate(entries, params.groupBy);
        return {
          content: [{ type: 'text', text: JSON.stringify(grouped, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async getBugs(params: z.infer<typeof getBugsSchema>): Promise<ToolResult> {
    try {
      const entries = await this.history.getBugLedger({
        severity: params.severity,
        url: params.url,
        limit: params.limit,
      });

      if (entries.length === 0) {
        return {
          content: [{ type: 'text', text: 'No bugs found in session history.' }],
        };
      }

      // Group by fingerprint to show recurrence
      const grouped = new Map<string, { count: number; sessions: string[]; title: string }>();
      for (const entry of entries) {
        const existing = grouped.get(entry.fingerprint);
        if (existing) {
          existing.count++;
          existing.sessions.push(entry.sessionId);
        } else {
          grouped.set(entry.fingerprint, {
            count: 1,
            sessions: [entry.sessionId],
            title: entry.title,
          });
        }
      }

      const result = {
        total: entries.length,
        uniqueBugs: grouped.size,
        bugs: entries,
        recurrence: [...grouped.values()]
          .filter((g) => g.count > 1)
          .sort((a, b) => b.count - a.count),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async compare(params: z.infer<typeof compareSchema>): Promise<ToolResult> {
    try {
      const comparison = await this.history.compare(params.sessionA, params.sessionB);
      return {
        content: [{ type: 'text', text: JSON.stringify(comparison, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  private aggregate(
    entries: Awaited<ReturnType<SessionHistory['getHistory']>>,
    groupBy: 'url' | 'actionType' | 'context',
  ): Record<string, { sessions: number; totalSteps: number; totalBugs: number }> {
    const result: Record<string, { sessions: number; totalSteps: number; totalBugs: number }> = {};

    for (const entry of entries) {
      let keys: string[];
      if (groupBy === 'url') {
        keys = entry.urlsCovered;
      } else if (groupBy === 'actionType') {
        keys = Object.keys(entry.actionTypes);
      } else {
        keys = entry.contexts ?? ['default'];
      }

      for (const key of keys) {
        if (!result[key]) {
          result[key] = { sessions: 0, totalSteps: 0, totalBugs: 0 };
        }
        result[key].sessions++;
        result[key].totalSteps += entry.stepCount;
        result[key].totalBugs += entry.bugCount;
      }
    }

    return result;
  }
}
