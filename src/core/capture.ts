import type { Page } from 'playwright';
import type {
  CaptureConfig,
  CaptureResult,
  ConsoleMessage,
  NetworkError,
  StepMetadata,
} from '../types/index.js';

export class CaptureManager {
  private consoleMessages: ConsoleMessage[] = [];
  private networkErrors: NetworkError[] = [];
  private runtimeConsolePatterns: RegExp[] = [];
  private runtimeNetworkPatterns: RegExp[] = [];

  constructor(
    private page: Page,
    private config: CaptureConfig,
  ) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'warning' || type === 'error') {
        const loc = msg.location();
        this.consoleMessages.push({
          type: type as 'warning' | 'error',
          text: msg.text(),
          timestamp: Date.now(),
          location: loc.url
            ? {
                url: loc.url,
                lineNumber: loc.lineNumber,
                columnNumber: loc.columnNumber,
              }
            : undefined,
        });
      }
    });

    this.page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        this.networkErrors.push({
          url: response.url(),
          method: response.request().method(),
          status,
          statusText: response.statusText(),
          timestamp: Date.now(),
        });
      }
    });
  }

  addRuntimeSuppression(type: 'console' | 'network', pattern: string): void {
    const regex = new RegExp(pattern);
    if (type === 'console') {
      this.runtimeConsolePatterns.push(regex);
    } else {
      this.runtimeNetworkPatterns.push(regex);
    }
  }

  getRuntimeSuppressions(): { console: string[]; network: string[] } {
    return {
      console: this.runtimeConsolePatterns.map((r) => r.source),
      network: this.runtimeNetworkPatterns.map((r) => r.source),
    };
  }

  async capture(): Promise<CaptureResult> {
    const buffer = await this.page.screenshot({
      type: this.config.format,
      quality: this.config.format === 'jpeg' ? this.config.quality : undefined,
      fullPage: this.config.fullPage,
      animations: this.config.animations,
    });

    const metadata = await this.collectMetadata();
    const screenshot = buffer.toString('base64');

    // Drain error buffers into the metadata, apply suppression filters, and reset
    metadata.consoleErrors = this.filterConsoleErrors([...this.consoleMessages]);
    metadata.networkErrors = this.filterNetworkErrors([...this.networkErrors]);
    this.consoleMessages = [];
    this.networkErrors = [];

    return { screenshot, metadata };
  }

  private filterConsoleErrors(errors: ConsoleMessage[]): ConsoleMessage[] {
    const configPatterns = (this.config.suppressErrors?.console ?? []).map((p) => new RegExp(p));
    const allPatterns = [...configPatterns, ...this.runtimeConsolePatterns];
    if (allPatterns.length === 0) return errors;
    return errors.filter((e) => !allPatterns.some((p) => p.test(e.text)));
  }

  private filterNetworkErrors(errors: NetworkError[]): NetworkError[] {
    const configPatterns = (this.config.suppressErrors?.network ?? []).map((p) => new RegExp(p));
    const allPatterns = [...configPatterns, ...this.runtimeNetworkPatterns];
    if (allPatterns.length === 0) return errors;
    return errors.filter((e) => !allPatterns.some((p) => p.test(e.url)));
  }

  private async collectMetadata(): Promise<StepMetadata> {
    const url = this.page.url();
    const title = await this.page.title();
    const viewport = this.page.viewportSize() ?? { width: 0, height: 0 };

    let domMetrics;
    try {
      const client = await this.page.context().newCDPSession(this.page);
      const { metrics } = await client.send('Performance.getMetrics');
      domMetrics = {
        nodeCount: metrics.find((m) => m.name === 'Nodes')?.value ?? 0,
        layoutCount: metrics.find((m) => m.name === 'LayoutCount')?.value ?? 0,
        scriptDuration: metrics.find((m) => m.name === 'ScriptDuration')?.value ?? 0,
      };
      await client.detach();
    } catch {
      // CDP metrics are optional — continue without them
    }

    return {
      url,
      title,
      viewport,
      consoleErrors: [],
      networkErrors: [],
      domMetrics,
    };
  }
}
