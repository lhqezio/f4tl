import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BrowserManager } from '../core/browser-manager.js';
import { SessionManager } from '../core/session-manager.js';
import { LogCollector } from '../core/log-collector.js';
import { DatabaseConnector } from '../core/database-connector.js';
import { CodeExplorer } from '../core/code-explorer.js';
import {
  BrowserTools,
  navigateSchema,
  clickSchema,
  fillSchema,
  typeSchema,
  selectSchema,
  hoverSchema,
  pressSchema,
  scrollSchema,
  screenshotSchema,
  evaluateSchema,
  resizeSchema,
  waitSchema,
  accessibilityTreeSchema,
} from './tools/browser.js';
import {
  NetworkTools,
  getRequestsSchema,
  interceptSchema,
  getWebSocketsSchema,
} from './tools/network.js';
import { LogTools, tailSchema, getLogsSchema, searchLogsSchema } from './tools/logs.js';
import { DatabaseTools, querySchema, schemaSchema, explainSchema } from './tools/database.js';
import {
  CodeTools,
  searchSchema,
  readFileSchema,
  findFilesSchema,
  gitDiffSchema,
} from './tools/code.js';
import {
  ReportTools,
  createBugSchema,
  addFindingSchema,
  generateReportSchema,
} from './tools/report.js';
import { ReportManager } from '../core/report-manager.js';
import { WebhookHandler } from '../core/webhook-handler.js';
import { SessionHistory } from '../core/session-history.js';
import { WebhookTools, discoverSchema, fireSchema } from './tools/webhook.js';
import { LearningTools, getHistorySchema, getBugsSchema, compareSchema } from './tools/learning.js';
import { registerPrompts } from './prompts.js';
import type { F4tlConfig } from '../types/index.js';

export class F4tlServer {
  private mcp: McpServer;
  private browserManager: BrowserManager;
  private sessionManager: SessionManager;
  private browserTools: BrowserTools;
  private networkTools: NetworkTools;
  private logCollector: LogCollector | null = null;
  private logTools: LogTools | null = null;
  private dbConnector: DatabaseConnector | null = null;
  private dbTools: DatabaseTools | null = null;
  private codeExplorer: CodeExplorer;
  private codeTools: CodeTools;
  private reportManager: ReportManager;
  private reportTools: ReportTools;
  private webhookTools: WebhookTools | null = null;
  private learningTools: LearningTools | null = null;

  constructor(private config: F4tlConfig) {
    this.mcp = new McpServer(
      { name: config.mcp.name, version: config.mcp.version },
      { capabilities: { tools: {}, prompts: {} } },
    );

    this.browserManager = new BrowserManager(config.browser, config.capture);
    this.sessionManager = new SessionManager(config.session);
    this.browserTools = new BrowserTools(this.browserManager, this.sessionManager);
    this.networkTools = new NetworkTools(this.browserManager);
    this.codeExplorer = new CodeExplorer(config.codebase);
    this.codeTools = new CodeTools(this.codeExplorer);
    this.reportManager = new ReportManager(config.report);
    this.reportTools = new ReportTools(
      this.reportManager,
      this.sessionManager,
      config.session.outputDir,
    );

    // Conditional: logs
    if (config.logs && Object.keys(config.logs).length > 0) {
      this.logCollector = new LogCollector(config.logs);
      this.logTools = new LogTools(this.logCollector);
    }

    // Conditional: database
    if (config.database) {
      this.dbConnector = new DatabaseConnector(config.database);
      this.dbTools = new DatabaseTools(this.dbConnector);
    }

    // Conditional: webhooks
    if (config.webhooks) {
      const handler = new WebhookHandler(this.codeExplorer, config.webhooks);
      this.webhookTools = new WebhookTools(handler, this.browserManager);
    }

    // Conditional: learning (enabled by default when not explicitly disabled)
    if (config.learning?.enabled !== false) {
      const history = new SessionHistory(config.session.outputDir);
      this.learningTools = new LearningTools(history);
    }

    this.registerBrowserTools();
    this.registerNetworkTools();
    this.registerCodeTools();
    this.registerContextTools();
    this.registerReportTools();

    if (this.logTools) this.registerLogTools();
    if (this.dbTools) this.registerDatabaseTools();
    if (this.webhookTools) this.registerWebhookTools();
    if (this.learningTools) this.registerLearningTools();

    registerPrompts(this.mcp);

    this.setupShutdown();
  }

  // ── Browser Tools (15) ──────────────────────────────────────────────────────

  private registerBrowserTools(): void {
    const t = this.browserTools;

    this.mcp.tool(
      'browser_navigate',
      'Navigate to a URL. Returns screenshot + console/network errors.',
      navigateSchema.shape,
      (params) => t.navigate(navigateSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_click',
      'Click an element by CSS/text/role/xpath selector.',
      clickSchema.shape,
      (params) => t.click(clickSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_fill',
      'Fill an input field (clears existing value first).',
      fillSchema.shape,
      (params) => t.fill(fillSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_type',
      'Type text keystroke-by-keystroke (for autocomplete/search).',
      typeSchema.shape,
      (params) => t.type(typeSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_select',
      'Select a dropdown option by value or label.',
      selectSchema.shape,
      (params) => t.select(selectSchema.parse(params)),
    );

    this.mcp.tool('browser_hover', 'Hover over an element.', hoverSchema.shape, (params) =>
      t.hover(hoverSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_press',
      'Press a keyboard key or combo (e.g. Enter, Control+a).',
      pressSchema.shape,
      (params) => t.press(pressSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_scroll',
      'Scroll the page or a container element.',
      scrollSchema.shape,
      (params) => t.scroll(scrollSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_screenshot',
      'Take a screenshot without performing any action.',
      screenshotSchema.shape,
      (params) => t.screenshot(screenshotSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_evaluate',
      'Execute JavaScript in the page context and return the result.',
      evaluateSchema.shape,
      (params) => t.evaluate(evaluateSchema.parse(params)),
    );

    this.mcp.tool('browser_resize', 'Resize the browser viewport.', resizeSchema.shape, (params) =>
      t.resize(resizeSchema.parse(params)),
    );

    this.mcp.tool(
      'browser_wait',
      'Wait for time, selector, network idle, or URL change.',
      waitSchema.shape,
      (params) => t.wait(waitSchema.parse(params)),
    );

    this.mcp.tool('browser_back', 'Navigate back in browser history.', () => t.back());

    this.mcp.tool('browser_forward', 'Navigate forward in browser history.', () => t.forward());

    this.mcp.tool(
      'browser_accessibility_tree',
      'Get the accessibility tree of the page.',
      accessibilityTreeSchema.shape,
      (params) => t.accessibilityTree(accessibilityTreeSchema.parse(params)),
    );
  }

  // ── Network Tools (4) ──────────────────────────────────────────────────────

  private registerNetworkTools(): void {
    const t = this.networkTools;

    this.mcp.tool(
      'network_get_requests',
      'Get captured HTTP requests/responses with optional filters.',
      getRequestsSchema.shape,
      (params) => t.getRequests(getRequestsSchema.parse(params)),
    );

    this.mcp.tool(
      'network_intercept',
      'Add a network intercept rule (block, mock, or delay requests).',
      interceptSchema.shape,
      (params) => t.intercept(interceptSchema.parse(params)),
    );

    this.mcp.tool('network_clear_intercepts', 'Remove all network intercept rules.', () =>
      t.clearIntercepts(),
    );

    this.mcp.tool(
      'network_get_websockets',
      'Get captured WebSocket messages.',
      getWebSocketsSchema.shape,
      (params) => t.getWebSockets(getWebSocketsSchema.parse(params)),
    );
  }

  // ── Context Tools (2-3) ────────────────────────────────────────────────────

  private registerContextTools(): void {
    const bm = this.browserManager;
    const config = this.config;

    this.mcp.tool(
      'browser_new_context',
      'Create a new isolated browser context (for multi-user testing).',
      {
        name: z.string().describe('Context name (e.g. "buyer", "admin")'),
        viewport: z
          .object({ width: z.number(), height: z.number() })
          .optional()
          .describe('Custom viewport size'),
        userAgent: z.string().optional().describe('Custom user agent'),
        locale: z.string().optional().describe('Locale (e.g. "en-US")'),
        timezoneId: z.string().optional().describe('Timezone (e.g. "America/New_York")'),
      },
      async (params) => {
        try {
          await bm.createContext(params.name, {
            viewport: params.viewport,
            userAgent: params.userAgent,
            locale: params.locale,
            timezoneId: params.timezoneId,
          });
          bm.switchContext(params.name);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Context "${params.name}" created and activated. Contexts: ${bm.getContextNames().join(', ')}`,
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
            isError: true,
          };
        }
      },
    );

    this.mcp.tool(
      'browser_switch_context',
      'Switch the active browser context.',
      {
        name: z.string().describe('Context name to switch to'),
      },
      async (params) => {
        try {
          bm.switchContext(params.name);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Switched to context "${params.name}". Active: ${bm.getActiveContextId()}`,
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
            isError: true,
          };
        }
      },
    );

    // Auth tool — only if auth config exists
    const auth = config.auth;
    if (auth && Object.keys(auth).length > 0) {
      this.mcp.tool(
        'browser_auth',
        'Authenticate the current context with a configured role.',
        {
          role: z.string().describe('Auth role name from config'),
        },
        async (params) => {
          try {
            await bm.executeAuth(params.role, auth);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Authenticated as "${params.role}" in context "${bm.getActiveContextId()}".`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
              isError: true,
            };
          }
        },
      );
    }
  }

  // ── Log Tools (3) ──────────────────────────────────────────────────────────

  private registerLogTools(): void {
    const t = this.logTools;
    if (!t) return;

    this.mcp.tool(
      'logs_tail',
      'Get the most recent log entries from a source.',
      tailSchema.shape,
      (params) => t.tail(tailSchema.parse(params)),
    );

    this.mcp.tool(
      'logs_get',
      'Get log entries with filters (source, level, time range).',
      getLogsSchema.shape,
      (params) => t.getLogs(getLogsSchema.parse(params)),
    );

    this.mcp.tool(
      'logs_search',
      'Search log entries by regex pattern.',
      searchLogsSchema.shape,
      (params) => t.searchLogs(searchLogsSchema.parse(params)),
    );
  }

  // ── Database Tools (3) ─────────────────────────────────────────────────────

  private registerDatabaseTools(): void {
    const t = this.dbTools;
    if (!t) return;

    this.mcp.tool(
      'db_query',
      'Execute a read-only SQL query (SELECT only, auto-limited to 1000 rows).',
      querySchema.shape,
      (params) => t.query(querySchema.parse(params)),
    );

    this.mcp.tool(
      'db_schema',
      'Get database schema (tables, columns, foreign keys).',
      schemaSchema.shape,
      (params) => t.schema(schemaSchema.parse(params)),
    );

    this.mcp.tool(
      'db_explain',
      'Get the query execution plan (EXPLAIN ANALYZE).',
      explainSchema.shape,
      (params) => t.explain(explainSchema.parse(params)),
    );
  }

  // ── Code Tools (4) ─────────────────────────────────────────────────────────

  private registerCodeTools(): void {
    const t = this.codeTools;

    this.mcp.tool(
      'code_search',
      'Search codebase with ripgrep (regex pattern matching).',
      searchSchema.shape,
      (params) => t.search(searchSchema.parse(params)),
    );

    this.mcp.tool(
      'code_read',
      'Read a file from the project codebase.',
      readFileSchema.shape,
      (params) => t.readFile(readFileSchema.parse(params)),
    );

    this.mcp.tool(
      'code_find_files',
      'Find files by glob pattern.',
      findFilesSchema.shape,
      (params) => t.findFiles(findFilesSchema.parse(params)),
    );

    this.mcp.tool(
      'code_git_diff',
      'Get git diff (uncommitted changes or against a ref).',
      gitDiffSchema.shape,
      (params) => t.gitDiff(gitDiffSchema.parse(params)),
    );
  }

  // ── Report Tools (4) ──────────────────────────────────────────────────────

  private registerReportTools(): void {
    const t = this.reportTools;

    this.mcp.tool(
      'report_create_bug',
      'Record a bug with severity, steps to reproduce, expected/actual behavior.',
      createBugSchema.shape,
      (params) => t.createBug(createBugSchema.parse(params)),
    );

    this.mcp.tool(
      'report_add_finding',
      'Record a QA finding (usability, performance, accessibility, security, suggestion, observation).',
      addFindingSchema.shape,
      (params) => t.addFinding(addFindingSchema.parse(params)),
    );

    this.mcp.tool(
      'report_generate',
      'Generate a QA report (markdown, json, or html). Returns the output file path.',
      generateReportSchema.shape,
      (params) => t.generateReport(generateReportSchema.parse(params)),
    );

    this.mcp.tool(
      'report_get_session_summary',
      'Get current session statistics (step count, bugs, findings, duration).',
      () => t.getSessionSummary(),
    );
  }

  // ── Webhook Tools (2) ─────────────────────────────────────────────────────

  private registerWebhookTools(): void {
    const t = this.webhookTools;
    if (!t) return;

    this.mcp.tool(
      'webhook_discover',
      'Discover webhook endpoints, event types, required fields, and state transitions from source code.',
      discoverSchema.shape,
      (params) => t.discover(discoverSchema.parse(params)),
    );

    this.mcp.tool(
      'webhook_fire',
      'Fire a synthetic webhook POST with optional signing and UI verification.',
      fireSchema.shape,
      (params) => t.fire(fireSchema.parse(params)),
    );
  }

  // ── Learning Tools (3) ───────────────────────────────────────────────────

  private registerLearningTools(): void {
    const t = this.learningTools;
    if (!t) return;

    this.mcp.tool(
      'session_get_history',
      'Get past session history with coverage stats, bug counts, and URL coverage.',
      getHistorySchema.shape,
      (params) => t.getHistory(getHistorySchema.parse(params)),
    );

    this.mcp.tool(
      'session_get_bugs',
      'Get bug ledger across all sessions with recurrence tracking.',
      getBugsSchema.shape,
      (params) => t.getBugs(getBugsSchema.parse(params)),
    );

    this.mcp.tool(
      'session_compare',
      'Compare two sessions: coverage gaps, new/fixed/persistent bugs.',
      compareSchema.shape,
      (params) => t.compare(compareSchema.parse(params)),
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private setupShutdown(): void {
    const shutdown = async () => {
      console.error('[f4tl] Shutting down...');
      try {
        if (this.logCollector) {
          this.logCollector.stop();
        }
        if (this.dbConnector) {
          await this.dbConnector.disconnect();
        }
        if (this.sessionManager.getSession()) {
          await this.sessionManager.endSession();
        }
        if (this.browserManager.isLaunched()) {
          await this.browserManager.close();
        }
      } catch (err) {
        console.error('[f4tl] Shutdown error:', err);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  async start(): Promise<void> {
    console.error('[f4tl] Starting MCP server...');

    await this.browserManager.launch();
    console.error('[f4tl] Browser launched');

    if (this.logCollector) {
      this.logCollector.start();
      console.error('[f4tl] Log collector started');
    }

    if (this.dbConnector) {
      try {
        await this.dbConnector.connect();
        console.error('[f4tl] Database connected');
      } catch (err) {
        console.error('[f4tl] Database connection failed (tools will error on use):', err);
      }
    }

    const sessionId = this.sessionManager.startSession(this.config);
    this.reportManager.setSessionId(sessionId);

    const transport = new StdioServerTransport();
    await this.mcp.connect(transport);

    // Count registered tools
    const toolCount =
      15 + // browser
      4 + // network
      4 + // code
      2 + // context (new_context, switch_context)
      4 + // report
      (this.config.auth && Object.keys(this.config.auth).length > 0 ? 1 : 0) + // auth
      (this.logTools ? 3 : 0) + // logs
      (this.dbTools ? 3 : 0) + // db
      (this.webhookTools ? 2 : 0) + // webhook
      (this.learningTools ? 3 : 0); // learning

    console.error(`[f4tl] MCP server ready (${toolCount} tools, 10 prompts registered)`);
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getReportManager(): ReportManager {
    return this.reportManager;
  }
}
