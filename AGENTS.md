# AGENTS.md — Guide for AI Agents Using f4tl

f4tl is an MCP server that gives you a browser, network inspector, code explorer, log viewer, and database client to autonomously QA a web application. You file bugs and findings, and generate reports.

## Quick Setup

### 1. Generate config in the target project

```bash
cd /path/to/project
f4tl init
```

This creates `f4tl.config.ts` with auto-detected settings (framework, database). Edit it to set your target URL, auth, logs, and database if needed.

### 2. Start the MCP server

```bash
f4tl serve
```

Or with the live dashboard:

```bash
f4tl serve --dashboard
```

### 3. MCP client config

Add to your MCP client (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "f4tl": {
      "command": "f4tl",
      "args": ["serve"],
      "cwd": "/path/to/target/project"
    }
  }
}
```

To co-host the dashboard, use `"args": ["serve", "--dashboard"]`.

---

## Available Tools (29)

### Browser (15)

Use these to interact with the web app like a user.

| Tool | What it does |
|---|---|
| `browser_navigate` | Go to a URL. Returns screenshot + console/network errors. |
| `browser_click` | Click an element by CSS, text, role, or xpath selector. |
| `browser_fill` | Clear an input and type a value. |
| `browser_type` | Type keystroke-by-keystroke (for autocomplete/search). |
| `browser_select` | Pick a dropdown option by value or label. |
| `browser_hover` | Hover over an element (reveal tooltips, menus). |
| `browser_press` | Press a key combo (Enter, Tab, Control+a). |
| `browser_scroll` | Scroll page or a container element. |
| `browser_screenshot` | Capture the current viewport without acting. |
| `browser_evaluate` | Run JavaScript in the page and return the result. |
| `browser_resize` | Change the viewport size (for responsive testing). |
| `browser_wait` | Wait for time, a selector, network idle, or URL change. |
| `browser_back` | Go back in browser history. |
| `browser_forward` | Go forward in browser history. |
| `browser_accessibility_tree` | Get the page's accessibility tree (for a11y auditing). |

### Network (4)

Use these to inspect and manipulate HTTP traffic.

| Tool | What it does |
|---|---|
| `network_get_requests` | Get captured requests/responses. Filter by URL pattern, method, status code, resource type. |
| `network_intercept` | Add a rule to block, mock, or delay matching requests. |
| `network_clear_intercepts` | Remove all intercept rules. |
| `network_get_websockets` | Get captured WebSocket messages. |

### Code (4)

Use these to read and search the project source code.

| Tool | What it does |
|---|---|
| `code_search` | Search codebase with regex (ripgrep). |
| `code_read` | Read a file's contents. |
| `code_find_files` | Find files by glob pattern. |
| `code_git_diff` | Get uncommitted changes or diff against a ref. |

### Context (2-3)

Use these for multi-user testing scenarios.

| Tool | What it does |
|---|---|
| `browser_new_context` | Create an isolated browser context (separate cookies, storage). |
| `browser_switch_context` | Switch the active context by name. |
| `browser_auth` | Authenticate with a configured role (only if auth is in config). |

### Report (4)

Use these to record issues and generate reports.

| Tool | What it does |
|---|---|
| `report_create_bug` | File a bug with severity, repro steps, expected/actual behavior. |
| `report_add_finding` | Record a QA finding (usability, performance, a11y, security, suggestion). |
| `report_generate` | Generate a report in markdown, JSON, or HTML. |
| `report_get_session_summary` | Get current stats: step count, bugs, findings, duration. |

### Logs (3, optional — only if `logs` is configured)

| Tool | What it does |
|---|---|
| `logs_tail` | Get the most recent log entries from a source. |
| `logs_get` | Get log entries filtered by source, level, time range. |
| `logs_search` | Search logs by regex pattern. |

### Database (3, optional — only if `database` is configured)

| Tool | What it does |
|---|---|
| `db_query` | Execute a read-only SQL query (SELECT only, auto-limited to 1000 rows). |
| `db_schema` | Get table/column/foreign key information. |
| `db_explain` | Get the query execution plan (EXPLAIN ANALYZE). |

---

## Available Prompts (7)

Prompts are pre-built conversation starters. Invoke them from your MCP client to start a QA workflow.

| Prompt | When to use it |
|---|---|
| `smoke-test` | Quick health check — navigate, screenshot, check for console errors and 4xx/5xx. |
| `full-qa` | Comprehensive pass — explore all pages, test forms, check a11y, responsive, generate HTML report. |
| `regression-test` | After a deploy — re-run key user flows, compare against a baseline session. |
| `accessibility-audit` | Audit ARIA labels, alt text, heading structure, keyboard navigation, contrast. |
| `form-test` | Test form validation — empty, valid, invalid, XSS payloads, boundary values. |
| `performance-check` | Check load times, large assets, slow API calls, excessive DOM nodes. |
| `visual-inventory` | Screenshot every page at desktop (1280x720), tablet (768x1024), mobile (375x667). |

All prompts accept a `url` argument. Some accept optional extras (`scope`, `baseline_session_id`, `form_selector`).

---

## How to QA a Web App

### Recommended flow

1. **Navigate** to the target URL with `browser_navigate`.
2. **Explore** — click through pages, check navigation, screenshot key states.
3. **Test forms** — fill with valid data, then invalid data, then empty. Check validation.
4. **Check accessibility** — use `browser_accessibility_tree` on each page.
5. **Check responsive** — use `browser_resize` to test mobile (375x667) and tablet (768x1024).
6. **Inspect network** — use `network_get_requests` to find slow or failed requests.
7. **Read source code** — use `code_search` and `code_read` to understand behavior and find root causes.
8. **Check logs** — if configured, use `logs_tail` to see server-side errors during your actions.
9. **Query database** — if configured, use `db_query` to verify data state after operations.
10. **File bugs** with `report_create_bug` for every issue found.
11. **Record findings** with `report_add_finding` for non-bug observations.
12. **Generate report** with `report_generate` (format: `html` for rich output).

### Filing bugs

Use `report_create_bug` with:
- **severity**: `critical` (app crashes, data loss), `major` (broken feature), `minor` (cosmetic/edge case), `cosmetic` (visual only)
- **stepsToReproduce**: Array of strings, step by step
- **expectedBehavior** and **actualBehavior**: Be specific
- **evidenceStepIds**: Reference step IDs from the session for screenshot evidence
- **url**: The page where the bug occurs

### Recording findings

Use `report_add_finding` with:
- **category**: `usability`, `performance`, `accessibility`, `security`, `suggestion`, `observation`
- **description**: What you found and why it matters
- **evidenceStepIds**: Reference steps with screenshots

---

## Configuration Reference

The config file is `f4tl.config.ts` at the project root. Use `defineConfig()` for type safety:

```typescript
import { defineConfig } from 'f4tl';

export default defineConfig({
  browser: {
    headless: true,           // false to watch the browser
    viewport: { width: 1280, height: 720 },
    timeout: 30_000,          // ms per action
  },
  session: {
    outputDir: '.f4tl/sessions',
    maxSteps: 1000,
    keepArtifacts: true,      // persist screenshots
  },
  codebase: {
    projectRoot: process.cwd(),
  },
  report: {
    outputDir: '.f4tl/reports',
  },
  dashboard: {
    port: 4173,
  },

  // Optional: auth for multi-role testing
  auth: {
    admin: {
      strategy: 'form',
      formLogin: {
        loginUrl: 'http://localhost:3000/login',
        usernameSelector: '#email',
        passwordSelector: '#password',
        submitSelector: 'button[type="submit"]',
        usernameEnv: 'ADMIN_EMAIL',
        passwordEnv: 'ADMIN_PASSWORD',
      },
    },
  },

  // Optional: tail server logs during testing
  logs: {
    backend: {
      type: 'process',
      command: 'docker',
      args: ['logs', '-f', 'my-api'],
      parser: 'json',
    },
  },

  // Optional: read-only database access
  database: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL,
    allowedTables: ['users', 'orders'],
  },
});
```

---

## Session Artifacts

Sessions are saved to `.f4tl/sessions/{sessionId}/`:

```
.f4tl/sessions/kFX9nmR5gBNZ/
  session.json          # Session metadata, steps (without screenshots), config
  {stepId}.png          # Screenshot for each step
  {stepId}.json         # Step metadata (action, url, title, duration, errors)
```

Reports are saved to `.f4tl/reports/`:

```
.f4tl/reports/
  report-{sessionId}.md     # Markdown report
  report-{sessionId}.json   # Machine-readable JSON
  report-{sessionId}.html   # Rich HTML with embedded screenshots
```

---

## CLI Commands

| Command | Description |
|---|---|
| `f4tl serve [--headless] [--dashboard]` | Start the MCP server |
| `f4tl init [--force]` | Generate config with auto-detection |
| `f4tl dashboard [--port]` | Browse historical sessions (standalone) |
| `f4tl sessions [--json] [--limit]` | List past sessions |
| `f4tl clean [--sessions] [--reports] [--all] [--older-than] [--dry-run]` | Clean up artifacts |

---

## Tips

- **Always screenshot before and after actions** — screenshots are your evidence for bugs.
- **Use `browser_evaluate` for complex checks** — e.g. `document.querySelectorAll('img:not([alt])').length` to count images without alt text.
- **Use `network_get_requests` after page loads** — filter by `statusMin: 400` to find failed requests.
- **Use `code_search` to understand behavior** — when you see unexpected UI behavior, search the source to understand why.
- **Test at multiple viewports** — resize to 375x667 (mobile), 768x1024 (tablet), 1280x720 (desktop).
- **File bugs immediately** — don't wait until the end. File as you find them so evidence step IDs are fresh.
- **End with `report_generate` format `html`** — it produces the richest output with embedded screenshots.
- **Use `report_get_session_summary` to check progress** — see how many steps, bugs, and findings you've recorded so far.
