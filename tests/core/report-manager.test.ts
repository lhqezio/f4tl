import type { Session, SessionEvent, F4tlConfig, SessionStep } from '../../src/types/index.js';

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-id-001'),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/report/markdown.js', () => ({
  generate: vi.fn().mockResolvedValue('# Report'),
}));

vi.mock('../../src/report/json.js', () => ({
  generate: vi.fn().mockResolvedValue('{}'),
}));

vi.mock('../../src/report/html.js', () => ({
  generate: vi.fn().mockResolvedValue('<html></html>'),
}));

import { nanoid } from 'nanoid';
import { mkdir, writeFile } from 'node:fs/promises';
import { ReportManager } from '../../src/core/report-manager.js';

const mockedNanoid = vi.mocked(nanoid);
const mockedMkdir = vi.mocked(mkdir);
const mockedWriteFile = vi.mocked(writeFile);

function createMockSession(overrides?: Partial<Session>): Session {
  const startTime = 1700000000000;
  const endTime = 1700000060000;
  return {
    id: 'session-abc',
    startTime,
    endTime,
    steps: [],
    config: {
      browser: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        slowMo: 0,
        timeout: 30_000,
        devtools: false,
        args: [],
      },
      session: {
        outputDir: '/tmp/sessions',
        maxSteps: 1000,
        keepArtifacts: false,
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
        projectRoot: '/tmp',
        excludePatterns: [],
      },
      report: {
        outputDir: '/tmp/reports',
      },
      dashboard: {
        port: 4173,
        host: 'localhost',
      },
    } as F4tlConfig,
    ...overrides,
  };
}

function createMockStep(overrides?: Partial<SessionStep>): SessionStep {
  return {
    id: 'step-001',
    action: { type: 'click', params: { selector: '#btn' }, timestamp: Date.now() },
    screenshot: 'base64data',
    metadata: {
      url: 'https://example.com',
      title: 'Test',
      viewport: { width: 1280, height: 720 },
      consoleErrors: [],
      networkErrors: [],
    },
    duration: 100,
    ...overrides,
  };
}

describe('ReportManager', () => {
  let manager: ReportManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedNanoid.mockReturnValue('mock-id-001');
    manager = new ReportManager({ outputDir: '/tmp/test-reports' });
  });

  describe('createBug', () => {
    it('assigns ID and timestamp, stores bug', () => {
      const bug = manager.createBug({
        title: 'Button is broken',
        severity: 'critical',
        stepsToReproduce: ['Click button'],
        expected: 'Button works',
        actual: 'Button does nothing',
        evidenceStepIds: ['step-1'],
      });

      expect(bug.id).toBe('mock-id-001');
      expect(bug.timestamp).toBeGreaterThan(0);
      expect(bug.title).toBe('Button is broken');
      expect(bug.severity).toBe('critical');
      expect(manager.getBugs()).toHaveLength(1);
    });
  });

  describe('addFinding', () => {
    it('assigns ID and timestamp, stores finding', () => {
      const finding = manager.addFinding({
        title: 'Slow page load',
        category: 'performance',
        description: 'Page takes 5s to load',
        evidenceStepIds: ['step-1'],
      });

      expect(finding.id).toBe('mock-id-001');
      expect(finding.timestamp).toBeGreaterThan(0);
      expect(finding.title).toBe('Slow page load');
      expect(finding.category).toBe('performance');
      expect(manager.getFindings()).toHaveLength(1);
    });
  });

  describe('contextId support', () => {
    it('createBug stores contextId when provided', () => {
      const bug = manager.createBug({
        title: 'Multi-actor bug',
        severity: 'major',
        stepsToReproduce: ['Step 1'],
        expected: 'Works',
        actual: 'Broken',
        evidenceStepIds: [],
        contextId: 'seller',
      });
      expect(bug.contextId).toBe('seller');
    });

    it('createBug omits contextId when not provided', () => {
      const bug = manager.createBug({
        title: 'Single-context bug',
        severity: 'minor',
        stepsToReproduce: [],
        expected: '',
        actual: '',
        evidenceStepIds: [],
      });
      expect(bug.contextId).toBeUndefined();
    });

    it('addFinding stores contextId when provided', () => {
      const finding = manager.addFinding({
        title: 'Actor-specific finding',
        category: 'usability',
        description: 'From buyer perspective',
        evidenceStepIds: [],
        contextId: 'buyer',
      });
      expect(finding.contextId).toBe('buyer');
    });

    it('getSummary includes stepsByContext for multi-context sessions', () => {
      const steps = [
        createMockStep({ id: 's1', contextId: 'buyer' }),
        createMockStep({ id: 's2', contextId: 'seller' }),
        createMockStep({ id: 's3', contextId: 'buyer' }),
      ];
      const session = createMockSession({ steps, contexts: ['buyer', 'seller'] });
      const summary = manager.getSummary(session);

      expect(summary.stepsByContext).toEqual({ buyer: 2, seller: 1 });
      expect(summary.contexts).toEqual(['buyer', 'seller']);
    });

    it('getSummary omits stepsByContext for single-context sessions', () => {
      const steps = [createMockStep({ id: 's1' }), createMockStep({ id: 's2' })];
      const session = createMockSession({ steps });
      const summary = manager.getSummary(session);

      expect(summary.stepsByContext).toBeUndefined();
      expect(summary.contexts).toBeUndefined();
    });
  });

  describe('getBugs / getFindings', () => {
    it('getBugs returns a copy, not the same reference', () => {
      manager.createBug({
        title: 'Bug 1',
        severity: 'minor',
        stepsToReproduce: [],
        expected: '',
        actual: '',
        evidenceStepIds: [],
      });

      const bugs1 = manager.getBugs();
      const bugs2 = manager.getBugs();
      expect(bugs1).toEqual(bugs2);
      expect(bugs1).not.toBe(bugs2);
    });

    it('getFindings returns a copy, not the same reference', () => {
      manager.addFinding({
        title: 'Finding 1',
        category: 'usability',
        description: 'desc',
        evidenceStepIds: [],
      });

      const findings1 = manager.getFindings();
      const findings2 = manager.getFindings();
      expect(findings1).toEqual(findings2);
      expect(findings1).not.toBe(findings2);
    });
  });

  describe('getSummary', () => {
    it('returns all zeroes with zero bugs and findings', () => {
      const session = createMockSession();
      const summary = manager.getSummary(session);

      expect(summary.sessionId).toBe('session-abc');
      expect(summary.bugCount).toBe(0);
      expect(summary.findingCount).toBe(0);
      expect(summary.stepCount).toBe(0);
      expect(summary.errorStepCount).toBe(0);
      expect(summary.bugsBySeverity.critical).toBe(0);
      expect(summary.bugsBySeverity.major).toBe(0);
      expect(summary.bugsBySeverity.minor).toBe(0);
      expect(summary.bugsBySeverity.cosmetic).toBe(0);
      expect(summary.findingsByCategory.usability).toBe(0);
      expect(summary.findingsByCategory.performance).toBe(0);
      expect(summary.findingsByCategory.accessibility).toBe(0);
      expect(summary.findingsByCategory.security).toBe(0);
      expect(summary.findingsByCategory.suggestion).toBe(0);
      expect(summary.findingsByCategory.observation).toBe(0);
    });

    it('tallies bugsBySeverity correctly', () => {
      manager.createBug({
        title: 'Critical bug',
        severity: 'critical',
        stepsToReproduce: [],
        expected: '',
        actual: '',
        evidenceStepIds: [],
      });
      manager.createBug({
        title: 'Minor bug',
        severity: 'minor',
        stepsToReproduce: [],
        expected: '',
        actual: '',
        evidenceStepIds: [],
      });

      const session = createMockSession();
      const summary = manager.getSummary(session);

      expect(summary.bugCount).toBe(2);
      expect(summary.bugsBySeverity.critical).toBe(1);
      expect(summary.bugsBySeverity.minor).toBe(1);
      expect(summary.bugsBySeverity.major).toBe(0);
      expect(summary.bugsBySeverity.cosmetic).toBe(0);
    });

    it('tallies findingsByCategory correctly', () => {
      manager.addFinding({
        title: 'Usability issue',
        category: 'usability',
        description: 'Hard to use',
        evidenceStepIds: [],
      });
      manager.addFinding({
        title: 'Security concern',
        category: 'security',
        description: 'XSS possible',
        evidenceStepIds: [],
      });
      manager.addFinding({
        title: 'Another usability issue',
        category: 'usability',
        description: 'Confusing label',
        evidenceStepIds: [],
      });

      const session = createMockSession();
      const summary = manager.getSummary(session);

      expect(summary.findingCount).toBe(3);
      expect(summary.findingsByCategory.usability).toBe(2);
      expect(summary.findingsByCategory.security).toBe(1);
      expect(summary.findingsByCategory.performance).toBe(0);
    });

    it('counts error steps', () => {
      const steps: SessionStep[] = [
        createMockStep({ id: 's1', error: undefined }),
        createMockStep({ id: 's2', error: 'Timeout' }),
        createMockStep({ id: 's3', error: 'Element not found' }),
      ];
      const session = createMockSession({ steps });
      const summary = manager.getSummary(session);

      expect(summary.errorStepCount).toBe(2);
      expect(summary.stepCount).toBe(3);
    });

    it('computes duration from session times', () => {
      const session = createMockSession({
        startTime: 1700000000000,
        endTime: 1700000060000,
      });
      const summary = manager.getSummary(session);
      expect(summary.duration).toBe(60000);
    });

    it('uses current time as fallback when endTime is undefined', () => {
      const now = Date.now();
      const session = createMockSession({
        startTime: now - 5000,
        endTime: undefined,
      });
      const summary = manager.getSummary(session);
      // Duration should be approximately 5000ms (within a small margin)
      expect(summary.duration).toBeGreaterThanOrEqual(5000);
      expect(summary.duration).toBeLessThan(6000);
    });
  });

  describe('generateReport', () => {
    it('writes file with .md extension for markdown format', async () => {
      const session = createMockSession();
      const resolver = vi.fn().mockResolvedValue(null);

      const outputPath = await manager.generateReport(session, 'markdown', resolver);

      expect(outputPath).toContain('report-session-abc.md');
      expect(mockedMkdir).toHaveBeenCalledWith('/tmp/test-reports', { recursive: true });
      expect(mockedWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('report-session-abc.md'),
        '# Report',
      );
    });

    it('writes file with .json extension for json format', async () => {
      const session = createMockSession();
      const resolver = vi.fn().mockResolvedValue(null);

      const outputPath = await manager.generateReport(session, 'json', resolver);

      expect(outputPath).toContain('report-session-abc.json');
    });

    it('writes file with .html extension for html format', async () => {
      const session = createMockSession();
      const resolver = vi.fn().mockResolvedValue(null);

      const outputPath = await manager.generateReport(session, 'html', resolver);

      expect(outputPath).toContain('report-session-abc.html');
    });
  });

  describe('reset', () => {
    it('clears bugs, findings, and sessionId', () => {
      manager.setSessionId('some-session');
      manager.createBug({
        title: 'Bug',
        severity: 'major',
        stepsToReproduce: [],
        expected: '',
        actual: '',
        evidenceStepIds: [],
      });
      manager.addFinding({
        title: 'Finding',
        category: 'observation',
        description: '',
        evidenceStepIds: [],
      });

      manager.reset();

      expect(manager.getBugs()).toHaveLength(0);
      expect(manager.getFindings()).toHaveLength(0);

      // Verify sessionId was cleared by checking emitted event has empty sessionId
      const listener = vi.fn();
      manager.on('bug:created', listener);
      manager.createBug({
        title: 'New bug',
        severity: 'minor',
        stepsToReproduce: [],
        expected: '',
        actual: '',
        evidenceStepIds: [],
      });
      const event: SessionEvent = listener.mock.calls[0][0];
      expect(event.sessionId).toBe('');
    });
  });

  describe('events', () => {
    it('emits bug:created with bug data', () => {
      const listener = vi.fn();
      manager.setSessionId('evt-session');
      manager.on('bug:created', listener);

      const bug = manager.createBug({
        title: 'Event bug',
        severity: 'major',
        stepsToReproduce: ['Step 1'],
        expected: 'Works',
        actual: 'Broken',
        evidenceStepIds: ['s1'],
      });

      expect(listener).toHaveBeenCalledOnce();
      const event: SessionEvent = listener.mock.calls[0][0];
      expect(event.type).toBe('bug:created');
      expect(event.sessionId).toBe('evt-session');
      expect((event.data as any).bug).toEqual(bug);
    });

    it('emits finding:created with finding data', () => {
      const listener = vi.fn();
      manager.setSessionId('evt-session');
      manager.on('finding:created', listener);

      const finding = manager.addFinding({
        title: 'Event finding',
        category: 'accessibility',
        description: 'Missing alt text',
        evidenceStepIds: ['s2'],
      });

      expect(listener).toHaveBeenCalledOnce();
      const event: SessionEvent = listener.mock.calls[0][0];
      expect(event.type).toBe('finding:created');
      expect(event.sessionId).toBe('evt-session');
      expect((event.data as any).finding).toEqual(finding);
    });
  });
});
