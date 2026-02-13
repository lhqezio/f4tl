import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import PQueue from 'p-queue';
import type { BrowserConfig, CaptureConfig, AuthConfig, ContextOptions } from '../types/index.js';
import { CaptureManager } from './capture.js';
import { NetworkCapture } from './network-capture.js';

interface ContextInfo {
  context: BrowserContext;
  page: Page;
  captureManager: CaptureManager;
  networkCapture: NetworkCapture;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private contexts = new Map<string, ContextInfo>();
  private activeContextId = 'default';

  private writeQueue: PQueue;
  private readQueue: PQueue;

  constructor(
    private browserConfig: BrowserConfig,
    private captureConfig: CaptureConfig,
  ) {
    this.writeQueue = new PQueue({ concurrency: 1 });
    this.readQueue = new PQueue({ concurrency: 5 });
  }

  async launch(): Promise<void> {
    if (this.browser) {
      throw new Error('Browser already launched');
    }

    this.browser = await chromium.launch({
      headless: this.browserConfig.headless,
      slowMo: this.browserConfig.slowMo,
      args: this.browserConfig.args,
    });

    // Create default context
    await this.createContext('default');
  }

  async createContext(name: string, opts?: ContextOptions): Promise<void> {
    if (!this.browser) throw new Error('Browser not launched. Call launch() first.');
    if (this.contexts.has(name)) throw new Error(`Context "${name}" already exists.`);

    const context = await this.browser.newContext({
      viewport: opts?.viewport ?? this.browserConfig.viewport,
      userAgent: opts?.userAgent,
      locale: opts?.locale,
      timezoneId: opts?.timezoneId,
      reducedMotion: 'reduce',
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(this.browserConfig.timeout);
    page.setDefaultTimeout(this.browserConfig.timeout);

    const captureManager = new CaptureManager(page, this.captureConfig);
    const networkCapture = new NetworkCapture(page);

    this.contexts.set(name, { context, page, captureManager, networkCapture });
  }

  switchContext(name: string): void {
    if (!this.contexts.has(name)) {
      throw new Error(
        `Context "${name}" does not exist. Available: ${[...this.contexts.keys()].join(', ')}`,
      );
    }
    this.activeContextId = name;
  }

  getContextNames(): string[] {
    return [...this.contexts.keys()];
  }

  getActiveContextId(): string {
    return this.activeContextId;
  }

  async executeAuth(role: string, authConfigs: Record<string, AuthConfig>): Promise<void> {
    const authConfig = authConfigs[role];
    if (!authConfig) throw new Error(`Auth config for role "${role}" not found.`);

    const page = this.getPage();

    switch (authConfig.strategy) {
      case 'form': {
        const fl = authConfig.formLogin;
        if (!fl) throw new Error('formLogin config required for form strategy');

        const username = process.env[fl.usernameEnv];
        const password = process.env[fl.passwordEnv];
        if (!username || !password) {
          throw new Error(
            `Environment variables ${fl.usernameEnv} and/or ${fl.passwordEnv} not set.`,
          );
        }

        await page.goto(fl.loginUrl);
        await page.fill(fl.usernameSelector, username);
        await page.fill(fl.passwordSelector, password);
        await page.click(fl.submitSelector);
        await page.waitForLoadState('networkidle');
        break;
      }

      case 'cookie': {
        const cookies = authConfig.cookies;
        if (!cookies) throw new Error('cookies config required for cookie strategy');

        const cookieList = cookies.items.map((item) => {
          const value = process.env[item.valueEnv];
          if (!value) throw new Error(`Environment variable ${item.valueEnv} not set.`);
          return {
            name: item.name,
            value,
            domain: cookies.domain,
            path: '/',
          };
        });

        await this.getActiveContext().context.addCookies(cookieList);
        break;
      }

      case 'storage-state': {
        const path = authConfig.storageStatePath;
        if (!path) throw new Error('storageStatePath required for storage-state strategy');
        // Close and recreate context with storage state
        const activeId = this.activeContextId;
        const oldInfo = this.contexts.get(activeId);
        if (!oldInfo) throw new Error(`No context found for "${activeId}"`);
        oldInfo.networkCapture.destroy();
        await oldInfo.page.close().catch(() => {});
        await oldInfo.context.close().catch(() => {});
        this.contexts.delete(activeId);

        if (!this.browser) throw new Error('Browser not launched');
        const context = await this.browser.newContext({
          viewport: this.browserConfig.viewport,
          storageState: path,
          reducedMotion: 'reduce',
        });
        const newPage = await context.newPage();
        newPage.setDefaultNavigationTimeout(this.browserConfig.timeout);
        newPage.setDefaultTimeout(this.browserConfig.timeout);

        this.contexts.set(activeId, {
          context,
          page: newPage,
          captureManager: new CaptureManager(newPage, this.captureConfig),
          networkCapture: new NetworkCapture(newPage),
        });
        break;
      }

      case 'custom': {
        const scriptPath = authConfig.customScriptPath;
        if (!scriptPath) throw new Error('customScriptPath required for custom strategy');
        const mod = await import(scriptPath);
        if (typeof mod.default === 'function') {
          await mod.default(page, this.getActiveContext().context);
        } else if (typeof mod.authenticate === 'function') {
          await mod.authenticate(page, this.getActiveContext().context);
        } else {
          throw new Error('Custom auth script must export default or authenticate function');
        }
        break;
      }

      case 'jwt': {
        const jwt = authConfig.jwt;
        if (!jwt) throw new Error('jwt config required for jwt strategy');
        const token = process.env[jwt.tokenEnv];
        if (!token) throw new Error(`Environment variable ${jwt.tokenEnv} not set.`);

        if (jwt.storageType === 'cookie') {
          const url = page.url();
          const domain = new URL(url === 'about:blank' ? 'http://localhost' : url).hostname;
          await this.getActiveContext().context.addCookies([
            { name: jwt.storageKey, value: token, domain, path: '/' },
          ]);
        } else {
          const storageApi =
            jwt.storageType === 'sessionStorage' ? 'sessionStorage' : 'localStorage';
          await page.evaluate(
            /* istanbul ignore next */
            ({ api, key, val }: { api: string; key: string; val: string }) => {
              const storage = (globalThis as Record<string, unknown>)[api] as
                | { setItem: (k: string, v: string) => void }
                | undefined;
              if (storage) storage.setItem(key, val);
            },
            { api: storageApi, key: jwt.storageKey, val: token },
          );
        }
        break;
      }

      case 'oauth': {
        const oauth = authConfig.oauth;
        if (!oauth) throw new Error('oauth config required for oauth strategy');
        const clientId = process.env[oauth.clientIdEnv];
        if (!clientId) throw new Error(`Environment variable ${oauth.clientIdEnv} not set.`);

        const authUrl = new URL(oauth.authUrl);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', oauth.callbackUrl);
        authUrl.searchParams.set('response_type', 'code');

        await page.goto(authUrl.toString());
        // User or automation must complete the OAuth flow from here
        break;
      }
    }
  }

  async close(): Promise<void> {
    await this.writeQueue.onIdle();
    await this.readQueue.onIdle();

    for (const info of this.contexts.values()) {
      info.networkCapture.destroy();
      await info.page.close().catch(() => {});
      await info.context.close().catch(() => {});
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  getPage(): Page {
    return this.getActiveContext().page;
  }

  getCaptureManager(): CaptureManager {
    return this.getActiveContext().captureManager;
  }

  getNetworkCapture(): NetworkCapture {
    return this.getActiveContext().networkCapture;
  }

  async queueWriteAction<T>(action: () => Promise<T>): Promise<T> {
    return this.writeQueue.add(action, { throwOnTimeout: true }) as Promise<T>;
  }

  async queueReadAction<T>(action: () => Promise<T>): Promise<T> {
    return this.readQueue.add(action, { throwOnTimeout: true }) as Promise<T>;
  }

  isLaunched(): boolean {
    return this.browser !== null && this.contexts.size > 0;
  }

  private getActiveContext(): ContextInfo {
    const info = this.contexts.get(this.activeContextId);
    if (!info) throw new Error('Browser not launched. Call launch() first.');
    return info;
  }
}
