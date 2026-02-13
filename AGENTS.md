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
f4tl start
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

## Available Tools (42)

### Browser (15)

Use these to interact with the web app like a user.

| Tool                         | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| `browser_navigate`           | Go to a URL. Returns screenshot + console/network errors. |
| `browser_click`              | Click an element by CSS, text, role, or xpath selector.   |
| `browser_fill`               | Clear an input and type a value.                          |
| `browser_type`               | Type keystroke-by-keystroke (for autocomplete/search).    |
| `browser_select`             | Pick a dropdown option by value or label.                 |
| `browser_hover`              | Hover over an element (reveal tooltips, menus).           |
| `browser_press`              | Press a key combo (Enter, Tab, Control+a).                |
| `browser_scroll`             | Scroll page or a container element.                       |
| `browser_screenshot`         | Capture the current viewport without acting.              |
| `browser_evaluate`           | Run JavaScript in the page and return the result.         |
| `browser_resize`             | Change the viewport size (for responsive testing).        |
| `browser_wait`               | Wait for time, a selector, network idle, or URL change.   |
| `browser_back`               | Go back in browser history.                               |
| `browser_forward`            | Go forward in browser history.                            |
| `browser_accessibility_tree` | Get the page's accessibility tree (for a11y auditing).    |

### Network (4)

Use these to inspect and manipulate HTTP traffic.

| Tool                       | What it does                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `network_get_requests`     | Get captured requests/responses. Filter by URL pattern, method, status code, resource type. |
| `network_intercept`        | Add a rule to block, mock, or delay matching requests.                                      |
| `network_clear_intercepts` | Remove all intercept rules.                                                                 |
| `network_get_websockets`   | Get captured WebSocket messages.                                                            |

### Code (4)

Use these to read and search the project source code.

| Tool              | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `code_search`     | Search codebase with regex (ripgrep).          |
| `code_read`       | Read a file's contents.                        |
| `code_find_files` | Find files by glob pattern.                    |
| `code_git_diff`   | Get uncommitted changes or diff against a ref. |

### Context (2-3)

Use these for multi-user testing scenarios.

| Tool                     | What it does                                                     |
| ------------------------ | ---------------------------------------------------------------- |
| `browser_new_context`    | Create an isolated browser context (separate cookies, storage).  |
| `browser_switch_context` | Switch the active context by name.                               |
| `browser_auth`           | Authenticate with a configured role (only if auth is in config). |

### Report (4)

Use these to record issues and generate reports.

| Tool                         | What it does                                                              |
| ---------------------------- | ------------------------------------------------------------------------- |
| `report_create_bug`          | File a bug with severity, repro steps, expected/actual behavior.          |
| `report_add_finding`         | Record a QA finding (usability, performance, a11y, security, suggestion). |
| `report_generate`            | Generate a report in markdown, JSON, or HTML.                             |
| `report_get_session_summary` | Get current stats: step count, bugs, findings, duration.                  |

### Logs (3, optional — only if `logs` is configured)

| Tool          | What it does                                           |
| ------------- | ------------------------------------------------------ |
| `logs_tail`   | Get the most recent log entries from a source.         |
| `logs_get`    | Get log entries filtered by source, level, time range. |
| `logs_search` | Search logs by regex pattern.                          |

### Database (3, optional — only if `database` is configured)

| Tool         | What it does                                                            |
| ------------ | ----------------------------------------------------------------------- |
| `db_query`   | Execute a read-only SQL query (SELECT only, auto-limited to 1000 rows). |
| `db_schema`  | Get table/column/foreign key information.                               |
| `db_explain` | Get the query execution plan (EXPLAIN ANALYZE).                         |

### Webhook (2, optional — only if `webhooks` is configured)

Use these to test webhook handlers by discovering and firing synthetic events.

| Tool               | What it does                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `webhook_discover` | Scan project source code to find webhook endpoints, event types, signing, and handler files. |
| `webhook_fire`     | Fire a synthetic webhook event to an endpoint with optional signing and UI verification.     |

### Learning (3, optional — enabled by default)

Use these to query past session data and learn from previous test runs.

| Tool                  | What it does                                                                     |
| --------------------- | -------------------------------------------------------------------------------- |
| `session_get_history` | List past sessions with stats (steps, bugs, URLs covered, action types).         |
| `session_get_bugs`    | Get a bug ledger across all sessions with fingerprint-based dedup/recurrence.    |
| `session_compare`     | Compare two sessions — diff URLs, action types, and bugs (new/fixed/persistent). |

### Journey (3, optional — only if `journeys` is configured)

Use these to follow and track multi-step test flows defined in config.

| Tool             | What it does                                                                  |
| ---------------- | ----------------------------------------------------------------------------- |
| `list_journeys`  | List all journeys with descriptions, dependencies, mode, and step counts.     |
| `get_journey`    | Get a specific journey's full definition — steps, auth, mode, and state.      |
| `journey_status` | Get summary of all journey progress: completed, in-progress, pending, failed. |

### Auth (1, optional — only if `auth` is configured)

| Tool         | What it does                                                        |
| ------------ | ------------------------------------------------------------------- |
| `auth_login` | Authenticate with a configured role. Supports form, JWT, and OAuth. |

### Framework (1)

| Tool               | What it does                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `detect_framework` | Detect the project's frontend framework, version, SPA behavior, database, and get framework-specific testing hints. |

### App Profile (1, optional — only if `app` is configured)

| Tool              | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `get_app_profile` | Get the app profile — name, base URL, pages, roles, ignore patterns. |

### Error Suppression (1)

| Tool             | What it does                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `suppress_error` | Add a runtime pattern to suppress known console or network errors. |

### Config Generator (1)

| Tool              | What it does                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `generate_config` | Analyze the project (framework, routes, auth, database, env vars, base URL) to gather info for composing an f4tl.config.ts. |

---

## Available Prompts (10)

Prompts are pre-built conversation starters. Invoke them from your MCP client to start a QA workflow.

| Prompt                | When to use it                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `smoke-test`          | Quick health check — navigate, screenshot, check for console errors and 4xx/5xx.                  |
| `full-qa`             | Comprehensive pass — explore all pages, test forms, check a11y, responsive, generate HTML report. |
| `regression-test`     | After a deploy — re-run key user flows, compare against a baseline session.                       |
| `accessibility-audit` | Audit ARIA labels, alt text, heading structure, keyboard navigation, contrast.                    |
| `form-test`           | Test form validation — empty, valid, invalid, XSS payloads, boundary values.                      |
| `performance-check`   | Check load times, large assets, slow API calls, excessive DOM nodes.                              |
| `visual-inventory`    | Screenshot every page at desktop (1280x720), tablet (768x1024), mobile (375x667).                 |
| `multi-actor-test`    | Coordinated multi-user test — e.g. buyer + seller + escrow interacting in the same app.           |
| `webhook-test`        | Discover webhook endpoints, fire synthetic events, verify UI/state, test idempotency.             |
| `regression-run`      | Use session history to find gaps and regressions, then run targeted tests.                        |

All prompts accept a `url` argument. Some accept optional extras (`scope`, `baseline_session_id`, `form_selector`, `scenario`, `actors`).

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
- **contextId** (optional): The actor/context that encountered the bug (e.g. `"buyer"`, `"seller"`)

### Recording findings

Use `report_add_finding` with:

- **category**: `usability`, `performance`, `accessibility`, `security`, `suggestion`, `observation`
- **description**: What you found and why it matters
- **evidenceStepIds**: Reference steps with screenshots
- **contextId** (optional): The actor/context related to this finding

### Multi-Actor Testing

For scenarios involving multiple users (buyer/seller, admin/user, etc.), use the `multi-actor-test` prompt or orchestrate manually:

1. **Create contexts** — `browser_new_context` with a name per actor (e.g. `buyer`, `seller`).
2. **Authenticate** — `browser_auth` each context with its role (if auth is configured).
3. **Switch and act** — `browser_switch_context` before each actor's actions. All browser tools automatically tag steps with the active context.
4. **Cross-actor verification** — after one actor acts, switch to another and verify the state change is visible.
5. **File bugs with contextId** — use the `contextId` parameter on `report_create_bug` and `report_add_finding` to attribute issues to specific actors.
6. **Generate report** — the HTML report will show an "Actors" stat, context-colored timeline, and per-actor badges on bugs/findings.

Example `actors` argument for the prompt: `"buyer:buyer_role, seller:seller_role, admin:admin_role"`.

### Webhook Testing

For testing payment callbacks, GitHub webhooks, and other event-driven flows:

1. **Discover** — call `webhook_discover` to scan the codebase for webhook endpoints, event types, and signing providers.
2. **Set up state** — use browser tools to create the prerequisite state (e.g. create an order before testing `payment_intent.succeeded`).
3. **Fire events** — call `webhook_fire` with the event payload and signing provider. Use `verifyUi` to check the UI updated.
4. **Test idempotency** — fire the same event twice and verify no double-processing.
5. **Test error paths** — fire `payment_failed` after `payment_succeeded`, test webhook timeout recovery.
6. **File bugs** — use `report_create_bug` for any failures with evidence.

Or use the `webhook-test` prompt to automate this flow.

### Using Journeys

If the project has `journeys` configured, use them to follow structured test flows:

1. **List journeys** — call `list_journeys` to see all available flows, their dependencies, and suggested execution order.
2. **Follow the order** — execute journeys in dependency order. A journey with `dependsOn: ['login']` requires the `login` journey to complete first.
3. **Get journey details** — call `get_journey` with the journey name to see full step-by-step instructions.
4. **Two modes**:
   - `guided` — follow steps strictly, verify each `expect` assertion.
   - `autonomous` — use steps as a map, explore freely around the defined actions.
5. **Track progress** — call `journey_status` to see which journeys are complete, in progress, or failed.
6. **Auth per journey** — if a journey has `auth: 'buyer'`, authenticate with that role before starting.

### Framework-Aware Testing

Call `detect_framework` at the start of a session to get framework-specific hints:

- **React/Next.js**: Use `type()` instead of `fill()` for controlled inputs, wait for hydration after navigation.
- **Vue/Nuxt**: `v-model` inputs need `type()` tool for reactivity.
- **SPA frameworks**: Don't rely on full page loads — use `waitForURL()` for route changes.
- **The tool also reports**: database package in use, SPA behavior, and framework version.

### Self-Optimization

The agent gets smarter over time by learning from past sessions:

1. **Check coverage** — call `session_get_history` with `groupBy: 'url'` to see which pages are under-tested.
2. **Track regressions** — call `session_get_bugs` to see recurring bugs (same fingerprint across sessions).
3. **Compare runs** — call `session_compare` to diff two sessions and find gaps (URLs, action types, bugs).
4. **Targeted testing** — focus on under-tested areas and previously buggy pages.

Or use the `regression-run` prompt which automates this analysis-then-test workflow.

---

## Configuration Reference

The config file is `f4tl.config.ts` at the project root. Use `defineConfig()` for type safety:

```typescript
import { defineConfig } from 'f4tl';

export default defineConfig({
  browser: {
    headless: true, // false to watch the browser
    viewport: { width: 1280, height: 720 },
    timeout: 30_000, // ms per action
  },
  session: {
    outputDir: '.f4tl/sessions',
    maxSteps: 1000,
    keepArtifacts: true, // persist screenshots
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

  // Optional: auth for multi-role testing (form, jwt, oauth, cookie, storage-state, custom)
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
    apiUser: {
      strategy: 'jwt',
      jwt: {
        tokenEnv: 'API_TOKEN',
        storageKey: 'token',
        storageType: 'localStorage', // or 'sessionStorage', 'cookie'
      },
    },
  },

  // Optional: suppress known noisy errors
  capture: {
    suppressErrors: {
      console: ['ResizeObserver loop', 'third-party-script'],
      network: ['/analytics', '/tracking', 'hotjar.com'],
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

  // Optional: webhook testing
  webhooks: {
    baseUrl: 'http://localhost:3000',
    signingSecrets: {
      stripe: process.env.STRIPE_WEBHOOK_SECRET,
      github: process.env.GITHUB_WEBHOOK_SECRET,
    },
  },

  // Optional: self-optimization (enabled by default)
  learning: {
    enabled: true,
  },

  // Optional: app profile — gives the AI context about your app
  app: {
    name: 'My App',
    baseUrl: 'http://localhost:3000',
    description: 'E-commerce marketplace',
    pages: [
      { path: '/login', label: 'Login', priority: 'high' },
      { path: '/dashboard', label: 'Dashboard', auth: 'admin' },
      { path: '/products', label: 'Product catalog', priority: 'medium' },
    ],
    ignorePatterns: ['/api/health', '/static/*'],
  },

  // Optional: multi-step test flows
  journeys: {
    login: {
      description: 'User login flow',
      mode: 'guided',
      steps: [
        { action: 'navigate', target: '/login' },
        { action: 'fill', target: '#email', value: 'user@test.com' },
        { action: 'fill', target: '#password', value: 'pass123' },
        { action: 'click', target: 'button[type=submit]', expect: 'URL changes to /dashboard' },
      ],
    },
    checkout: {
      description: 'Checkout flow',
      auth: 'buyer',
      dependsOn: ['login'],
      mode: 'guided',
      steps: [
        { action: 'navigate', target: '/cart' },
        { action: 'click', target: '.checkout-btn' },
        { action: 'click', target: '#pay', expect: 'Order confirmation shown' },
      ],
    },
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

| Command                                                                  | Description                             |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `f4tl serve [--headless] [--dashboard]`                                  | Start the MCP server                    |
| `f4tl start [--headless]`                                                | Serve + dashboard (shortcut)            |
| `f4tl init [--force]`                                                    | Generate config with auto-detection     |
| `f4tl dashboard [--port]`                                                | Browse historical sessions (standalone) |
| `f4tl sessions [--json] [--limit]`                                       | List past sessions                      |
| `f4tl clean [--sessions] [--reports] [--all] [--older-than] [--dry-run]` | Clean up artifacts                      |

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
- **Run `detect_framework` first** — get framework-specific testing hints before you start testing.
- **Use `suppress_error` for noisy third-party errors** — e.g. analytics scripts, ResizeObserver warnings. Keeps reports clean.
- **Follow journeys when configured** — `list_journeys` → `get_journey` → execute steps → `journey_status` to track progress.
- **Use `get_app_profile` for context** — if the app profile is configured, it tells you what pages exist, which need auth, and what to ignore.
- **Use `generate_config` for new projects** — it analyzes framework, routes, auth patterns, database, env vars, and base URL to help you compose an optimal config.
