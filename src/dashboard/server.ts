import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerType } from '@hono/node-server';
import type { SessionManager } from '../core/session-manager.js';
import type { ReportManager } from '../core/report-manager.js';
import type { SessionHistory } from '../core/session-history.js';
import type {
  BugSeverity,
  DashboardConfig,
  SessionConfig,
  SessionEvent,
  SessionListItem,
  WsMessage,
} from '../types/index.js';

export class DashboardServer {
  private app: Hono;
  private server: ServerType | null = null;
  private wsClients = new Set<{
    send: (data: string) => void;
    close: () => void;
  }>();
  private injectWebSocket: ReturnType<typeof createNodeWebSocket>['injectWebSocket'];

  constructor(
    private config: DashboardConfig,
    private sessionConfig: SessionConfig,
    private sessionManager: SessionManager | null = null,
    private reportManager: ReportManager | null = null,
    private sessionHistory: SessionHistory | null = null,
  ) {
    this.app = new Hono();
    const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
      app: this.app,
    });
    this.injectWebSocket = injectWebSocket;

    this.registerRoutes(upgradeWebSocket);
    this.wireEvents();
  }

  private registerRoutes(
    upgradeWebSocket: ReturnType<typeof createNodeWebSocket>['upgradeWebSocket'],
  ): void {
    const api = new Hono();

    // List sessions (active + historical from disk)
    api.get('/sessions', async (c) => {
      const sessions: SessionListItem[] = [];

      // Active session from memory
      if (this.sessionManager) {
        const active = this.sessionManager.getSession();
        if (active) {
          const summary = this.reportManager ? this.reportManager.getSummary(active) : null;
          sessions.push({
            id: active.id,
            startTime: active.startTime,
            duration: Date.now() - active.startTime,
            stepCount: active.steps.length,
            bugCount: summary?.bugCount ?? 0,
            findingCount: summary?.findingCount ?? 0,
            status: 'active',
          });
        }
      }

      // Historical sessions from disk
      const sessionsDir = this.sessionConfig.outputDir;
      try {
        const dirs = await readdir(sessionsDir);
        for (const dir of dirs) {
          const sessionPath = join(sessionsDir, dir, 'session.json');
          try {
            const raw = await readFile(sessionPath, 'utf-8');
            const data = JSON.parse(raw);
            // Skip if this is the active session (already included)
            if (sessions.some((s) => s.id === data.id)) continue;
            sessions.push({
              id: data.id,
              startTime: data.startTime,
              endTime: data.endTime,
              duration: (data.endTime ?? Date.now()) - data.startTime,
              stepCount: data.steps?.length ?? 0,
              bugCount: 0,
              findingCount: 0,
              status: 'completed',
            });
          } catch {
            // Skip directories without valid session.json
          }
        }
      } catch {
        // Sessions dir may not exist yet
      }

      sessions.sort((a, b) => b.startTime - a.startTime);
      return c.json(sessions);
    });

    // Session detail
    api.get('/sessions/:id', async (c) => {
      const id = c.req.param('id');

      // Check active session
      if (this.sessionManager) {
        const active = this.sessionManager.getSession();
        if (active && active.id === id) {
          const summary = this.reportManager ? this.reportManager.getSummary(active) : null;
          return c.json({
            ...active,
            steps: active.steps.map(({ screenshot: _, ...rest }) => rest),
            bugs: this.reportManager?.getBugs() ?? [],
            findings: this.reportManager?.getFindings() ?? [],
            summary,
          });
        }
      }

      // Load from disk
      const sessionPath = join(this.sessionConfig.outputDir, id, 'session.json');
      try {
        const raw = await readFile(sessionPath, 'utf-8');
        return c.json(JSON.parse(raw));
      } catch {
        return c.json({ error: 'Session not found' }, 404);
      }
    });

    // Step screenshot
    api.get('/sessions/:id/steps/:stepId/screenshot', async (c) => {
      const { id, stepId } = c.req.param();

      // Check in-memory first
      if (this.sessionManager) {
        const active = this.sessionManager.getSession();
        if (active && active.id === id) {
          const step = active.steps.find((s) => s.id === stepId);
          if (step?.screenshot) {
            c.header('Content-Type', 'image/png');
            c.header('Cache-Control', 'public, max-age=31536000, immutable');
            return c.body(Buffer.from(step.screenshot, 'base64'));
          }
        }
      }

      // Try disk
      const screenshotPath = join(this.sessionConfig.outputDir, id, `${stepId}.png`);
      try {
        const buf = await readFile(screenshotPath);
        c.header('Content-Type', 'image/png');
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
        return c.body(buf);
      } catch {
        return c.json({ error: 'Screenshot not found' }, 404);
      }
    });

    // Live session data
    api.get('/live/session', async (c) => {
      if (!this.sessionManager) {
        return c.json({ error: 'No MCP session (standalone dashboard mode)' }, 404);
      }
      const active = this.sessionManager.getSession();
      if (!active) {
        return c.json({ error: 'No active session' }, 404);
      }
      const summary = this.reportManager ? this.reportManager.getSummary(active) : null;
      return c.json({
        session: {
          ...active,
          steps: active.steps.map(({ screenshot: _, ...rest }) => rest),
        },
        bugs: this.reportManager?.getBugs() ?? [],
        findings: this.reportManager?.getFindings() ?? [],
        summary,
      });
    });

    // History endpoints (powered by SessionHistory)
    api.get('/history', async (c) => {
      if (!this.sessionHistory) {
        return c.json({ error: 'Learning not enabled' }, 404);
      }
      const limit = Number(c.req.query('limit') ?? 20);
      const since = c.req.query('since') ? Number(c.req.query('since')) : undefined;
      const groupBy = c.req.query('groupBy') as 'url' | 'actionType' | 'context' | undefined;
      const entries = await this.sessionHistory.getHistory({ limit, since });

      if (groupBy) {
        const grouped: Record<string, { sessions: number; totalSteps: number; totalBugs: number }> =
          {};
        for (const entry of entries) {
          let keys: string[];
          if (groupBy === 'url') keys = entry.urlsCovered;
          else if (groupBy === 'actionType') keys = Object.keys(entry.actionTypes);
          else keys = entry.contexts ?? ['default'];

          for (const key of keys) {
            if (!grouped[key]) grouped[key] = { sessions: 0, totalSteps: 0, totalBugs: 0 };
            grouped[key].sessions++;
            grouped[key].totalSteps += entry.stepCount;
            grouped[key].totalBugs += entry.bugCount;
          }
        }
        return c.json(grouped);
      }

      return c.json(entries);
    });

    api.get('/history/bugs', async (c) => {
      if (!this.sessionHistory) {
        return c.json({ error: 'Learning not enabled' }, 404);
      }
      const severity = c.req.query('severity') as BugSeverity | undefined;
      const url = c.req.query('url');
      const limit = Number(c.req.query('limit') ?? 50);
      const entries = await this.sessionHistory.getBugLedger({ severity, url, limit });
      return c.json(entries);
    });

    api.get('/history/compare', async (c) => {
      if (!this.sessionHistory) {
        return c.json({ error: 'Learning not enabled' }, 404);
      }
      const a = c.req.query('a');
      const b = c.req.query('b');
      if (!a || !b) {
        return c.json({ error: 'Both "a" and "b" query params required' }, 400);
      }
      try {
        const comparison = await this.sessionHistory.compare(a, b);
        return c.json(comparison);
      } catch (err) {
        return c.json({ error: (err as Error).message }, 404);
      }
    });

    this.app.route('/api', api);

    // WebSocket
    this.app.get(
      '/ws',
      upgradeWebSocket(() => ({
        onOpen: (_event, ws) => {
          const client = {
            send: (data: string) => ws.send(data),
            close: () => ws.close(),
          };
          this.wsClients.add(client);
          ws.raw?.on?.('close', () => this.wsClients.delete(client));
        },
        onClose: () => {
          // Cleanup handled in onOpen's close listener
        },
      })),
    );

    // SPA fallback: serve index.html for non-API, non-asset routes
    this.app.get('*', async (c) => {
      const distDir = join(import.meta.dirname ?? __dirname, '../../dist/dashboard');
      const reqPath = new URL(c.req.url).pathname;

      // Try serving static file first
      if (reqPath !== '/' && !reqPath.startsWith('/api') && !reqPath.startsWith('/ws')) {
        const filePath = join(distDir, reqPath);
        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            const buf = await readFile(filePath);
            const ext = reqPath.split('.').pop();
            const mimeTypes: Record<string, string> = {
              js: 'application/javascript',
              css: 'text/css',
              html: 'text/html',
              png: 'image/png',
              svg: 'image/svg+xml',
              json: 'application/json',
              ico: 'image/x-icon',
            };
            c.header('Content-Type', mimeTypes[ext ?? ''] ?? 'application/octet-stream');
            return c.body(buf);
          }
        } catch {
          // Fall through to SPA
        }
      }

      // SPA fallback
      try {
        const html = await readFile(join(distDir, 'index.html'), 'utf-8');
        return c.html(html);
      } catch {
        return c.text('Dashboard not built. Run: pnpm build:dashboard', 404);
      }
    });
  }

  private wireEvents(): void {
    if (!this.sessionManager || !this.reportManager) return;

    const broadcast = (event: SessionEvent<unknown>) => {
      const msg: WsMessage = {
        type: event.type,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        data: event.data,
      };
      const payload = JSON.stringify(msg);
      for (const client of this.wsClients) {
        try {
          client.send(payload);
        } catch {
          this.wsClients.delete(client);
        }
      }
    };

    this.sessionManager.on('session:start', broadcast);
    this.sessionManager.on('step:recorded', broadcast);
    this.sessionManager.on('session:end', broadcast);
    this.reportManager.on('bug:created', broadcast);
    this.reportManager.on('finding:created', broadcast);
  }

  async start(): Promise<void> {
    const { port, host } = this.config;

    this.server = serve({
      fetch: this.app.fetch,
      port,
      hostname: host,
    });

    this.injectWebSocket(this.server);

    console.error(`[f4tl] Dashboard running at http://${host}:${port}`);
  }

  async stop(): Promise<void> {
    for (const client of this.wsClients) {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
    this.wsClients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
