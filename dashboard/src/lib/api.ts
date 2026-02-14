const BASE = '/api';

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

export interface SessionStep {
  id: string;
  contextId?: string;
  action: { type: string; [key: string]: unknown };
  metadata: { url: string; consoleErrors: string[]; networkErrors: string[] };
  duration: number;
  error?: string;
}

export interface Bug {
  id: string;
  contextId?: string;
  title: string;
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  stepsToReproduce: string[];
  expected: string;
  actual: string;
  rootCause?: string;
  evidenceStepIds: string[];
  url?: string;
  timestamp: number;
}

export interface Finding {
  id: string;
  contextId?: string;
  title: string;
  category: string;
  description: string;
  evidenceStepIds: string[];
  url?: string;
  timestamp: number;
}

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  stepCount: number;
  bugCount: number;
  findingCount: number;
  bugsBySeverity: Record<string, number>;
  findingsByCategory: Record<string, number>;
  errorStepCount: number;
  contexts?: string[];
  stepsByContext?: Record<string, number>;
}

export interface SessionDetail {
  id: string;
  startTime: number;
  endTime?: number;
  steps: SessionStep[];
  bugs?: Bug[];
  findings?: Finding[];
  summary?: SessionSummary;
}

export interface LiveSessionData {
  session: { id: string; startTime: number; steps: SessionStep[] };
  bugs: Bug[];
  findings: Finding[];
  summary: SessionSummary | null;
}

export async function fetchSessions(): Promise<SessionListItem[]> {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`${BASE}/sessions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

export async function fetchLiveSession(): Promise<LiveSessionData> {
  const res = await fetch(`${BASE}/live/session`);
  if (!res.ok) throw new Error('No active session');
  return res.json();
}

export function screenshotUrl(sessionId: string, stepId: string): string {
  return `${BASE}/sessions/${sessionId}/steps/${stepId}/screenshot`;
}

// ── History / Learning Types ─────────────────────────────────────────────────

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
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
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

export async function fetchHistory(opts?: {
  limit?: number;
  since?: number;
  groupBy?: string;
}): Promise<SessionHistoryEntry[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.since) params.set('since', String(opts.since));
  if (opts?.groupBy) params.set('groupBy', opts.groupBy);
  const qs = params.toString();
  const res = await fetch(`${BASE}/history${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchBugLedger(opts?: {
  severity?: string;
  url?: string;
  limit?: number;
}): Promise<BugLedgerEntry[]> {
  const params = new URLSearchParams();
  if (opts?.severity) params.set('severity', opts.severity);
  if (opts?.url) params.set('url', opts.url);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`${BASE}/history/bugs${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch bug ledger');
  return res.json();
}

export async function fetchComparison(a: string, b: string): Promise<SessionComparison> {
  const res = await fetch(
    `${BASE}/history/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
  );
  if (!res.ok) throw new Error('Failed to fetch comparison');
  return res.json();
}

// ── Config Types ─────────────────────────────────────────────────────────────

export interface ConfigFeatures {
  auth: boolean;
  logs: boolean;
  database: boolean;
  webhooks: boolean;
  journeys: boolean;
  appProfile: boolean;
  learning: boolean;
}

export interface ConfigResponse {
  config: Record<string, unknown>;
  features: ConfigFeatures;
  detectedFramework: string | null;
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

// ── Agent Types ──────────────────────────────────────────────────────────────

export interface AgentStatus {
  available: boolean;
  running: boolean;
  currentGoal?: string;
  turnNumber?: number;
  maxTurns?: number;
}

export interface AgentConfigResponse {
  apiKeyConfigured: boolean;
  defaultModel: string;
  defaultMaxTurns: number;
  models: string[];
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const res = await fetch(`${BASE}/agent/status`);
  if (!res.ok) throw new Error('Failed to fetch agent status');
  return res.json();
}

export async function fetchAgentConfig(): Promise<AgentConfigResponse> {
  const res = await fetch(`${BASE}/agent/config`);
  if (!res.ok) throw new Error('Failed to fetch agent config');
  return res.json();
}

export async function startAgent(
  goal: string,
  opts?: { model?: string; maxTurns?: number },
): Promise<{ started: boolean; goal: string }> {
  const res = await fetch(`${BASE}/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, ...opts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to start agent' }));
    throw new Error(err.error || 'Failed to start agent');
  }
  return res.json();
}

export async function cancelAgent(): Promise<{ cancelled: boolean }> {
  const res = await fetch(`${BASE}/agent/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel agent');
  return res.json();
}
