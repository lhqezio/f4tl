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
  action: { type: string; [key: string]: unknown };
  metadata: { url: string; consoleErrors: string[]; networkErrors: string[] };
  duration: number;
  error?: string;
}

export interface Bug {
  id: string;
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
