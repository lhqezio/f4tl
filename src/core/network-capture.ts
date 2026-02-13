import type { Page, Request, Response, WebSocket } from 'playwright';
import type {
  CapturedRequest,
  CapturedResponse,
  WebSocketMessage,
  InterceptRule,
} from '../types/index.js';
import { nanoid } from 'nanoid';

export class NetworkCapture {
  private requests: CapturedRequest[] = [];
  private responses: CapturedResponse[] = [];
  private wsMessages: WebSocketMessage[] = [];
  private interceptRules: InterceptRule[] = [];
  private destroyed = false;

  constructor(private page: Page) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.page.on('request', (req: Request) => {
      if (this.destroyed) return;
      this.requests.push({
        id: nanoid(),
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        body: req.postData() ?? undefined,
        resourceType: req.resourceType(),
        timestamp: Date.now(),
      });
    });

    this.page.on('response', (res: Response) => {
      if (this.destroyed) return;
      const req = res.request();
      const matchingReq = [...this.requests]
        .reverse()
        .find((r) => r.url === req.url() && r.method === req.method());

      this.responses.push({
        requestId: matchingReq?.id ?? 'unknown',
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        headers: res.headers(),
        timing: {
          start: matchingReq?.timestamp ?? Date.now(),
          end: Date.now(),
          duration: matchingReq ? Date.now() - matchingReq.timestamp : 0,
        },
      });
    });

    this.page.on('websocket', (ws: WebSocket) => {
      if (this.destroyed) return;
      const url = ws.url();

      ws.on('framesent', (data) => {
        if (this.destroyed) return;
        this.wsMessages.push({
          url,
          direction: 'sent',
          payload: typeof data.payload === 'string' ? data.payload : '<binary>',
          timestamp: Date.now(),
        });
      });

      ws.on('framereceived', (data) => {
        if (this.destroyed) return;
        this.wsMessages.push({
          url,
          direction: 'received',
          payload: typeof data.payload === 'string' ? data.payload : '<binary>',
          timestamp: Date.now(),
        });
      });
    });
  }

  getRequests(filters?: {
    urlPattern?: string;
    method?: string;
    resourceType?: string;
    statusMin?: number;
    statusMax?: number;
    limit?: number;
  }): { requests: CapturedRequest[]; responses: CapturedResponse[] } {
    let reqs = [...this.requests];
    let resps = [...this.responses];

    if (filters?.urlPattern) {
      const re = new RegExp(filters.urlPattern, 'i');
      reqs = reqs.filter((r) => re.test(r.url));
      resps = resps.filter((r) => re.test(r.url));
    }

    if (filters?.method) {
      const m = filters.method.toUpperCase();
      reqs = reqs.filter((r) => r.method === m);
    }

    if (filters?.resourceType) {
      reqs = reqs.filter((r) => r.resourceType === filters.resourceType);
    }

    if (filters?.statusMin !== undefined || filters?.statusMax !== undefined) {
      const min = filters.statusMin ?? 0;
      const max = filters.statusMax ?? 999;
      resps = resps.filter((r) => r.status >= min && r.status <= max);
      const respReqIds = new Set(resps.map((r) => r.requestId));
      reqs = reqs.filter((r) => respReqIds.has(r.id));
    }

    const limit = filters?.limit ?? 100;
    reqs = reqs.slice(-limit);
    const reqIds = new Set(reqs.map((r) => r.id));
    resps = resps.filter((r) => reqIds.has(r.requestId)).slice(-limit);

    return { requests: reqs, responses: resps };
  }

  getWebSocketMessages(urlPattern?: string, limit = 100): WebSocketMessage[] {
    let msgs = [...this.wsMessages];
    if (urlPattern) {
      const re = new RegExp(urlPattern, 'i');
      msgs = msgs.filter((m) => re.test(m.url));
    }
    return msgs.slice(-limit);
  }

  async addInterceptRule(rule: Omit<InterceptRule, 'id'>): Promise<InterceptRule> {
    const fullRule: InterceptRule = { ...rule, id: nanoid() };
    this.interceptRules.push(fullRule);
    await this.applyInterceptRules();
    return fullRule;
  }

  async removeInterceptRule(id: string): Promise<boolean> {
    const idx = this.interceptRules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.interceptRules.splice(idx, 1);
    await this.applyInterceptRules();
    return true;
  }

  async clearInterceptRules(): Promise<void> {
    this.interceptRules = [];
    await this.page.unroute('**/*').catch(() => {});
  }

  getInterceptRules(): InterceptRule[] {
    return [...this.interceptRules];
  }

  private async applyInterceptRules(): Promise<void> {
    // Remove all existing routes and re-apply
    await this.page.unroute('**/*').catch(() => {});

    if (this.interceptRules.length === 0) return;

    await this.page.route('**/*', async (route) => {
      const url = route.request().url();

      for (const rule of this.interceptRules) {
        const re = new RegExp(rule.urlPattern, 'i');
        if (!re.test(url)) continue;

        switch (rule.action) {
          case 'block':
            await route.abort('blockedbyclient');
            return;
          case 'mock':
            if (rule.mockResponse) {
              await route.fulfill({
                status: rule.mockResponse.status,
                headers: rule.mockResponse.headers,
                body: rule.mockResponse.body,
              });
              return;
            }
            break;
          case 'delay':
            if (rule.delay) {
              await new Promise((r) => setTimeout(r, rule.delay));
            }
            break;
        }
      }

      await route.continue();
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.requests = [];
    this.responses = [];
    this.wsMessages = [];
    this.interceptRules = [];
    this.page.unroute('**/*').catch(() => {});
  }
}
