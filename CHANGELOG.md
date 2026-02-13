# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2025-02-13

### Added

- MCP server with 29 tools across 6 categories
- 7 MCP prompts for common QA workflows (smoke-test, full-qa, regression-test, accessibility-audit, form-test, performance-check, visual-inventory)
- Browser automation via Playwright (15 tools): navigate, click, fill, type, select, hover, press, scroll, screenshot, evaluate, resize, wait, back, forward, accessibility tree
- Network capture and interception (4 tools): request inspection, mock/block/delay rules, WebSocket monitoring
- Code exploration (4 tools): ripgrep search, file reading, glob find, git diff
- Context management (2-3 tools): multi-browser-context, context switching, configurable auth
- Report system (4 tools): bug recording, finding recording, report generation (markdown/json/html), session summary
- Optional log collection (3 tools): tail, get with filters, regex search
- Optional database inspection (3 tools): read-only query, schema introspection, explain analyze
- Session tracking with step recording, screenshot capture, and artifact persistence
- Live dashboard: Hono REST API + WebSocket + React/Vite/Tailwind SPA
- CLI commands: serve, init (with auto-detect), dashboard, clean, sessions
- Configuration via `f4tl.config.ts` (c12 + Zod validation)
- Multi-auth strategies: form login, cookies, storage state, custom scripts
- Unit and integration test suite with fixture test app
