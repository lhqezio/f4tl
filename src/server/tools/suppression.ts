import { z } from 'zod';
import type { BrowserManager } from '../../core/browser-manager.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const suppressErrorSchema = z.object({
  type: z.enum(['console', 'network']).describe('Error type to suppress'),
  pattern: z.string().describe('Regex pattern to match (console text or network URL)'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class SuppressionTools {
  constructor(private browserManager: BrowserManager) {}

  async suppressError(params: z.infer<typeof suppressErrorSchema>): Promise<ToolResult> {
    try {
      const capture = this.browserManager.getCaptureManager();

      capture.addRuntimeSuppression(params.type, params.pattern);

      const current = capture.getRuntimeSuppressions();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'added',
                type: params.type,
                pattern: params.pattern,
                activeSuppressions: current,
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
