import { chromium, type Browser, type Page, type ConsoleMessage } from 'playwright';
import { startServer, type FixtureServer } from '../fixture-app/server.js';

let browser: Browser;
let page: Page;
let fixture: FixtureServer;

beforeAll(async () => {
  fixture = await startServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  page = await context.newPage();
  page.setDefaultNavigationTimeout(15_000);
  page.setDefaultTimeout(15_000);
}, 30_000);

afterAll(async () => {
  await page?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await fixture?.close().catch(() => {});
});

describe('browser integration tests', () => {
  it('navigates to home page and verifies page title', async () => {
    await page.goto(fixture.url);
    const title = await page.title();
    expect(title).toContain('f4tl Test App');
  });

  it('navigates to home page and verifies heading content', async () => {
    await page.goto(fixture.url);
    const heading = await page.textContent('h1');
    expect(heading).toBe('f4tl Test App');
  });

  it('navigates to form page and fills input fields', async () => {
    await page.goto(`${fixture.url}/form`);
    await page.fill('#name', 'Jane Doe');
    await page.fill('#email', 'jane@example.com');

    const nameValue = await page.inputValue('#name');
    const emailValue = await page.inputValue('#email');

    expect(nameValue).toBe('Jane Doe');
    expect(emailValue).toBe('jane@example.com');
  });

  it('takes a screenshot and returns a non-empty buffer', async () => {
    await page.goto(fixture.url);
    const screenshotBuffer = await page.screenshot({ type: 'png' });

    expect(screenshotBuffer).toBeInstanceOf(Buffer);
    expect(screenshotBuffer.length).toBeGreaterThan(0);

    // Verify it is valid PNG by checking magic bytes
    expect(screenshotBuffer[0]).toBe(0x89);
    expect(screenshotBuffer[1]).toBe(0x50); // P
    expect(screenshotBuffer[2]).toBe(0x4e); // N
    expect(screenshotBuffer[3]).toBe(0x47); // G
  });

  it('navigates to /api/data and verifies JSON content on page', async () => {
    await page.goto(`${fixture.url}/api/data`);
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();

    const parsed = JSON.parse(bodyText!);
    expect(parsed).toEqual({
      status: 'ok',
      items: [{ id: 1, name: 'test' }],
    });
  });

  it('captures console errors on the error page', async () => {
    const consoleErrors: string[] = [];
    const handler = (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };

    page.on('console', handler);
    await page.goto(`${fixture.url}/error`);
    // Give the script a moment to execute
    await page.waitForLoadState('domcontentloaded');
    page.off('console', handler);

    expect(consoleErrors).toContain('Test error');
  });

  it('clicks a link on the home page and navigates to /form', async () => {
    await page.goto(fixture.url);
    await page.click('a[href="/form"]');
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toBe(`${fixture.url}/form`);
    const heading = await page.textContent('h1');
    expect(heading).toBe('Test Form');
  });

  it('loads the slow page within the navigation timeout', async () => {
    const start = Date.now();
    await page.goto(`${fixture.url}/slow`);
    const elapsed = Date.now() - start;

    const heading = await page.textContent('h1');
    expect(heading).toBe('Slow Page');
    // Should have taken at least ~2s due to the server delay
    expect(elapsed).toBeGreaterThanOrEqual(1900);
    // But should complete well within the 15s timeout
    expect(elapsed).toBeLessThan(15_000);
  });

  it('submits the form with valid data and sees success page', async () => {
    await page.goto(`${fixture.url}/form`);
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title).toContain('Form Success');

    const body = await page.textContent('body');
    expect(body).toContain('Thank you, Test User');
    expect(body).toContain('test@example.com');
  });
});
