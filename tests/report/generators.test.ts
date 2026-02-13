import { generate as genMarkdown } from '../../src/report/markdown.js';
import { generate as genJson } from '../../src/report/json.js';
import { generate as genHtml } from '../../src/report/html.js';
import type { ReportData, Bug, Finding, Session, SessionSummary } from '../../src/types/index.js';

function buildReportData(): ReportData {
  const session: Session = {
    id: 'test-123',
    startTime: 1700000000000,
    steps: [
      {
        id: 'step-1',
        action: {
          type: 'navigate',
          params: { url: 'https://example.com' },
          timestamp: 1700000000000,
        },
        screenshot: 'SCREENSHOT_DATA_1',
        metadata: {
          url: 'https://example.com',
          title: 'Example',
          viewport: { width: 1280, height: 720 },
          consoleErrors: [],
          networkErrors: [],
        },
        duration: 500,
        error: 'Page not found',
      },
      {
        id: 'step-2',
        action: { type: 'click', params: { selector: { css: '.btn' } }, timestamp: 1700000000500 },
        screenshot: 'SCREENSHOT_DATA_2',
        metadata: {
          url: 'https://example.com/page',
          title: 'Page',
          viewport: { width: 1280, height: 720 },
          consoleErrors: [],
          networkErrors: [],
        },
        duration: 200,
      },
    ],
    config: {
      browser: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        slowMo: 0,
        timeout: 30000,
        devtools: false,
        args: [],
      },
      session: { outputDir: '.f4tl/sessions', maxSteps: 1000, keepArtifacts: true },
      capture: { format: 'png', quality: 90, fullPage: false, animations: 'disabled' },
      mcp: { name: 'f4tl', version: '0.1.0', logLevel: 'info' },
      codebase: { projectRoot: '/tmp', excludePatterns: [] },
      report: { outputDir: '.f4tl/reports' },
      dashboard: { port: 4173, host: 'localhost' },
    },
  };

  const bugs: Bug[] = [
    {
      id: 'bug-1',
      title: 'Login broken',
      severity: 'critical',
      stepsToReproduce: ['Navigate to /login', 'Enter credentials', 'Click submit'],
      expected: 'User logged in',
      actual: '500 error returned',
      evidenceStepIds: ['step-1'],
      url: 'https://example.com/login',
      timestamp: 1700000001000,
    },
    {
      id: 'bug-2',
      title: 'Typo in footer',
      severity: 'minor',
      stepsToReproduce: ['Scroll to footer'],
      expected: 'Correct spelling',
      actual: 'Misspelled word',
      evidenceStepIds: [],
      timestamp: 1700000002000,
    },
  ];

  const findings: Finding[] = [
    {
      id: 'finding-1',
      title: 'Missing alt text',
      category: 'accessibility',
      description: 'Several images lack alt attributes',
      evidenceStepIds: ['step-2'],
      url: 'https://example.com/page',
      timestamp: 1700000003000,
    },
  ];

  const summary: SessionSummary = {
    sessionId: 'test-123',
    startTime: 1700000000000,
    duration: 5000,
    stepCount: 2,
    bugCount: 2,
    findingCount: 1,
    bugsBySeverity: { critical: 1, major: 0, minor: 1, cosmetic: 0 },
    findingsByCategory: {
      usability: 0,
      performance: 0,
      accessibility: 1,
      security: 0,
      suggestion: 0,
      observation: 0,
    },
    errorStepCount: 1,
  };

  return {
    session,
    bugs,
    findings,
    generatedAt: 1700000010000,
    duration: 5000,
    summary,
  };
}

const screenshotResolver = async (_stepId: string): Promise<string | null> => 'AAAA';

describe('markdown generator', () => {
  it('contains the session header', async () => {
    const md = await genMarkdown(buildReportData(), screenshotResolver);
    expect(md).toContain('# QA Report: Session test-123');
  });

  it('contains bug count', async () => {
    const data = buildReportData();
    const md = await genMarkdown(data, screenshotResolver);
    expect(md).toContain(`**Bugs**: ${data.summary.bugCount}`);
  });

  it('contains severity label CRITICAL', async () => {
    const md = await genMarkdown(buildReportData(), screenshotResolver);
    expect(md).toContain('[CRITICAL]');
  });

  it('contains timeline table header', async () => {
    const md = await genMarkdown(buildReportData(), screenshotResolver);
    expect(md).toContain('| # | Action | URL | Duration | Error |');
  });

  it('omits Bugs section when bugs array is empty', async () => {
    const data = buildReportData();
    data.bugs = [];
    data.summary.bugCount = 0;
    const md = await genMarkdown(data, screenshotResolver);
    expect(md).not.toContain('## Bugs');
  });
});

describe('json generator', () => {
  it('produces valid JSON', async () => {
    const output = await genJson(buildReportData(), screenshotResolver);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('strips screenshots from steps', async () => {
    const output = await genJson(buildReportData(), screenshotResolver);
    const parsed = JSON.parse(output);
    for (const step of parsed.session.steps) {
      expect(step).not.toHaveProperty('screenshot');
    }
  });

  it('contains bugs and findings arrays', async () => {
    const output = await genJson(buildReportData(), screenshotResolver);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed.bugs)).toBe(true);
    expect(Array.isArray(parsed.findings)).toBe(true);
  });

  it('has summary.sessionId equal to test-123', async () => {
    const output = await genJson(buildReportData(), screenshotResolver);
    const parsed = JSON.parse(output);
    expect(parsed.summary.sessionId).toBe('test-123');
  });
});

describe('html generator', () => {
  it('starts with <!DOCTYPE html>', async () => {
    const html = await genHtml(buildReportData(), screenshotResolver);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('contains the session ID', async () => {
    const html = await genHtml(buildReportData(), screenshotResolver);
    expect(html).toContain('test-123');
  });

  it('contains severity label', async () => {
    const html = await genHtml(buildReportData(), screenshotResolver);
    expect(html).toContain('CRITICAL');
  });

  it('embeds screenshot as base64 data URI', async () => {
    const html = await genHtml(buildReportData(), screenshotResolver);
    expect(html).toContain('data:image/png;base64,AAAA');
  });

  it('escapes HTML in user content (XSS prevention)', async () => {
    const data = buildReportData();
    data.bugs[0].title = '<script>alert("xss")</script>';
    const html = await genHtml(data, screenshotResolver);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });
});
