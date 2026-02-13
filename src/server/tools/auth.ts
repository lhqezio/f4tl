import { z } from 'zod';
import type { BrowserManager } from '../../core/browser-manager.js';
import type { AuthConfig, ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const authLoginSchema = z.object({
  role: z.string().describe('Auth role name from config (e.g. "admin", "buyer")'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class AuthTools {
  constructor(
    private browserManager: BrowserManager,
    private authConfigs: Record<string, AuthConfig>,
  ) {}

  async login(params: z.infer<typeof authLoginSchema>): Promise<ToolResult> {
    try {
      await this.browserManager.executeAuth(params.role, this.authConfigs);
      const page = this.browserManager.getPage();
      const url = page.url();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'authenticated',
                role: params.role,
                strategy: this.authConfigs[params.role]?.strategy,
                context: this.browserManager.getActiveContextId(),
                currentUrl: url,
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
