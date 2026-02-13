import { z } from 'zod';
import type { JourneyRunner } from '../../core/journey-runner.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const getJourneySchema = z.object({
  name: z.string().describe('Journey name'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class JourneyTools {
  constructor(private runner: JourneyRunner) {}

  async listJourneys(): Promise<ToolResult> {
    try {
      const journeys = this.runner.listJourneys();
      const order = this.runner.getExecutionOrder();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ journeys, suggestedOrder: order }, null, 2),
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

  async getJourney(params: z.infer<typeof getJourneySchema>): Promise<ToolResult> {
    try {
      const journey = this.runner.getJourney(params.name);
      if (!journey) {
        return {
          content: [{ type: 'text', text: `Journey "${params.name}" not found.` }],
          isError: true,
        };
      }
      const state = this.runner.getState(params.name);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ name: params.name, ...journey, state }, null, 2),
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

  async journeyStatus(): Promise<ToolResult> {
    try {
      const status = this.runner.getStatus();
      const summary = {
        total: status.length,
        completed: status.filter((s) => s.status === 'completed').length,
        inProgress: status.filter((s) => s.status === 'in_progress').length,
        pending: status.filter((s) => s.status === 'pending').length,
        failed: status.filter((s) => s.status === 'failed').length,
        journeys: status,
      };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
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
