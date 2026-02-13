import { z } from 'zod';
import type { BrowserManager } from '../../core/browser-manager.js';
import type { SessionManager } from '../../core/session-manager.js';
import type { BrowserAction, BrowserActionType, ToolResult } from '../../types/index.js';

// ── Shared selector schema ───────────────────────────────────────────────────

const selectorSchema = z
  .object({
    css: z.string().optional().describe('CSS selector'),
    text: z.string().optional().describe('Text content to match'),
    role: z.string().optional().describe('ARIA role selector'),
    xpath: z.string().optional().describe('XPath selector'),
  })
  .refine((d) => [d.css, d.text, d.role, d.xpath].filter(Boolean).length === 1, {
    message: 'Provide exactly one of: css, text, role, xpath',
  });

function toPlaywrightSelector(sel: z.infer<typeof selectorSchema>): string {
  if (sel.css) return sel.css;
  if (sel.text) return `text=${sel.text}`;
  if (sel.role) return `role=${sel.role}`;
  if (sel.xpath) return `xpath=${sel.xpath}`;
  throw new Error('Invalid selector');
}

// ── Tool Schemas ─────────────────────────────────────────────────────────────

export const navigateSchema = z.object({
  url: z.string().url().describe('URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .default('load')
    .describe('When to consider navigation complete'),
});

export const clickSchema = z.object({
  selector: selectorSchema.describe('Element to click'),
  force: z.boolean().default(false).describe('Skip actionability checks'),
  timeout: z.number().optional().describe('Timeout in ms'),
});

export const fillSchema = z.object({
  selector: selectorSchema.describe('Input element to fill'),
  value: z.string().describe('Value to fill (clears existing text first)'),
});

export const typeSchema = z.object({
  selector: selectorSchema.describe('Input element to type into'),
  text: z.string().describe('Text to type keystroke by keystroke'),
  delay: z.number().default(50).describe('Delay between keystrokes in ms'),
});

export const selectSchema = z.object({
  selector: selectorSchema.describe('Select element'),
  value: z.string().optional().describe('Option value to select'),
  label: z.string().optional().describe('Option label to select'),
});

export const hoverSchema = z.object({
  selector: selectorSchema.describe('Element to hover over'),
  timeout: z.number().optional().describe('Timeout in ms'),
});

export const pressSchema = z.object({
  key: z.string().describe('Key to press (e.g. Enter, Escape, Control+a)'),
});

export const scrollSchema = z.object({
  selector: selectorSchema.optional().describe('Container to scroll (defaults to page)'),
  x: z.number().default(0).describe('Horizontal scroll offset in pixels'),
  y: z.number().default(0).describe('Vertical scroll offset in pixels'),
});

export const screenshotSchema = z.object({
  fullPage: z.boolean().default(false).describe('Capture full page'),
});

export const evaluateSchema = z.object({
  expression: z.string().describe('JavaScript expression to evaluate in page context'),
});

export const resizeSchema = z.object({
  width: z.number().int().min(320).describe('Viewport width'),
  height: z.number().int().min(240).describe('Viewport height'),
});

export const waitSchema = z.object({
  type: z.enum(['time', 'selector', 'networkidle', 'url']).describe('What to wait for'),
  value: z.union([z.number(), z.string()]).describe('Time in ms, selector string, or URL pattern'),
  timeout: z.number().optional().describe('Timeout in ms'),
});

export const accessibilityTreeSchema = z.object({
  selector: selectorSchema
    .optional()
    .describe('Scope tree to this element (defaults to full page)'),
});

// ── Browser Tools Class ──────────────────────────────────────────────────────

export class BrowserTools {
  constructor(
    private bm: BrowserManager,
    private sm: SessionManager,
  ) {}

  // Helper: run an action, capture, record, return MCP result
  private async exec(
    type: BrowserActionType,
    params: Record<string, unknown>,
    action: () => Promise<void>,
    isRead = false,
  ): Promise<ToolResult> {
    const start = Date.now();
    const browserAction: BrowserAction = { type, params, timestamp: start };

    try {
      if (isRead) {
        await this.bm.queueReadAction(action);
      } else {
        await this.bm.queueWriteAction(action);
      }

      const capture = await this.bm.getCaptureManager().capture();
      const duration = Date.now() - start;
      await this.sm.recordStep(browserAction, capture.screenshot, capture.metadata, duration);

      const info = [
        `url: ${capture.metadata.url}`,
        capture.metadata.consoleErrors.length
          ? `console_errors: ${capture.metadata.consoleErrors.length}`
          : null,
        capture.metadata.networkErrors.length
          ? `network_errors: ${capture.metadata.networkErrors.length}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        content: [
          { type: 'text', text: info },
          { type: 'image', data: capture.screenshot, mimeType: 'image/png' },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const duration = Date.now() - start;
      const emptyMeta = {
        url: '',
        title: '',
        viewport: { width: 0, height: 0 },
        consoleErrors: [],
        networkErrors: [],
      };
      await this.sm.recordStep(browserAction, '', emptyMeta, duration, msg).catch(() => {});
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }

  // Helper for read-only actions that return extra text
  private async execWithResult<T>(
    type: BrowserActionType,
    params: Record<string, unknown>,
    action: () => Promise<T>,
  ): Promise<ToolResult> {
    const start = Date.now();
    const browserAction: BrowserAction = { type, params, timestamp: start };

    try {
      const result = await this.bm.queueReadAction(action);
      const capture = await this.bm.getCaptureManager().capture();
      const duration = Date.now() - start;
      await this.sm.recordStep(browserAction, capture.screenshot, capture.metadata, duration);

      const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      return {
        content: [
          { type: 'text', text: resultText },
          { type: 'image', data: capture.screenshot, mimeType: 'image/png' },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const duration = Date.now() - start;
      const emptyMeta = {
        url: '',
        title: '',
        viewport: { width: 0, height: 0 },
        consoleErrors: [],
        networkErrors: [],
      };
      await this.sm.recordStep(browserAction, '', emptyMeta, duration, msg).catch(() => {});
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }

  // ── 1. navigate ──────────────────────────────────────────────────────────

  async navigate(params: z.infer<typeof navigateSchema>): Promise<ToolResult> {
    return this.exec('navigate', params, async () => {
      await this.bm.getPage().goto(params.url, { waitUntil: params.waitUntil });
    });
  }

  // ── 2. click ─────────────────────────────────────────────────────────────

  async click(params: z.infer<typeof clickSchema>): Promise<ToolResult> {
    return this.exec('click', params as Record<string, unknown>, async () => {
      const sel = toPlaywrightSelector(params.selector);
      await this.bm.getPage().click(sel, {
        force: params.force,
        timeout: params.timeout,
      });
    });
  }

  // ── 3. fill ──────────────────────────────────────────────────────────────

  async fill(params: z.infer<typeof fillSchema>): Promise<ToolResult> {
    return this.exec('fill', params as Record<string, unknown>, async () => {
      const sel = toPlaywrightSelector(params.selector);
      await this.bm.getPage().fill(sel, params.value);
    });
  }

  // ── 4. type ──────────────────────────────────────────────────────────────

  async type(params: z.infer<typeof typeSchema>): Promise<ToolResult> {
    return this.exec('type', params as Record<string, unknown>, async () => {
      const sel = toPlaywrightSelector(params.selector);
      await this.bm.getPage().locator(sel).pressSequentially(params.text, {
        delay: params.delay,
      });
    });
  }

  // ── 5. select ────────────────────────────────────────────────────────────

  async select(params: z.infer<typeof selectSchema>): Promise<ToolResult> {
    return this.exec('select', params as Record<string, unknown>, async () => {
      const sel = toPlaywrightSelector(params.selector);
      const option = params.value ? { value: params.value } : { label: params.label ?? '' };
      await this.bm.getPage().selectOption(sel, option);
    });
  }

  // ── 6. hover ─────────────────────────────────────────────────────────────

  async hover(params: z.infer<typeof hoverSchema>): Promise<ToolResult> {
    return this.exec('hover', params as Record<string, unknown>, async () => {
      const sel = toPlaywrightSelector(params.selector);
      await this.bm.getPage().hover(sel, { timeout: params.timeout });
    });
  }

  // ── 7. press ─────────────────────────────────────────────────────────────

  async press(params: z.infer<typeof pressSchema>): Promise<ToolResult> {
    return this.exec('press', params, async () => {
      await this.bm.getPage().keyboard.press(params.key);
    });
  }

  // ── 8. scroll ────────────────────────────────────────────────────────────

  async scroll(params: z.infer<typeof scrollSchema>): Promise<ToolResult> {
    return this.exec('scroll', params as Record<string, unknown>, async () => {
      const page = this.bm.getPage();
      if (params.selector) {
        const sel = toPlaywrightSelector(params.selector);
        await page
          .locator(sel)
          .evaluate((el, { x, y }) => el.scrollBy(x, y), { x: params.x, y: params.y });
      } else {
        await page.evaluate(`scrollBy(${params.x}, ${params.y})`);
      }
    });
  }

  // ── 9. screenshot (read-only) ────────────────────────────────────────────

  async screenshot(params: z.infer<typeof screenshotSchema>): Promise<ToolResult> {
    const start = Date.now();
    const action: BrowserAction = {
      type: 'screenshot',
      params,
      timestamp: start,
    };

    try {
      const capture = await this.bm.queueReadAction(() => this.bm.getCaptureManager().capture());
      const duration = Date.now() - start;
      await this.sm.recordStep(action, capture.screenshot, capture.metadata, duration);

      return {
        content: [
          { type: 'text', text: `url: ${capture.metadata.url}` },
          { type: 'image', data: capture.screenshot, mimeType: 'image/png' },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const emptyMeta = {
        url: '',
        title: '',
        viewport: { width: 0, height: 0 },
        consoleErrors: [],
        networkErrors: [],
      };
      await this.sm.recordStep(action, '', emptyMeta, Date.now() - start, msg).catch(() => {});
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }

  // ── 10. evaluate (read-only) ─────────────────────────────────────────────

  async evaluate(params: z.infer<typeof evaluateSchema>): Promise<ToolResult> {
    return this.execWithResult('evaluate', params, async () => {
      return await this.bm.getPage().evaluate(params.expression);
    });
  }

  // ── 11. resize ───────────────────────────────────────────────────────────

  async resize(params: z.infer<typeof resizeSchema>): Promise<ToolResult> {
    return this.exec('resize', params, async () => {
      await this.bm.getPage().setViewportSize({ width: params.width, height: params.height });
    });
  }

  // ── 12. wait ─────────────────────────────────────────────────────────────

  async wait(params: z.infer<typeof waitSchema>): Promise<ToolResult> {
    return this.exec('wait', params as Record<string, unknown>, async () => {
      const page = this.bm.getPage();
      switch (params.type) {
        case 'time':
          await page.waitForTimeout(params.value as number);
          break;
        case 'selector':
          await page.waitForSelector(params.value as string, {
            timeout: params.timeout,
          });
          break;
        case 'networkidle':
          await page.waitForLoadState('networkidle', {
            timeout: params.timeout,
          });
          break;
        case 'url':
          await page.waitForURL(params.value as string, {
            timeout: params.timeout,
          });
          break;
      }
    });
  }

  // ── 13. back ─────────────────────────────────────────────────────────────

  async back(): Promise<ToolResult> {
    return this.exec('back', {}, async () => {
      await this.bm.getPage().goBack();
    });
  }

  // ── 14. forward ──────────────────────────────────────────────────────────

  async forward(): Promise<ToolResult> {
    return this.exec('forward', {}, async () => {
      await this.bm.getPage().goForward();
    });
  }

  // ── 15. accessibility_tree (read-only) ───────────────────────────────────

  async accessibilityTree(params: z.infer<typeof accessibilityTreeSchema>): Promise<ToolResult> {
    return this.execWithResult(
      'accessibility_tree',
      params as Record<string, unknown>,
      async () => {
        const page = this.bm.getPage();
        const client = await page.context().newCDPSession(page);
        const { nodes } = await client.send('Accessibility.getFullAXTree');
        await client.detach();
        return nodes;
      },
    );
  }
}
