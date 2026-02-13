// ── Configuration Types ──────────────────────────────────────────────────────

export interface BrowserConfig {
  headless: boolean;
  viewport: { width: number; height: number };
  slowMo: number;
  timeout: number;
  devtools: boolean;
  args: string[];
}

export interface SessionConfig {
  outputDir: string;
  maxSteps: number;
  keepArtifacts: boolean;
}

export interface SuppressErrorsConfig {
  console: string[];
  network: string[];
}

export interface CaptureConfig {
  format: 'png' | 'jpeg';
  quality: number;
  fullPage: boolean;
  animations: 'disabled' | 'allow';
  suppressErrors?: SuppressErrorsConfig;
}

export interface McpConfig {
  name: string;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface LogSourceConfig {
  type: 'process' | 'file';
  command?: string;
  args?: string[];
  path?: string;
  parser: 'json' | 'clf' | 'plain';
}

export interface DatabaseConfig {
  type: 'postgres';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  allowedTables?: string[];
  maxConnections: number;
  queryTimeout: number;
}

export interface CodebaseConfig {
  projectRoot: string;
  excludePatterns: string[];
}

export interface AuthFormLogin {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  usernameEnv: string;
  passwordEnv: string;
}

export interface AuthJwtConfig {
  tokenEnv: string;
  storageKey: string;
  storageType: 'localStorage' | 'sessionStorage' | 'cookie';
}

export interface AuthOauthConfig {
  provider: string;
  authUrl: string;
  clientIdEnv: string;
  callbackUrl: string;
}

export interface AuthConfig {
  strategy: 'form' | 'cookie' | 'storage-state' | 'custom' | 'jwt' | 'oauth';
  formLogin?: AuthFormLogin;
  cookies?: { domain: string; items: { name: string; valueEnv: string }[] };
  storageStatePath?: string;
  customScriptPath?: string;
  jwt?: AuthJwtConfig;
  oauth?: AuthOauthConfig;
}

export interface ContextOptions {
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
}

export interface JourneyStep {
  action: string;
  target?: string;
  value?: string;
  expect?: string;
  note?: string;
}

export interface JourneyDefinition {
  description: string;
  auth?: string;
  dependsOn?: string[];
  mode: 'guided' | 'autonomous';
  steps: JourneyStep[];
}

export type JourneysConfig = Record<string, JourneyDefinition>;

export interface ReportConfig {
  outputDir: string;
}

export interface DashboardConfig {
  port: number;
  host: string;
}

export interface F4tlConfig {
  browser: BrowserConfig;
  session: SessionConfig;
  capture: CaptureConfig;
  mcp: McpConfig;
  auth?: Record<string, AuthConfig>;
  logs?: Record<string, LogSourceConfig>;
  database?: DatabaseConfig;
  codebase: CodebaseConfig;
  report: ReportConfig;
  dashboard: DashboardConfig;
  webhooks?: WebhookConfig;
  learning?: LearningConfig;
  app?: AppConfig;
  journeys?: JourneysConfig;
}

// ── Browser Action Types ─────────────────────────────────────────────────────

export type BrowserActionType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'type'
  | 'select'
  | 'hover'
  | 'press'
  | 'scroll'
  | 'screenshot'
  | 'evaluate'
  | 'resize'
  | 'wait'
  | 'back'
  | 'forward'
  | 'accessibility_tree';

export interface BrowserAction {
  type: BrowserActionType;
  params: Record<string, unknown>;
  timestamp: number;
}

// ── Metadata Types ───────────────────────────────────────────────────────────

export interface ConsoleMessage {
  type: 'log' | 'warning' | 'error';
  text: string;
  timestamp: number;
  location?: { url: string; lineNumber: number; columnNumber: number };
}

export interface NetworkError {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: number;
}

export interface DomMetrics {
  nodeCount: number;
  layoutCount: number;
  scriptDuration: number;
}

export interface StepMetadata {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  consoleErrors: ConsoleMessage[];
  networkErrors: NetworkError[];
  domMetrics?: DomMetrics;
}

// ── Session Types ────────────────────────────────────────────────────────────

export interface SessionStep {
  id: string;
  contextId?: string;
  action: BrowserAction;
  screenshot?: string;
  metadata: StepMetadata;
  duration: number;
  error?: string;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  steps: SessionStep[];
  contexts?: string[];
  config: F4tlConfig;
}

// ── Tool Result Types ────────────────────────────────────────────────────────

export interface TextContent {
  [key: string]: unknown;
  type: 'text';
  text: string;
}

export interface ImageContent {
  [key: string]: unknown;
  type: 'image';
  data: string;
  mimeType: string;
}

export type ToolContent = TextContent | ImageContent;

export interface ToolResult {
  [key: string]: unknown;
  content: ToolContent[];
  isError?: boolean;
}

// ── Capture Types ────────────────────────────────────────────────────────────

export interface CaptureResult {
  screenshot: string;
  metadata: StepMetadata;
}

// ── Network Capture Types ────────────────────────────────────────────────────

export interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  resourceType: string;
  timestamp: number;
}

export interface CapturedResponse {
  requestId: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  timing: { start: number; end: number; duration: number };
}

export interface WebSocketMessage {
  url: string;
  direction: 'sent' | 'received';
  payload: string;
  timestamp: number;
}

export interface InterceptRule {
  id: string;
  urlPattern: string;
  action: 'block' | 'mock' | 'delay';
  mockResponse?: { status: number; headers?: Record<string, string>; body?: string };
  delay?: number;
}

// ── Log Types ────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  source: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ── Database Types ───────────────────────────────────────────────────────────

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
}

export interface TableInfo {
  name: string;
  columns: { name: string; type: string; nullable: boolean; defaultValue?: string }[];
  foreignKeys: { column: string; referencesTable: string; referencesColumn: string }[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

// ── Codebase Types ───────────────────────────────────────────────────────────

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface GitDiffFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface GitDiffResult {
  files: GitDiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

// ── Reporting Types ─────────────────────────────────────────────────────────

export type BugSeverity = 'critical' | 'major' | 'minor' | 'cosmetic';

export interface Bug {
  id: string;
  contextId?: string;
  title: string;
  severity: BugSeverity;
  stepsToReproduce: string[];
  expected: string;
  actual: string;
  rootCause?: string;
  evidenceStepIds: string[];
  url?: string;
  timestamp: number;
}

export type FindingCategory =
  | 'usability'
  | 'performance'
  | 'accessibility'
  | 'security'
  | 'suggestion'
  | 'observation';

export interface Finding {
  id: string;
  contextId?: string;
  title: string;
  category: FindingCategory;
  description: string;
  evidenceStepIds: string[];
  url?: string;
  timestamp: number;
}

export type ReportFormat = 'markdown' | 'json' | 'html';

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  stepCount: number;
  bugCount: number;
  findingCount: number;
  bugsBySeverity: Record<BugSeverity, number>;
  findingsByCategory: Record<FindingCategory, number>;
  errorStepCount: number;
  contexts?: string[];
  stepsByContext?: Record<string, number>;
}

export interface ReportData {
  session: Session;
  bugs: Bug[];
  findings: Finding[];
  generatedAt: number;
  duration: number;
  summary: SessionSummary;
}

// ── Session Event Types ─────────────────────────────────────────────────────

export type SessionEventType =
  | 'session:start'
  | 'session:end'
  | 'step:recorded'
  | 'bug:created'
  | 'finding:created';

export interface SessionEvent<T = unknown> {
  type: SessionEventType;
  sessionId: string;
  timestamp: number;
  data: T;
}

// ── Webhook Types ────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  route: string;
  file: string;
  signing?: string;
  events: WebhookEvent[];
  unhandledEvents?: string[];
}

export interface WebhookEvent {
  type: string;
  requiredFields: string[];
  stateTransition?: string;
  handlerLocation: string;
}

export interface WebhookDiscovery {
  endpoints: WebhookEndpoint[];
  timestamp: number;
}

export interface WebhookFireResult {
  status: number;
  responseBody: string;
  duration: number;
  uiVerification?: {
    matched: boolean;
    actual?: string;
    selector: string;
    expected: string;
  };
  networkEffects?: { url: string; method: string; status: number }[];
}

export interface WebhookConfig {
  signingSecrets?: Record<string, string>;
  baseUrl: string;
}

// ── Learning Types ───────────────────────────────────────────────────────────

export interface AppPage {
  path: string;
  label?: string;
  auth?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AppConfig {
  name?: string;
  baseUrl: string;
  description?: string;
  pages?: AppPage[];
  ignorePatterns?: string[];
}

export interface LearningConfig {
  enabled: boolean;
}

export interface SessionHistoryEntry {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  stepCount: number;
  bugCount: number;
  findingCount: number;
  errorCount: number;
  urlsCovered: string[];
  actionTypes: Record<string, number>;
  contexts?: string[];
}

export interface BugLedgerEntry {
  bugId: string;
  sessionId: string;
  title: string;
  severity: BugSeverity;
  url?: string;
  timestamp: number;
  contextId?: string;
  fingerprint: string;
}

export interface SessionComparison {
  sessionA: string;
  sessionB: string;
  onlyInA: { urls: string[]; actionTypes: string[] };
  onlyInB: { urls: string[]; actionTypes: string[] };
  common: { urls: string[]; actionTypes: string[] };
  bugDiff: { newInB: string[]; fixedInB: string[]; persistent: string[] };
}

export interface WsMessage {
  type: SessionEventType;
  sessionId: string;
  timestamp: number;
  data: unknown;
}

export interface SessionListItem {
  id: string;
  startTime: number;
  endTime?: number;
  duration: number;
  stepCount: number;
  bugCount: number;
  findingCount: number;
  status: 'active' | 'completed';
}
