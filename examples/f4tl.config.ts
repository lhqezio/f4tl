import { defineConfig } from 'f4tl';

export default defineConfig({
  // ── Browser ───────────────────────────────────────────────────────────────
  browser: {
    headless: true, // false to watch the browser
    viewport: { width: 1280, height: 720 },
    slowMo: 0, // ms delay between actions (useful for debugging)
    timeout: 30_000, // default action timeout
    // devtools: true,
    // args: ['--disable-web-security'],
  },

  // ── Session ───────────────────────────────────────────────────────────────
  session: {
    outputDir: '.f4tl/sessions',
    maxSteps: 1000, // safety limit per session
    keepArtifacts: true, // persist screenshots + session.json
  },

  // ── Screenshots ───────────────────────────────────────────────────────────
  capture: {
    format: 'png', // or 'jpeg'
    quality: 90, // jpeg quality (1-100)
    fullPage: false,
    animations: 'disabled', // freeze animations for consistent shots
  },

  // ── Codebase ──────────────────────────────────────────────────────────────
  codebase: {
    projectRoot: process.cwd(),
    excludePatterns: [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.nuxt',
      '.f4tl',
    ],
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  report: {
    outputDir: '.f4tl/reports',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    port: 4173,
    host: 'localhost',
  },

  // ── MCP Server ────────────────────────────────────────────────────────────
  mcp: {
    name: 'f4tl',
    version: '0.1.0',
    logLevel: 'info', // debug | info | warn | error
  },

  // ── Auth (optional) ───────────────────────────────────────────────────────
  // Uncomment one strategy per role.
  //
  // auth: {
  //   admin: {
  //     strategy: 'form',
  //     formLogin: {
  //       loginUrl: 'http://localhost:3000/login',
  //       usernameSelector: '#email',
  //       passwordSelector: '#password',
  //       submitSelector: 'button[type="submit"]',
  //       usernameEnv: 'ADMIN_EMAIL',
  //       passwordEnv: 'ADMIN_PASSWORD',
  //     },
  //   },
  //   viewer: {
  //     strategy: 'cookie',
  //     cookies: {
  //       domain: 'localhost',
  //       items: [{ name: 'session', valueEnv: 'VIEWER_SESSION_TOKEN' }],
  //     },
  //   },
  // },

  // ── Logs (optional) ───────────────────────────────────────────────────────
  // Named log sources — process (tail a running command) or file (tail a log file).
  //
  // logs: {
  //   backend: {
  //     type: 'process',
  //     command: 'docker',
  //     args: ['logs', '-f', 'my-api'],
  //     parser: 'json', // json (pino/winston) | clf | plain
  //   },
  //   nginx: {
  //     type: 'file',
  //     path: '/var/log/nginx/access.log',
  //     parser: 'clf',
  //   },
  // },

  // ── Database (optional) ───────────────────────────────────────────────────
  // Read-only SQL queries only. PostgreSQL supported.
  //
  // database: {
  //   type: 'postgres',
  //   connectionString: process.env.DATABASE_URL,
  //   // Or use individual fields:
  //   // host: 'localhost',
  //   // port: 5432,
  //   // database: 'myapp',
  //   // user: 'readonly',
  //   // password: process.env.DB_PASSWORD,
  //   allowedTables: ['users', 'orders', 'products'],
  //   maxConnections: 3,
  //   queryTimeout: 10_000,
  // },
});
