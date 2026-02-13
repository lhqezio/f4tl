import { createHmac } from 'node:crypto';
import { WebhookHandler } from '../../src/core/webhook-handler.js';
import type { CodeExplorer } from '../../src/core/code-explorer.js';
import type { WebhookConfig } from '../../src/types/index.js';

function createMockCodeExplorer(files: Record<string, string>): CodeExplorer {
  return {
    findFiles: vi.fn().mockImplementation(async () => Object.keys(files)),
    search: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (files[path]) return { content: files[path], path };
      throw new Error('Not found');
    }),
  } as unknown as CodeExplorer;
}

function createConfig(overrides?: Partial<WebhookConfig>): WebhookConfig {
  return {
    baseUrl: 'http://localhost:3000',
    signingSecrets: { stripe: 'whsec_test123', github: 'ghsec_test456' },
    ...overrides,
  };
}

describe('WebhookHandler', () => {
  describe('discover', () => {
    it('finds webhook files by glob + search', async () => {
      const files = {
        'src/webhooks/stripe.ts': `
          app.post('/api/webhooks/stripe', handler);
          switch (event.type) {
            case 'payment_intent.succeeded':
              data.object.amount;
              status = 'paid';
              break;
            case 'payment_intent.failed':
              status = 'failed';
              break;
          }
        `,
      };
      const explorer = createMockCodeExplorer(files);
      const handler = new WebhookHandler(explorer, createConfig());

      const discovery = await handler.discover();
      expect(discovery.endpoints.length).toBeGreaterThan(0);
      expect(discovery.timestamp).toBeGreaterThan(0);
    });

    it('extracts event types from switch statements', async () => {
      const files = {
        'src/webhook.ts': `
          app.post('/webhooks', handler);
          if (event.type === 'checkout.session.completed') {
            processCheckout(event.data.object);
          }
          if (event.type === 'customer.subscription.updated') {
            updateSubscription(event.data.object.id);
          }
        `,
      };
      const explorer = createMockCodeExplorer(files);
      const handler = new WebhookHandler(explorer, createConfig());

      const discovery = await handler.discover();
      const endpoint = discovery.endpoints[0];
      const types = endpoint.events.map((e) => e.type);
      expect(types).toContain('checkout.session.completed');
      expect(types).toContain('customer.subscription.updated');
    });

    it('returns empty for projects without webhooks', async () => {
      const explorer = createMockCodeExplorer({});
      (explorer.findFiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const handler = new WebhookHandler(explorer, createConfig());

      const discovery = await handler.discover();
      expect(discovery.endpoints).toHaveLength(0);
    });

    it('detects Stripe signing', async () => {
      const files = {
        'src/stripe-webhook.ts': `
          const sig = request.headers['stripe-signature'];
          const event = stripe.webhooks.constructEvent(body, sig, secret);
          if (event.type === 'invoice.paid') { }
        `,
      };
      const explorer = createMockCodeExplorer(files);
      const handler = new WebhookHandler(explorer, createConfig());

      const discovery = await handler.discover();
      expect(discovery.endpoints[0].signing).toBe('stripe');
    });

    it('detects GitHub signing', async () => {
      const files = {
        'src/github-hook.ts': `
          const sig = req.headers['x-hub-signature-256'];
          if (event.type === 'push') { }
        `,
      };
      const explorer = createMockCodeExplorer(files);
      const handler = new WebhookHandler(explorer, createConfig());

      const discovery = await handler.discover();
      expect(discovery.endpoints[0].signing).toBe('github');
    });

    it('extracts required fields from nearby code', async () => {
      const files = {
        'src/hook.ts': `
          case 'order.completed':
            const amount = event.data.object.amount;
            const email = event.data.object.customer_email;
            break;
        `,
      };
      const explorer = createMockCodeExplorer(files);
      const handler = new WebhookHandler(explorer, createConfig());

      const discovery = await handler.discover();
      const fields = discovery.endpoints[0].events[0].requiredFields;
      expect(fields.some((f) => f.includes('data.object'))).toBe(true);
    });
  });

  describe('fire', () => {
    it('sends POST with correct headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('{"received":true}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const explorer = createMockCodeExplorer({});
      const handler = new WebhookHandler(explorer, createConfig());

      const result = await handler.fire({
        url: '/api/webhooks/stripe',
        body: '{"type":"test"}',
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/webhooks/stripe');
      expect(opts.method).toBe('POST');
      expect(opts.headers['content-type']).toBe('application/json');
      expect(result.status).toBe(200);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      vi.unstubAllGlobals();
    });

    it('generates valid Stripe signature', async () => {
      const body = '{"type":"payment_intent.succeeded"}';
      const secret = 'whsec_test123';
      let capturedHeaders: Record<string, string> = {};

      const mockFetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        capturedHeaders = opts.headers as Record<string, string>;
        return { status: 200, text: () => Promise.resolve('ok') };
      });
      vi.stubGlobal('fetch', mockFetch);

      const explorer = createMockCodeExplorer({});
      const handler = new WebhookHandler(explorer, createConfig());

      await handler.fire({ url: '/webhook', body, signing: 'stripe' });

      const sig = capturedHeaders['stripe-signature'];
      expect(sig).toBeDefined();
      expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]+$/);

      // Verify the signature is correct
      const parts = sig.split(',');
      const timestamp = parts[0].split('=')[1];
      const signedPayload = `${timestamp}.${body}`;
      const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
      expect(parts[1]).toBe(`v1=${expected}`);

      vi.unstubAllGlobals();
    });

    it('generates valid GitHub signature', async () => {
      const body = '{"action":"push"}';
      const secret = 'ghsec_test456';
      let capturedHeaders: Record<string, string> = {};

      const mockFetch = vi.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        capturedHeaders = opts.headers as Record<string, string>;
        return { status: 200, text: () => Promise.resolve('ok') };
      });
      vi.stubGlobal('fetch', mockFetch);

      const explorer = createMockCodeExplorer({});
      const handler = new WebhookHandler(explorer, createConfig());

      await handler.fire({ url: '/webhook', body, signing: 'github' });

      const sig = capturedHeaders['x-hub-signature-256'];
      expect(sig).toBeDefined();
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      expect(sig).toBe(`sha256=${expected}`);

      vi.unstubAllGlobals();
    });

    it('handles non-200 responses', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        }),
      );

      const explorer = createMockCodeExplorer({});
      const handler = new WebhookHandler(explorer, createConfig());

      const result = await handler.fire({ url: '/webhook', body: '{}' });
      expect(result.status).toBe(500);
      expect(result.responseBody).toBe('Internal Server Error');

      vi.unstubAllGlobals();
    });

    it('handles fetch errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

      const explorer = createMockCodeExplorer({});
      const handler = new WebhookHandler(explorer, createConfig());

      const result = await handler.fire({ url: '/webhook', body: '{}' });
      expect(result.status).toBe(0);
      expect(result.responseBody).toContain('Connection refused');

      vi.unstubAllGlobals();
    });

    it('uses full URL when absolute URL provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const explorer = createMockCodeExplorer({});
      const handler = new WebhookHandler(explorer, createConfig());

      await handler.fire({ url: 'http://custom:8080/hook', body: '{}' });
      expect(mockFetch.mock.calls[0][0]).toBe('http://custom:8080/hook');

      vi.unstubAllGlobals();
    });
  });
});
