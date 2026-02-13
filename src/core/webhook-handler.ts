import { createHmac } from 'node:crypto';
import type { CodeExplorer } from './code-explorer.js';
import type {
  WebhookConfig,
  WebhookDiscovery,
  WebhookEndpoint,
  WebhookEvent,
  WebhookFireResult,
} from '../types/index.js';

// ── Signing Strategies ──────────────────────────────────────────────────────

function signStripe(payload: string, secret: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return { 'stripe-signature': `t=${timestamp},v1=${signature}` };
}

function signGithub(payload: string, secret: string): Record<string, string> {
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { 'x-hub-signature-256': `sha256=${signature}` };
}

const SIGNING_STRATEGIES: Record<
  string,
  (payload: string, secret: string) => Record<string, string>
> = {
  stripe: signStripe,
  github: signGithub,
};

// ── Discovery Patterns ──────────────────────────────────────────────────────

const WEBHOOK_FILE_GLOBS = ['**/*webhook*', '**/*hook*'];
const WEBHOOK_SEARCH_PATTERNS = [
  'event\\.type',
  'stripe.*signature',
  'x-hub-signature',
  'webhook',
  'constructEvent',
];

const EVENT_TYPE_REGEX =
  /(?:case\s+['"]|event\.type\s*===?\s*['"]|type\s*===?\s*['"])([a-z][a-z0-9_.]+)['"]/gi;
const FIELD_ACCESS_REGEX = /(?:event|payload|body|data)(?:\.\w+)+/g;
const STATE_TRANSITION_REGEX = /(?:status|state)\s*[:=]\s*['"](\w+)['"]/gi;
const ROUTE_REGEX =
  /(?:(?:app|router)\.\s*(?:post|all|use)\s*\(\s*['"]([^'"]+)['"]|route\s*[:=]\s*['"]([^'"]+)['"])/gi;

// ── WebhookHandler ──────────────────────────────────────────────────────────

export class WebhookHandler {
  constructor(
    private codeExplorer: CodeExplorer,
    private config: WebhookConfig,
  ) {}

  async discover(): Promise<WebhookDiscovery> {
    // 1. Find candidate files
    const candidateFiles = new Set<string>();

    for (const glob of WEBHOOK_FILE_GLOBS) {
      try {
        const files = await this.codeExplorer.findFiles(glob, { maxResults: 50 });
        files.forEach((f) => candidateFiles.add(f));
      } catch {
        // Pattern may not match
      }
    }

    for (const pattern of WEBHOOK_SEARCH_PATTERNS) {
      try {
        const matches = await this.codeExplorer.search(pattern, {
          caseSensitive: false,
          maxResults: 50,
        });
        matches.forEach((m) => candidateFiles.add(m.file));
      } catch {
        // Pattern may not match
      }
    }

    if (candidateFiles.size === 0) {
      return { endpoints: [], timestamp: Date.now() };
    }

    // 2. Analyze each file
    const endpoints: WebhookEndpoint[] = [];

    for (const file of candidateFiles) {
      try {
        const { content } = await this.codeExplorer.readFile(file);
        const endpoint = this.analyzeFile(file, content);
        if (endpoint) endpoints.push(endpoint);
      } catch {
        // Skip unreadable files
      }
    }

    return { endpoints, timestamp: Date.now() };
  }

  private analyzeFile(file: string, content: string): WebhookEndpoint | null {
    // Extract event types
    const eventTypes = new Set<string>();
    let match: RegExpExecArray | null;

    EVENT_TYPE_REGEX.lastIndex = 0;
    while ((match = EVENT_TYPE_REGEX.exec(content)) !== null) {
      eventTypes.add(match[1]);
    }

    if (eventTypes.size === 0) return null;

    // Extract route
    let route = '/webhook';
    ROUTE_REGEX.lastIndex = 0;
    const routeMatch = ROUTE_REGEX.exec(content);
    if (routeMatch) {
      route = routeMatch[1] || routeMatch[2] || route;
    }

    // Detect signing provider
    let signing: string | undefined;
    const contentLower = content.toLowerCase();
    if (contentLower.includes('stripe') && contentLower.includes('signature')) {
      signing = 'stripe';
    } else if (contentLower.includes('x-hub-signature')) {
      signing = 'github';
    }

    // Build events with field analysis
    const events: WebhookEvent[] = [];
    const lines = content.split('\n');

    for (const eventType of eventTypes) {
      // Find handler location
      let lineNum = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(eventType)) {
          lineNum = i + 1;
          break;
        }
      }

      // Extract required fields from nearby code (within 30 lines of event type)
      const startLine = Math.max(0, lineNum - 1);
      const endLine = Math.min(lines.length, lineNum + 30);
      const nearbyCode = lines.slice(startLine, endLine).join('\n');

      const requiredFields = new Set<string>();
      const fieldMatches = nearbyCode.match(FIELD_ACCESS_REGEX) ?? [];
      for (const field of fieldMatches) {
        requiredFields.add(field);
      }

      // Look for state transitions nearby
      let stateTransition: string | undefined;
      STATE_TRANSITION_REGEX.lastIndex = 0;
      const states: string[] = [];
      let stateMatch: RegExpExecArray | null;
      while ((stateMatch = STATE_TRANSITION_REGEX.exec(nearbyCode)) !== null) {
        states.push(stateMatch[1]);
      }
      if (states.length >= 2) {
        stateTransition = `${states[0]} → ${states[1]}`;
      } else if (states.length === 1) {
        stateTransition = `→ ${states[0]}`;
      }

      events.push({
        type: eventType,
        requiredFields: [...requiredFields],
        stateTransition,
        handlerLocation: `${file}:${lineNum}`,
      });
    }

    return { route, file, signing, events };
  }

  async fire(params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body: string;
    signing?: string;
  }): Promise<WebhookFireResult> {
    const method = params.method ?? 'POST';
    const fullUrl = params.url.startsWith('http')
      ? params.url
      : `${this.config.baseUrl}${params.url.startsWith('/') ? '' : '/'}${params.url}`;

    // Build headers
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...params.headers,
    };

    // Add signing headers
    if (params.signing) {
      const strategy = SIGNING_STRATEGIES[params.signing];
      const secret = this.config.signingSecrets?.[params.signing];
      if (strategy && secret) {
        Object.assign(headers, strategy(params.body, secret));
      }
    }

    const start = Date.now();
    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: params.body,
      });

      const responseBody = await response.text();
      const duration = Date.now() - start;

      return {
        status: response.status,
        responseBody: responseBody.slice(0, 5000),
        duration,
      };
    } catch (err) {
      const duration = Date.now() - start;
      return {
        status: 0,
        responseBody: `Fetch error: ${(err as Error).message}`,
        duration,
      };
    }
  }
}
