import { EventEmitter } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type {
  Bug,
  BugSeverity,
  Finding,
  FindingCategory,
  ReportConfig,
  ReportData,
  ReportFormat,
  Session,
  SessionEvent,
  SessionEventType,
  SessionSummary,
} from '../types/index.js';

type ScreenshotResolver = (stepId: string) => Promise<string | null>;

export class ReportManager {
  private bugs: Bug[] = [];
  private findings: Finding[] = [];
  private currentSessionId: string | null = null;
  private emitter = new EventEmitter();

  constructor(private config: ReportConfig) {}

  setSessionId(id: string): void {
    this.currentSessionId = id;
  }

  on(type: SessionEventType, listener: (event: SessionEvent) => void): void {
    this.emitter.on(type, listener);
  }

  off(type: SessionEventType, listener: (event: SessionEvent) => void): void {
    this.emitter.off(type, listener);
  }

  private emit<T>(type: SessionEventType, data: T): void {
    const event: SessionEvent<T> = {
      type,
      sessionId: this.currentSessionId ?? '',
      timestamp: Date.now(),
      data,
    };
    this.emitter.emit(type, event);
  }

  createBug(params: Omit<Bug, 'id' | 'timestamp'>): Bug {
    const bug: Bug = {
      ...params,
      id: nanoid(10),
      timestamp: Date.now(),
    };
    this.bugs.push(bug);
    this.emit('bug:created', { bug });
    return bug;
  }

  addFinding(params: Omit<Finding, 'id' | 'timestamp'>): Finding {
    const finding: Finding = {
      ...params,
      id: nanoid(10),
      timestamp: Date.now(),
    };
    this.findings.push(finding);
    this.emit('finding:created', { finding });
    return finding;
  }

  getBugs(): Bug[] {
    return [...this.bugs];
  }

  getFindings(): Finding[] {
    return [...this.findings];
  }

  getSummary(session: Session): SessionSummary {
    const now = Date.now();
    const endTime = session.endTime ?? now;
    const duration = endTime - session.startTime;

    const bugsBySeverity: Record<BugSeverity, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      cosmetic: 0,
    };
    for (const bug of this.bugs) {
      bugsBySeverity[bug.severity]++;
    }

    const findingsByCategory: Record<FindingCategory, number> = {
      usability: 0,
      performance: 0,
      accessibility: 0,
      security: 0,
      suggestion: 0,
      observation: 0,
    };
    for (const finding of this.findings) {
      findingsByCategory[finding.category]++;
    }

    const stepsByContext: Record<string, number> = {};
    for (const step of session.steps) {
      if (step.contextId) {
        stepsByContext[step.contextId] = (stepsByContext[step.contextId] ?? 0) + 1;
      }
    }
    const hasContexts = Object.keys(stepsByContext).length > 0;

    return {
      sessionId: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      duration,
      stepCount: session.steps.length,
      bugCount: this.bugs.length,
      findingCount: this.findings.length,
      bugsBySeverity,
      findingsByCategory,
      errorStepCount: session.steps.filter((s) => s.error).length,
      ...(hasContexts ? { contexts: session.contexts, stepsByContext } : {}),
    };
  }

  async generateReport(
    session: Session,
    format: ReportFormat,
    screenshotResolver: ScreenshotResolver,
  ): Promise<string> {
    const summary = this.getSummary(session);
    const reportData: ReportData = {
      session,
      bugs: this.bugs,
      findings: this.findings,
      generatedAt: Date.now(),
      duration: summary.duration,
      summary,
    };

    const generators: Record<
      ReportFormat,
      () => Promise<{
        generate: (data: ReportData, resolver: ScreenshotResolver) => Promise<string>;
      }>
    > = {
      markdown: () => import('../report/markdown.js'),
      json: () => import('../report/json.js'),
      html: () => import('../report/html.js'),
    };

    const mod = await generators[format]();
    const content = await mod.generate(reportData, screenshotResolver);

    const ext = format === 'markdown' ? 'md' : format;
    const filename = `report-${session.id}.${ext}`;
    await mkdir(this.config.outputDir, { recursive: true });
    const outputPath = join(this.config.outputDir, filename);
    await writeFile(outputPath, content);

    console.error(`[f4tl] Report generated: ${outputPath}`);
    return outputPath;
  }

  reset(): void {
    this.bugs = [];
    this.findings = [];
    this.currentSessionId = null;
  }
}
