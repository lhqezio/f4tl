import { SessionManager } from '../../src/core/session-manager.js';
import { ReportManager } from '../../src/core/report-manager.js';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BrowserAction, F4tlConfig, StepMetadata } from '../../src/types/index.js';

// -- Helpers ------------------------------------------------------------------

/** A tiny 1x1 red PNG encoded as base64 (valid PNG file). */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

function makeAction(
  type: BrowserAction['type'] = 'navigate',
  params: Record<string, unknown> = {},
): BrowserAction {
  return { type, params, timestamp: Date.now() };
}

function makeMetadata(overrides: Partial<StepMetadata> = {}): StepMetadata {
  return {
    url: 'http://localhost:3000/',
    title: 'Test Page',
    viewport: { width: 1280, height: 720 },
    consoleErrors: [],
    networkErrors: [],
    ...overrides,
  };
}

function makeConfig(outputDir: string): F4tlConfig {
  return {
    browser: {
      headless: true,
      viewport: { width: 1280, height: 720 },
      slowMo: 0,
      timeout: 15_000,
      devtools: false,
      args: [],
    },
    session: {
      outputDir,
      maxSteps: 1000,
      keepArtifacts: true,
    },
    capture: {
      format: 'png',
      quality: 90,
      fullPage: false,
      animations: 'disabled',
    },
    mcp: {
      name: 'f4tl',
      version: '0.1.0',
      logLevel: 'info',
    },
    codebase: {
      projectRoot: '.',
      excludePatterns: ['node_modules', '.git', 'dist'],
    },
    report: {
      outputDir,
    },
    dashboard: {
      port: 4173,
      host: 'localhost',
    },
  };
}

// -- Test Suite ----------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = join(tmpdir(), `f4tl-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});

describe('session flow', () => {
  it('starts a session, records a step, and ends with session.json on disk', async () => {
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: true,
    });

    const config = makeConfig(tempDir);
    const sessionId = sm.startSession(config);
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe('string');

    await sm.recordStep(makeAction(), TINY_PNG_BASE64, makeMetadata(), 150);

    const session = await sm.endSession();
    expect(session.id).toBe(sessionId);
    expect(session.steps).toHaveLength(1);
    expect(session.endTime).toBeDefined();

    // session.json should exist on disk
    const sessionJsonPath = join(tempDir, sessionId, 'session.json');
    const raw = await readFile(sessionJsonPath, 'utf-8');
    const onDisk = JSON.parse(raw);
    expect(onDisk.id).toBe(sessionId);
    expect(onDisk.steps).toHaveLength(1);
  });

  it('saves step artifacts (PNG + metadata JSON) when keepArtifacts is true', async () => {
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: true,
    });

    const config = makeConfig(tempDir);
    const sessionId = sm.startSession(config);
    const step = await sm.recordStep(
      makeAction('click', { selector: '#btn' }),
      TINY_PNG_BASE64,
      makeMetadata(),
      200,
    );

    const sessionDir = join(tempDir, sessionId);

    // Screenshot file
    const pngPath = join(sessionDir, `${step.id}.png`);
    const pngBuf = await readFile(pngPath);
    expect(pngBuf.length).toBeGreaterThan(0);
    // Verify PNG magic bytes
    expect(pngBuf[0]).toBe(0x89);
    expect(pngBuf[1]).toBe(0x50);

    // Metadata JSON file
    const metaPath = join(sessionDir, `${step.id}.json`);
    const metaRaw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    expect(meta.id).toBe(step.id);
    expect(meta.action.type).toBe('click');
    expect(meta.duration).toBe(200);

    await sm.endSession();
  });

  it('multi-context session persists contextId to disk', async () => {
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: true,
    });

    const config = makeConfig(tempDir);
    const sessionId = sm.startSession(config);

    await sm.recordStep(
      makeAction('navigate', { url: '/' }),
      TINY_PNG_BASE64,
      makeMetadata(),
      100,
      undefined,
      'buyer',
    );
    await sm.recordStep(
      makeAction('click', { selector: '#accept' }),
      TINY_PNG_BASE64,
      makeMetadata(),
      80,
      undefined,
      'seller',
    );
    await sm.recordStep(
      makeAction('click', { selector: '#pay' }),
      TINY_PNG_BASE64,
      makeMetadata(),
      90,
      undefined,
      'buyer',
    );

    const session = await sm.endSession();
    expect(session.contexts).toEqual(expect.arrayContaining(['buyer', 'seller']));
    expect(session.contexts).toHaveLength(2);
    expect(session.steps[0].contextId).toBe('buyer');
    expect(session.steps[1].contextId).toBe('seller');
    expect(session.steps[2].contextId).toBe('buyer');

    // Verify session.json on disk includes contexts
    const sessionJsonPath = join(tempDir, sessionId, 'session.json');
    const raw = await readFile(sessionJsonPath, 'utf-8');
    const onDisk = JSON.parse(raw);
    expect(onDisk.contexts).toEqual(expect.arrayContaining(['buyer', 'seller']));

    // Verify step artifact JSON includes contextId
    const stepJsonPath = join(tempDir, sessionId, `${session.steps[0].id}.json`);
    const stepRaw = await readFile(stepJsonPath, 'utf-8');
    const stepOnDisk = JSON.parse(stepRaw);
    expect(stepOnDisk.contextId).toBe('buyer');
  });

  it('records multiple steps and endSession returns all of them', async () => {
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: false,
    });

    sm.startSession(makeConfig(tempDir));

    await sm.recordStep(makeAction('navigate', { url: '/' }), TINY_PNG_BASE64, makeMetadata(), 100);
    await sm.recordStep(
      makeAction('click', { selector: 'a' }),
      TINY_PNG_BASE64,
      makeMetadata({ url: '/form' }),
      50,
    );
    await sm.recordStep(
      makeAction('fill', { selector: '#name', value: 'test' }),
      TINY_PNG_BASE64,
      makeMetadata({ url: '/form' }),
      30,
    );

    const session = await sm.endSession();
    expect(session.steps).toHaveLength(3);
    expect(session.steps[0].action.type).toBe('navigate');
    expect(session.steps[1].action.type).toBe('click');
    expect(session.steps[2].action.type).toBe('fill');
  });
});

describe('report flow', () => {
  it('generates a markdown report file on disk', async () => {
    const rm_ = new ReportManager({ outputDir: tempDir });
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: false,
    });

    const sessionId = sm.startSession(makeConfig(tempDir));
    rm_.setSessionId(sessionId);

    await sm.recordStep(makeAction(), TINY_PNG_BASE64, makeMetadata(), 100);

    rm_.createBug({
      title: 'Button not clickable',
      severity: 'major',
      stepsToReproduce: ['Navigate to /form', 'Click submit without filling fields'],
      expected: 'Validation message shown',
      actual: 'Nothing happens',
      evidenceStepIds: [],
      url: 'http://localhost/form',
    });

    rm_.addFinding({
      title: 'Missing alt text on logo',
      category: 'accessibility',
      description: 'The logo image does not have an alt attribute.',
      evidenceStepIds: [],
      url: 'http://localhost/',
    });

    const session = await sm.endSession();
    const screenshotResolver = async () => null;
    const outputPath = await rm_.generateReport(session, 'markdown', screenshotResolver);

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('# QA Report');
    expect(content).toContain('Button not clickable');
    expect(content).toContain('Missing alt text on logo');
  });

  it('generates a valid JSON report file', async () => {
    const rm_ = new ReportManager({ outputDir: tempDir });
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: false,
    });

    const sessionId = sm.startSession(makeConfig(tempDir));
    rm_.setSessionId(sessionId);

    await sm.recordStep(makeAction(), TINY_PNG_BASE64, makeMetadata(), 80);

    rm_.createBug({
      title: 'Crash on submit',
      severity: 'critical',
      stepsToReproduce: ['Click submit'],
      expected: 'Form submitted',
      actual: 'Page crashes',
      evidenceStepIds: [],
    });

    const session = await sm.endSession();
    const outputPath = await rm_.generateReport(session, 'json', async () => null);

    const raw = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.bugs).toHaveLength(1);
    expect(parsed.bugs[0].title).toBe('Crash on submit');
    expect(parsed.summary.bugCount).toBe(1);
    expect(parsed.summary.sessionId).toBe(sessionId);
  });

  it('generates an HTML report that contains DOCTYPE', async () => {
    const rm_ = new ReportManager({ outputDir: tempDir });
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: false,
    });

    const sessionId = sm.startSession(makeConfig(tempDir));
    rm_.setSessionId(sessionId);

    await sm.recordStep(makeAction(), TINY_PNG_BASE64, makeMetadata(), 60);

    const session = await sm.endSession();
    const outputPath = await rm_.generateReport(session, 'html', async () => null);

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('QA Report');
    expect(content).toContain(sessionId);
  });

  it('produces correct summary counts after creating bugs and findings', async () => {
    const rm_ = new ReportManager({ outputDir: tempDir });
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: false,
    });

    const sessionId = sm.startSession(makeConfig(tempDir));
    rm_.setSessionId(sessionId);

    await sm.recordStep(makeAction(), TINY_PNG_BASE64, makeMetadata(), 50);
    await sm.recordStep(makeAction('click'), TINY_PNG_BASE64, makeMetadata(), 40, 'click failed');

    rm_.createBug({
      title: 'Bug A',
      severity: 'critical',
      stepsToReproduce: ['Step 1'],
      expected: 'Works',
      actual: 'Broken',
      evidenceStepIds: [],
    });

    rm_.createBug({
      title: 'Bug B',
      severity: 'minor',
      stepsToReproduce: ['Step 1'],
      expected: 'Works',
      actual: 'Minor issue',
      evidenceStepIds: [],
    });

    rm_.addFinding({
      title: 'Finding A',
      category: 'performance',
      description: 'Slow load time detected.',
      evidenceStepIds: [],
    });

    const session = await sm.endSession();
    const summary = rm_.getSummary(session);

    expect(summary.sessionId).toBe(sessionId);
    expect(summary.bugCount).toBe(2);
    expect(summary.findingCount).toBe(1);
    expect(summary.stepCount).toBe(2);
    expect(summary.errorStepCount).toBe(1);
    expect(summary.bugsBySeverity.critical).toBe(1);
    expect(summary.bugsBySeverity.minor).toBe(1);
    expect(summary.bugsBySeverity.major).toBe(0);
    expect(summary.findingsByCategory.performance).toBe(1);
    expect(summary.findingsByCategory.usability).toBe(0);
  });

  it('report output files exist on disk with correct extensions', async () => {
    const rm_ = new ReportManager({ outputDir: tempDir });
    const sm = new SessionManager({
      outputDir: tempDir,
      maxSteps: 100,
      keepArtifacts: false,
    });

    const sessionId = sm.startSession(makeConfig(tempDir));
    rm_.setSessionId(sessionId);
    await sm.recordStep(makeAction(), TINY_PNG_BASE64, makeMetadata(), 50);
    const session = await sm.endSession();

    const mdPath = await rm_.generateReport(session, 'markdown', async () => null);
    const jsonPath = await rm_.generateReport(session, 'json', async () => null);
    const htmlPath = await rm_.generateReport(session, 'html', async () => null);

    expect(mdPath).toMatch(/\.md$/);
    expect(jsonPath).toMatch(/\.json$/);
    expect(htmlPath).toMatch(/\.html$/);

    // All files should exist and be non-empty
    const mdContent = await readFile(mdPath, 'utf-8');
    const jsonContent = await readFile(jsonPath, 'utf-8');
    const htmlContent = await readFile(htmlPath, 'utf-8');

    expect(mdContent.length).toBeGreaterThan(0);
    expect(jsonContent.length).toBeGreaterThan(0);
    expect(htmlContent.length).toBeGreaterThan(0);
  });

  it('getBugs and getFindings return copies of the internal arrays', () => {
    const rm_ = new ReportManager({ outputDir: tempDir });

    rm_.createBug({
      title: 'Bug 1',
      severity: 'major',
      stepsToReproduce: ['Do X'],
      expected: 'Y',
      actual: 'Z',
      evidenceStepIds: [],
    });

    rm_.addFinding({
      title: 'Finding 1',
      category: 'usability',
      description: 'UX issue',
      evidenceStepIds: [],
    });

    const bugs = rm_.getBugs();
    const findings = rm_.getFindings();

    expect(bugs).toHaveLength(1);
    expect(findings).toHaveLength(1);

    // Mutating the returned arrays should not affect the internal state
    bugs.pop();
    findings.pop();

    expect(rm_.getBugs()).toHaveLength(1);
    expect(rm_.getFindings()).toHaveLength(1);
  });

  it('reset clears all bugs and findings', () => {
    const rm_ = new ReportManager({ outputDir: tempDir });

    rm_.createBug({
      title: 'Bug to clear',
      severity: 'cosmetic',
      stepsToReproduce: ['Step'],
      expected: 'A',
      actual: 'B',
      evidenceStepIds: [],
    });

    rm_.addFinding({
      title: 'Finding to clear',
      category: 'observation',
      description: 'Just noting it.',
      evidenceStepIds: [],
    });

    expect(rm_.getBugs()).toHaveLength(1);
    expect(rm_.getFindings()).toHaveLength(1);

    rm_.reset();

    expect(rm_.getBugs()).toHaveLength(0);
    expect(rm_.getFindings()).toHaveLength(0);
  });
});
