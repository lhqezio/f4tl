import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BrowserAction,
  F4tlConfig,
  Session,
  SessionConfig,
  SessionEvent,
  SessionEventType,
  SessionStep,
  StepMetadata,
} from '../types/index.js';

export class SessionManager {
  private session: Session | null = null;
  private emitter = new EventEmitter();
  private contextsSeen = new Set<string>();

  constructor(private config: SessionConfig) {}

  on(type: SessionEventType, listener: (event: SessionEvent) => void): void {
    this.emitter.on(type, listener);
  }

  off(type: SessionEventType, listener: (event: SessionEvent) => void): void {
    this.emitter.off(type, listener);
  }

  private emit<T>(type: SessionEventType, data: T): void {
    if (!this.session) return;
    const event: SessionEvent<T> = {
      type,
      sessionId: this.session.id,
      timestamp: Date.now(),
      data,
    };
    this.emitter.emit(type, event);
  }

  startSession(fullConfig: F4tlConfig): string {
    const id = nanoid(12);
    this.contextsSeen.clear();
    this.session = {
      id,
      startTime: Date.now(),
      steps: [],
      config: fullConfig,
    };
    console.error(`[f4tl] Session ${id} started`);
    this.emit('session:start', { sessionId: id });
    return id;
  }

  async recordStep(
    action: BrowserAction,
    screenshot: string,
    metadata: StepMetadata,
    duration: number,
    error?: string,
    contextId?: string,
  ): Promise<SessionStep> {
    if (!this.session) {
      throw new Error('No active session. Call startSession() first.');
    }
    if (this.session.steps.length >= this.config.maxSteps) {
      throw new Error(`Session step limit reached (${this.config.maxSteps})`);
    }

    if (contextId) {
      this.contextsSeen.add(contextId);
    }

    const step: SessionStep = {
      id: nanoid(10),
      ...(contextId ? { contextId } : {}),
      action,
      screenshot,
      metadata,
      duration,
      error,
    };

    this.session.steps.push(step);

    if (this.config.keepArtifacts) {
      await this.saveStepArtifact(step).catch((err) =>
        console.error('[f4tl] Failed to save step artifact:', err),
      );
    }

    // Emit without screenshot for WS efficiency
    this.emit('step:recorded', {
      step: { ...step, screenshot: undefined },
      stepIndex: this.session.steps.length - 1,
    });

    return step;
  }

  private async saveStepArtifact(step: SessionStep): Promise<void> {
    if (!this.session) return;

    const dir = join(this.config.outputDir, this.session.id);
    await mkdir(dir, { recursive: true });

    // Save screenshot
    if (step.screenshot) {
      const screenshotPath = join(dir, `${step.id}.png`);
      await writeFile(screenshotPath, Buffer.from(step.screenshot, 'base64'));
    }

    // Save metadata
    const metaPath = join(dir, `${step.id}.json`);
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          id: step.id,
          ...(step.contextId ? { contextId: step.contextId } : {}),
          action: step.action,
          metadata: step.metadata,
          duration: step.duration,
          error: step.error,
        },
        null,
        2,
      ),
    );
  }

  async endSession(): Promise<Session> {
    if (!this.session) throw new Error('No active session');

    this.session.endTime = Date.now();

    if (this.contextsSeen.size > 0) {
      this.session.contexts = [...this.contextsSeen];
    }

    this.emit('session:end', {
      sessionId: this.session.id,
      stepCount: this.session.steps.length,
      duration: this.session.endTime - this.session.startTime,
    });

    if (this.config.keepArtifacts) {
      const dir = join(this.config.outputDir, this.session.id);
      await mkdir(dir, { recursive: true });
      const summaryPath = join(dir, 'session.json');
      // Write summary without step screenshots to keep file manageable
      const summary = {
        ...this.session,
        steps: this.session.steps.map(({ screenshot: _, ...rest }) => rest),
      };
      await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    }

    const completed = this.session;
    this.session = null;
    console.error(`[f4tl] Session ${completed.id} ended. Steps: ${completed.steps.length}`);
    return completed;
  }

  getSession(): Session | null {
    return this.session;
  }

  getCurrentStepCount(): number {
    return this.session?.steps.length ?? 0;
  }
}
