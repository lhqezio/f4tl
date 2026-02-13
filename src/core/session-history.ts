import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type {
  BugSeverity,
  SessionHistoryEntry,
  BugLedgerEntry,
  SessionComparison,
} from '../types/index.js';

interface SessionJson {
  id: string;
  startTime: number;
  endTime?: number;
  steps: {
    action: { type: string };
    metadata: { url: string };
    error?: string;
    contextId?: string;
  }[];
  contexts?: string[];
}

interface ReportJson {
  bugs?: {
    id: string;
    title: string;
    severity: BugSeverity;
    url?: string;
    timestamp: number;
    contextId?: string;
  }[];
  findings?: { id: string }[];
}

function bugFingerprint(title: string, severity: string, url?: string): string {
  const raw = `${title}|${severity}|${url ?? ''}`.toLowerCase();
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export class SessionHistory {
  constructor(private outputDir: string) {}

  async getHistory(opts?: { limit?: number; since?: number }): Promise<SessionHistoryEntry[]> {
    const limit = opts?.limit ?? 20;
    const since = opts?.since ?? 0;
    const entries: SessionHistoryEntry[] = [];

    let dirs: string[];
    try {
      dirs = await readdir(this.outputDir);
    } catch {
      return [];
    }

    for (const dir of dirs) {
      const sessionPath = join(this.outputDir, dir, 'session.json');
      try {
        const raw = await readFile(sessionPath, 'utf-8');
        const data: SessionJson = JSON.parse(raw);

        if (data.startTime < since) continue;

        const urlsCovered = [...new Set(data.steps.map((s) => s.metadata.url))];
        const actionTypes: Record<string, number> = {};
        let errorCount = 0;

        for (const step of data.steps) {
          actionTypes[step.action.type] = (actionTypes[step.action.type] ?? 0) + 1;
          if (step.error) errorCount++;
        }

        // Try to load report for bug/finding counts
        let bugCount = 0;
        let findingCount = 0;
        try {
          const reportPath = join(this.outputDir, '..', 'reports', `report-${data.id}.json`);
          const reportRaw = await readFile(reportPath, 'utf-8');
          const report: ReportJson = JSON.parse(reportRaw);
          bugCount = report.bugs?.length ?? 0;
          findingCount = report.findings?.length ?? 0;
        } catch {
          // No report file — counts stay 0
        }

        entries.push({
          sessionId: data.id,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: (data.endTime ?? data.startTime) - data.startTime,
          stepCount: data.steps.length,
          bugCount,
          findingCount,
          errorCount,
          urlsCovered,
          actionTypes,
          contexts: data.contexts,
        });
      } catch {
        // Skip invalid session directories
      }
    }

    entries.sort((a, b) => b.startTime - a.startTime);
    return entries.slice(0, limit);
  }

  async getBugLedger(opts?: {
    severity?: BugSeverity;
    url?: string;
    limit?: number;
  }): Promise<BugLedgerEntry[]> {
    const limit = opts?.limit ?? 50;
    const entries: BugLedgerEntry[] = [];

    let dirs: string[];
    try {
      dirs = await readdir(this.outputDir);
    } catch {
      return [];
    }

    for (const dir of dirs) {
      // Try report JSON first
      try {
        const reportPath = join(this.outputDir, '..', 'reports', `report-${dir}.json`);
        const raw = await readFile(reportPath, 'utf-8');
        const report: ReportJson = JSON.parse(raw);

        if (report.bugs) {
          for (const bug of report.bugs) {
            if (opts?.severity && bug.severity !== opts.severity) continue;
            if (opts?.url && bug.url !== opts.url) continue;

            entries.push({
              bugId: bug.id,
              sessionId: dir,
              title: bug.title,
              severity: bug.severity,
              url: bug.url,
              timestamp: bug.timestamp,
              contextId: bug.contextId,
              fingerprint: bugFingerprint(bug.title, bug.severity, bug.url),
            });
          }
        }
      } catch {
        // No report file for this session
      }
    }

    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit);
  }

  async compare(sessionA: string, sessionB: string): Promise<SessionComparison> {
    const loadSession = async (id: string): Promise<SessionJson | null> => {
      try {
        const raw = await readFile(join(this.outputDir, id, 'session.json'), 'utf-8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const a = await loadSession(sessionA);
    const b = await loadSession(sessionB);

    if (!a || !b) {
      throw new Error(`Session not found: ${!a ? sessionA : sessionB}`);
    }

    const urlsA = new Set(a.steps.map((s) => s.metadata.url));
    const urlsB = new Set(b.steps.map((s) => s.metadata.url));
    const actionsA = new Set(a.steps.map((s) => s.action.type));
    const actionsB = new Set(b.steps.map((s) => s.action.type));

    const onlyInAUrls = [...urlsA].filter((u) => !urlsB.has(u));
    const onlyInBUrls = [...urlsB].filter((u) => !urlsA.has(u));
    const commonUrls = [...urlsA].filter((u) => urlsB.has(u));

    const onlyInAActions = [...actionsA].filter((a) => !actionsB.has(a));
    const onlyInBActions = [...actionsB].filter((a) => !actionsA.has(a));
    const commonActions = [...actionsA].filter((a) => actionsB.has(a));

    // Bug comparison via report files
    const loadBugs = async (id: string): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      try {
        const raw = await readFile(
          join(this.outputDir, '..', 'reports', `report-${id}.json`),
          'utf-8',
        );
        const report: ReportJson = JSON.parse(raw);
        for (const bug of report.bugs ?? []) {
          map.set(bugFingerprint(bug.title, bug.severity, bug.url), bug.title);
        }
      } catch {
        // No report
      }
      return map;
    };

    const bugsA = await loadBugs(sessionA);
    const bugsB = await loadBugs(sessionB);

    const newInB = [...bugsB.entries()].filter(([fp]) => !bugsA.has(fp)).map(([, title]) => title);
    const fixedInB = [...bugsA.entries()]
      .filter(([fp]) => !bugsB.has(fp))
      .map(([, title]) => title);
    const persistent = [...bugsA.entries()]
      .filter(([fp]) => bugsB.has(fp))
      .map(([, title]) => title);

    return {
      sessionA,
      sessionB,
      onlyInA: { urls: onlyInAUrls, actionTypes: onlyInAActions },
      onlyInB: { urls: onlyInBUrls, actionTypes: onlyInBActions },
      common: { urls: commonUrls, actionTypes: commonActions },
      bugDiff: { newInB, fixedInB, persistent },
    };
  }
}
