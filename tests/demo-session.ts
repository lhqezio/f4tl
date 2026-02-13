/**
 * Demo script: creates a realistic QA session with browser automation,
 * bugs, findings, and screenshots — then starts the dashboard to view it.
 */
import { BrowserManager } from '../src/core/browser-manager.js';
import { SessionManager } from '../src/core/session-manager.js';
import { ReportManager } from '../src/core/report-manager.js';
import { DashboardServer } from '../src/dashboard/server.js';
import { startServer as startFixtureApp } from './fixture-app/server.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';

async function main() {
  // 1. Start fixture app
  const fixture = await startFixtureApp();
  console.error(`[demo] Fixture app at ${fixture.url}`);

  // 2. Init core managers
  const browserManager = new BrowserManager(DEFAULT_CONFIG.browser, DEFAULT_CONFIG.capture);
  const sessionManager = new SessionManager(DEFAULT_CONFIG.session);
  const reportManager = new ReportManager(DEFAULT_CONFIG.report);

  await browserManager.launch();
  console.error('[demo] Browser launched');

  const sessionId = sessionManager.startSession(DEFAULT_CONFIG);
  reportManager.setSessionId(sessionId);
  console.error(`[demo] Session ${sessionId} started`);

  // 3. Start dashboard with live data
  const dashboard = new DashboardServer(
    DEFAULT_CONFIG.dashboard,
    DEFAULT_CONFIG.session,
    sessionManager,
    reportManager,
  );
  await dashboard.start();
  console.error('[demo] Dashboard at http://localhost:4173');

  // Helper to record a step with screenshot
  async function doStep(actionName: string) {
    const pg = browserManager.getPage();
    const screenshot = await pg.screenshot({ type: 'png' });
    const b64 = screenshot.toString('base64');
    const start = Date.now();
    await sessionManager.recordStep(
      { type: actionName as never, params: {}, timestamp: Date.now() },
      b64,
      {
        url: pg.url(),
        title: await pg.title(),
        viewport: { width: 1280, height: 720 },
        consoleErrors: [],
        networkErrors: [],
      },
      Date.now() - start,
    );
    console.error(`[demo] Step: ${actionName} -> ${pg.url()}`);
  }

  // 4. Run a realistic QA flow
  const page = browserManager.getPage();

  // Navigate to home page
  await page.goto(fixture.url);
  await doStep('navigate');

  // Check the home page
  await page.waitForLoadState('domcontentloaded');
  await doStep('screenshot');

  // Navigate to form page
  await page.click('a[href="/form"]');
  await page.waitForLoadState('domcontentloaded');
  await doStep('click');

  // Fill in the form
  await page.fill('input[name="name"]', 'Test User');
  await doStep('fill');

  await page.fill('input[name="email"]', 'test@example.com');
  await doStep('fill');

  // Submit the form
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await doStep('click');

  // Test form validation — submit empty
  await page.goto(`${fixture.url}/form`);
  await doStep('navigate');

  await page.fill('input[name="name"]', '');
  await page.fill('input[name="email"]', '');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await doStep('click');

  // Check error page
  await page.goto(`${fixture.url}/error`);
  await page.waitForLoadState('domcontentloaded');
  await doStep('navigate');

  // Check slow page
  await page.goto(`${fixture.url}/slow`);
  await page.waitForLoadState('domcontentloaded');
  await doStep('navigate');

  // Check API
  await page.goto(`${fixture.url}/api/data`);
  await page.waitForLoadState('domcontentloaded');
  await doStep('navigate');

  // 5. Record bugs and findings
  const sess = sessionManager.getSession()!;

  reportManager.createBug({
    title: 'Form accepts empty submission when name and email are blank',
    severity: 'major',
    stepsToReproduce: [
      `Navigate to ${fixture.url}/form`,
      'Leave name and email fields empty',
      'Click Submit',
      'Form submits successfully instead of showing validation errors',
    ],
    expectedBehavior: 'Form should show inline validation errors for required fields',
    actualBehavior: 'Form submits with empty values and shows success message',
    url: `${fixture.url}/form`,
    evidenceStepIds: [sess.steps[7]?.id ?? ''],
  });
  console.error('[demo] Bug: empty form validation');

  reportManager.createBug({
    title: 'Error page throws unhandled console error on load',
    severity: 'minor',
    stepsToReproduce: [
      `Navigate to ${fixture.url}/error`,
      'Open browser console',
      'Observe uncaught error logged',
    ],
    expectedBehavior: 'Page should handle errors gracefully without console errors',
    actualBehavior: 'Console shows: "Uncaught Error: This is a test error"',
    url: `${fixture.url}/error`,
    evidenceStepIds: [sess.steps[8]?.id ?? ''],
  });
  console.error('[demo] Bug: console error');

  reportManager.addFinding({
    category: 'performance',
    title: 'Slow page takes 2+ seconds to load',
    description:
      'The /slow endpoint has an artificial 2-second delay. In production, this would degrade user experience.',
    url: `${fixture.url}/slow`,
    evidenceStepIds: [sess.steps[9]?.id ?? ''],
  });
  console.error('[demo] Finding: slow page');

  reportManager.addFinding({
    category: 'accessibility',
    title: 'Form inputs lack associated labels',
    description:
      'The name and email inputs on /form do not have <label> elements with for= attributes.',
    url: `${fixture.url}/form`,
    evidenceStepIds: [sess.steps[2]?.id ?? ''],
  });
  console.error('[demo] Finding: missing labels');

  reportManager.addFinding({
    category: 'usability',
    title: 'No navigation back to home from form success page',
    description:
      'After submitting the form, the success page has no link to return to the homepage.',
    url: `${fixture.url}/form`,
    evidenceStepIds: [sess.steps[5]?.id ?? ''],
  });
  console.error('[demo] Finding: no back navigation');

  // 6. End session
  await sessionManager.endSession();
  console.error('[demo] Session ended');

  console.error('\n[demo] ====================================');
  console.error('[demo]  Dashboard: http://localhost:4173');
  console.error('[demo]  11 steps, 2 bugs, 3 findings');
  console.error('[demo]  Press Ctrl+C to stop');
  console.error('[demo] ====================================\n');

  // Keep alive
  process.on('SIGINT', async () => {
    await dashboard.stop();
    await browserManager.close();
    await fixture.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[demo] Fatal error:', err);
  process.exit(1);
});
