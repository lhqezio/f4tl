import { z } from 'zod';
import type { WebhookHandler } from '../../core/webhook-handler.js';
import type { BrowserManager } from '../../core/browser-manager.js';
import type { WebhookDiscovery, ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const discoverSchema = z.object({
  refresh: z.boolean().default(false).describe('Force re-discovery, bypassing the cache'),
});

export const fireSchema = z.object({
  url: z.string().describe('Webhook endpoint path or full URL (e.g. "/api/webhooks/stripe")'),
  event: z
    .string()
    .optional()
    .describe('Event type to include in payload (e.g. "payment_intent.succeeded")'),
  payload: z.record(z.unknown()).describe('Webhook payload body (will be JSON-stringified)'),
  signing: z
    .string()
    .optional()
    .describe('Signing provider name (e.g. "stripe", "github"). Uses matching secret from config.'),
  headers: z.record(z.string()).optional().describe('Additional HTTP headers to include'),
  verifyUi: z
    .object({
      selector: z.string().describe('CSS selector to check after webhook fires'),
      expectedText: z.string().describe('Expected text content of the element'),
      timeout: z
        .number()
        .int()
        .min(500)
        .max(30_000)
        .default(5000)
        .describe('Max time (ms) to wait for element'),
    })
    .optional()
    .describe('After firing, verify a UI element updated to show expected text'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class WebhookTools {
  private cachedDiscovery: WebhookDiscovery | null = null;

  constructor(
    private handler: WebhookHandler,
    private browserManager: BrowserManager,
  ) {}

  async discover(params: z.infer<typeof discoverSchema>): Promise<ToolResult> {
    try {
      if (!params.refresh && this.cachedDiscovery) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(this.cachedDiscovery, null, 2),
            },
          ],
        };
      }

      const discovery = await this.handler.discover();
      this.cachedDiscovery = discovery;

      if (discovery.endpoints.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No webhook endpoints discovered in the codebase. This may mean the project does not use webhooks, or the handler patterns are not recognized.',
            },
          ],
        };
      }

      const totalEvents = discovery.endpoints.reduce((sum, ep) => sum + ep.events.length, 0);
      const summary = `Discovered ${discovery.endpoints.length} webhook endpoint(s) with ${totalEvents} event type(s).\n\n`;

      return {
        content: [
          {
            type: 'text',
            text: summary + JSON.stringify(discovery, null, 2),
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

  async fire(params: z.infer<typeof fireSchema>): Promise<ToolResult> {
    try {
      const body = JSON.stringify(params.payload);

      const result = await this.handler.fire({
        url: params.url,
        headers: params.headers,
        body,
        signing: params.signing,
      });

      // Optional UI verification
      if (params.verifyUi && this.browserManager.isLaunched()) {
        try {
          const page = this.browserManager.getPage();
          const el = await page.waitForSelector(params.verifyUi.selector, {
            timeout: params.verifyUi.timeout,
          });

          const actual = (await el?.textContent())?.trim() ?? '';
          const matched = actual.includes(params.verifyUi.expectedText);

          result.uiVerification = {
            matched,
            actual,
            selector: params.verifyUi.selector,
            expected: params.verifyUi.expectedText,
          };
        } catch (err) {
          result.uiVerification = {
            matched: false,
            actual: `Verification failed: ${(err as Error).message}`,
            selector: params.verifyUi.selector,
            expected: params.verifyUi.expectedText,
          };
        }
      }

      const statusEmoji = result.status >= 200 && result.status < 300 ? 'OK' : 'FAILED';
      const uiStatus = result.uiVerification
        ? result.uiVerification.matched
          ? ' | UI: MATCHED'
          : ` | UI: MISMATCH (got "${result.uiVerification.actual?.slice(0, 100)}")`
        : '';

      const summary = `Webhook ${statusEmoji} (${result.status}) in ${result.duration}ms${uiStatus}\n\n`;

      return {
        content: [
          {
            type: 'text',
            text: summary + JSON.stringify(result, null, 2),
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
