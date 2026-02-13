import { z } from 'zod';
import type { BrowserManager } from '../../core/browser-manager.js';
import type { ToolResult } from '../../types/index.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const getRequestsSchema = z.object({
  urlPattern: z.string().optional().describe('Regex to filter URLs'),
  method: z.string().optional().describe('HTTP method filter (GET, POST, etc.)'),
  resourceType: z
    .string()
    .optional()
    .describe('Resource type filter (document, xhr, fetch, image, etc.)'),
  statusMin: z.number().optional().describe('Minimum HTTP status code'),
  statusMax: z.number().optional().describe('Maximum HTTP status code'),
  limit: z.number().default(50).describe('Max results to return'),
});

export const interceptSchema = z.object({
  urlPattern: z.string().describe('Regex pattern to match request URLs'),
  action: z.enum(['block', 'mock', 'delay']).describe('Intercept action'),
  mockResponse: z
    .object({
      status: z.number().default(200),
      headers: z.record(z.string()).optional(),
      body: z.string().optional(),
    })
    .optional()
    .describe('Mock response (required for mock action)'),
  delay: z.number().optional().describe('Delay in ms (for delay action)'),
});

export const getWebSocketsSchema = z.object({
  urlPattern: z.string().optional().describe('Regex to filter WebSocket URLs'),
  limit: z.number().default(50).describe('Max messages to return'),
});

// ── Tool Class ───────────────────────────────────────────────────────────────

export class NetworkTools {
  constructor(private bm: BrowserManager) {}

  async getRequests(params: z.infer<typeof getRequestsSchema>): Promise<ToolResult> {
    try {
      const nc = this.bm.getNetworkCapture();
      const data = nc.getRequests(params);

      const summary = data.requests.map((req) => {
        const resp = data.responses.find((r) => r.requestId === req.id);
        return {
          method: req.method,
          url: req.url,
          resourceType: req.resourceType,
          status: resp?.status ?? '(pending)',
          duration: resp?.timing.duration ?? null,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: summary.length, requests: summary }, null, 2),
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

  async intercept(params: z.infer<typeof interceptSchema>): Promise<ToolResult> {
    try {
      const nc = this.bm.getNetworkCapture();
      const rule = await nc.addInterceptRule(params);
      return {
        content: [
          {
            type: 'text',
            text: `Intercept rule added: ${rule.id} (${rule.action} on ${rule.urlPattern})`,
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

  async clearIntercepts(): Promise<ToolResult> {
    try {
      const nc = this.bm.getNetworkCapture();
      const rules = nc.getInterceptRules();
      await nc.clearInterceptRules();
      return {
        content: [{ type: 'text', text: `Cleared ${rules.length} intercept rule(s).` }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }

  async getWebSockets(params: z.infer<typeof getWebSocketsSchema>): Promise<ToolResult> {
    try {
      const nc = this.bm.getNetworkCapture();
      const msgs = nc.getWebSocketMessages(params.urlPattern, params.limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: msgs.length, messages: msgs }, null, 2),
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
