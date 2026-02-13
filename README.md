# f4tl

MCP server for autonomous full-stack QA. Give an AI agent a browser, your logs, your database, and your codebase — it tests your app and files bugs.

## Features

- **29 MCP tools** across 6 categories: browser, network, code, context, logs, database, reports
- **7 MCP prompts** for common QA workflows (smoke test, full QA, regression, accessibility, forms, performance, visual inventory)
- **Browser automation** via Playwright — navigate, click, fill, type, screenshot, evaluate JS, accessibility tree
- **Network capture** — inspect requests/responses, mock/block/delay with intercept rules, WebSocket monitoring
- **Code exploration** — ripgrep search, file reading, glob find, git diff
- **Multi-context** — isolated browser contexts for multi-user testing, configurable auth strategies
- **Report system** — record bugs and findings, generate reports in Markdown/JSON/HTML
- **Log collection** — tail process output or log files, search with regex, parse JSON/CLF/plain formats
- **Database inspection** — read-only SQL queries, schema introspection, EXPLAIN ANALYZE (PostgreSQL)
- **Live dashboard** — React SPA with real-time WebSocket updates, session timeline, screenshot viewer
- **Session tracking** — step recording, screenshot capture, artifact persistence

## Quick Start

```bash
# Install
npm install -g f4tl   # or: pnpm add -g f4tl

# Generate config with auto-detection
cd your-project
f4tl init

# Start the MCP server
f4tl serve
```

### Configure your MCP client

Add f4tl to your MCP client config. For Claude Desktop, edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "f4tl": {
      "command": "f4tl",
      "args": ["serve"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## Configuration

f4tl uses `f4tl.config.ts` (loaded via [c12](https://github.com/unjs/c12) with Zod validation). Generate one with `f4tl init` or create manually:

```typescript
import { defineConfig } from 'f4tl';

export default defineConfig({
  browser: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    timeout: 30_000,
  },
  session: {
    outputDir: '.f4tl/sessions',
    maxSteps: 1000,
  },
  codebase: {
    projectRoot: process.cwd(),
  },
});
```

See [`examples/f4tl.config.ts`](examples/f4tl.config.ts) for a fully annotated config with all options.

### Config Reference

| Section     | Key               | Default                     | Description                                                       |
| ----------- | ----------------- | --------------------------- | ----------------------------------------------------------------- |
| `browser`   | `headless`        | `true`                      | Run browser without UI                                            |
|             | `viewport`        | `1280x720`                  | Browser viewport size                                             |
|             | `slowMo`          | `0`                         | Delay between actions (ms)                                        |
|             | `timeout`         | `30000`                     | Default action timeout (ms)                                       |
|             | `devtools`        | `false`                     | Open devtools on launch                                           |
| `session`   | `outputDir`       | `.f4tl/sessions`            | Session artifact directory                                        |
|             | `maxSteps`        | `1000`                      | Max steps per session                                             |
|             | `keepArtifacts`   | `true`                      | Persist screenshots and session data                              |
| `capture`   | `format`          | `png`                       | Screenshot format (`png` or `jpeg`)                               |
|             | `quality`         | `90`                        | JPEG quality (1-100)                                              |
|             | `fullPage`        | `false`                     | Capture full page or viewport                                     |
| `codebase`  | `projectRoot`     | `cwd()`                     | Project root for code tools                                       |
|             | `excludePatterns` | `[node_modules, .git, ...]` | Glob patterns to exclude from search                              |
| `report`    | `outputDir`       | `.f4tl/reports`             | Report output directory                                           |
| `dashboard` | `port`            | `4173`                      | Dashboard server port                                             |
|             | `host`            | `localhost`                 | Dashboard server host                                             |
| `mcp`       | `name`            | `f4tl`                      | MCP server name                                                   |
|             | `version`         | `0.1.0`                     | MCP server version                                                |
|             | `logLevel`        | `info`                      | Log level (`debug`, `info`, `warn`, `error`)                      |
| `auth`      | _(per role)_      | —                           | Auth strategies: `form`, `cookie`, `storage-state`, `custom`      |
| `logs`      | _(per source)_    | —                           | Log sources: `process` or `file` with `json`/`clf`/`plain` parser |
| `database`  | `type`            | —                           | Database type (`postgres`), connection string or fields           |

## Tools Reference

### Browser (15 tools)

| Tool                         | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `browser_navigate`           | Navigate to a URL                                    |
| `browser_click`              | Click element by CSS/text/role/xpath selector        |
| `browser_fill`               | Fill an input field (clears first)                   |
| `browser_type`               | Type text keystroke-by-keystroke                     |
| `browser_select`             | Select a dropdown option                             |
| `browser_hover`              | Hover over an element                                |
| `browser_press`              | Press a keyboard key or combo                        |
| `browser_scroll`             | Scroll the page or a container                       |
| `browser_screenshot`         | Take a screenshot                                    |
| `browser_evaluate`           | Execute JavaScript in page context                   |
| `browser_resize`             | Resize the browser viewport                          |
| `browser_wait`               | Wait for time, selector, network idle, or URL change |
| `browser_back`               | Navigate back in history                             |
| `browser_forward`            | Navigate forward in history                          |
| `browser_accessibility_tree` | Get the accessibility tree                           |

### Network (4 tools)

| Tool                       | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `network_get_requests`     | Get captured HTTP requests/responses with filters |
| `network_intercept`        | Add intercept rule (block, mock, or delay)        |
| `network_clear_intercepts` | Remove all intercept rules                        |
| `network_get_websockets`   | Get captured WebSocket messages                   |

### Code (4 tools)

| Tool              | Description                  |
| ----------------- | ---------------------------- |
| `code_search`     | Search codebase with ripgrep |
| `code_read`       | Read a file from the project |
| `code_find_files` | Find files by glob pattern   |
| `code_git_diff`   | Get git diff                 |

### Context (2-3 tools)

| Tool                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `browser_new_context`    | Create an isolated browser context                              |
| `browser_switch_context` | Switch the active context                                       |
| `browser_auth`           | Authenticate with a configured role _(only if auth configured)_ |

### Report (4 tools)

| Tool                         | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `report_create_bug`          | Record a bug with severity and repro steps                   |
| `report_add_finding`         | Record a QA finding (usability, performance, a11y, security) |
| `report_generate`            | Generate a report (markdown, json, or html)                  |
| `report_get_session_summary` | Get current session statistics                               |

### Logs (3 tools, optional)

| Tool          | Description                          |
| ------------- | ------------------------------------ |
| `logs_tail`   | Get recent log entries from a source |
| `logs_get`    | Get log entries with filters         |
| `logs_search` | Search logs by regex pattern         |

### Database (3 tools, optional)

| Tool         | Description                   |
| ------------ | ----------------------------- |
| `db_query`   | Execute a read-only SQL query |
| `db_schema`  | Get database schema           |
| `db_explain` | Get query execution plan      |

## Prompts

MCP prompts are pre-built conversation starters your MCP client can invoke.

| Prompt                | Args                          | Description                                                           |
| --------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `smoke-test`          | `url`                         | Navigate, screenshot key pages, check console/network errors          |
| `full-qa`             | `url`, `scope?`               | Comprehensive QA: all pages, forms, a11y, responsive, generate report |
| `regression-test`     | `url`, `baseline_session_id?` | Re-run flows, compare against baseline, flag regressions              |
| `accessibility-audit` | `url`                         | Check ARIA, alt text, keyboard nav, report WCAG violations            |
| `form-test`           | `url`, `form_selector?`       | Test validation: empty, invalid, XSS, boundary values                 |
| `performance-check`   | `url`                         | Measure load times, flag slow requests, large assets                  |
| `visual-inventory`    | `url`                         | Screenshot every page at desktop, tablet, and mobile viewports        |

## Dashboard

The live dashboard shows real-time session progress with WebSocket updates.

```bash
# Co-host with MCP server
f4tl serve --dashboard

# Or run standalone (browse historical sessions)
f4tl dashboard --port 4173
```

The dashboard provides:

- Session list with status, duration, step count, bug/finding counts
- Step timeline with screenshots and metadata
- Bug and finding cards with severity/category badges
- Real-time updates during active sessions

## Reports

Generate reports in three formats:

```
# From the MCP client, use the report_generate tool:
# format: "markdown" | "json" | "html"
```

Reports include:

- Session metadata (ID, duration, step count)
- All recorded bugs with severity, steps to reproduce, expected/actual behavior
- All findings categorized by type (usability, performance, accessibility, security)
- Screenshots referenced by step

## CLI Reference

```
f4tl serve [--headless] [--dashboard]
  Start the MCP server. Reads f4tl.config.ts from cwd.

f4tl init [--force]
  Generate f4tl.config.ts with auto-detected project settings.
  Detects: Next.js, Nuxt, Vite, Remix, Express, Fastify, Astro, PostgreSQL.

f4tl dashboard [--port <number>]
  Start the dashboard UI standalone to browse historical sessions.

f4tl clean [--sessions] [--reports] [--all] [--older-than <days>] [--dry-run]
  Remove generated sessions, reports, or the entire .f4tl directory.

f4tl sessions [--json] [--limit <n>]
  List recorded sessions with ID, date, duration, step count, status.
```

## Requirements

- **Node.js** >= 22.0.0
- **Playwright** chromium (installed automatically)
- **ripgrep** (`rg`) for code search tools
- **PostgreSQL** (optional, for database tools)

## License

MIT
