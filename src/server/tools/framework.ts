import type { BrowserManager } from '../../core/browser-manager.js';
import type { CodebaseConfig } from '../../types/index.js';
import type { ToolResult } from '../../types/index.js';
import { detectFramework } from '../../core/framework-detector.js';

// ── Tool Class ───────────────────────────────────────────────────────────────

export class FrameworkTools {
  constructor(
    private browserManager: BrowserManager,
    private codebaseConfig: CodebaseConfig,
  ) {}

  async detect(): Promise<ToolResult> {
    try {
      let page;
      try {
        page = this.browserManager.getPage();
      } catch {
        // Browser may not be navigated yet — detect from package.json only
      }

      const result = await detectFramework(this.codebaseConfig.projectRoot, page);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
}
