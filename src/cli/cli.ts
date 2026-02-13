import { defineCommand } from 'citty';
import { writeFile, readdir, stat, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const serveCommand = defineCommand({
  meta: { name: 'serve', description: 'Start the f4tl MCP server' },
  args: {
    headless: {
      type: 'boolean',
      description: 'Run browser in headless mode',
    },
    dashboard: {
      type: 'boolean',
      description: 'Co-host the live dashboard with the MCP server',
      default: false,
    },
  },
  async run({ args }) {
    // Dynamic imports to keep CLI startup fast
    const { loadF4tlConfig } = await import('../config/loader.js');
    const { F4tlServer } = await import('../server/mcp-server.js');

    const overrides: Record<string, unknown> = {};
    if (args.headless !== undefined) {
      overrides.browser = { headless: args.headless };
    }

    const config = await loadF4tlConfig(overrides as never);
    console.error('[f4tl] Config loaded');

    const server = new F4tlServer(config);
    await server.start();

    if (args.dashboard) {
      const { DashboardServer } = await import('../dashboard/server.js');
      const dashboard = new DashboardServer(
        config.dashboard,
        config.session,
        server.getSessionManager(),
        server.getReportManager(),
      );
      await dashboard.start();
    }

    // Keep the process alive
    await new Promise(() => {});
  },
});

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Create a starter f4tl.config.ts with auto-detected settings',
  },
  args: {
    force: {
      type: 'boolean',
      description: 'Overwrite existing config',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const configPath = join(cwd, 'f4tl.config.ts');

    // --- Auto-detect from package.json ---
    let detectedFramework: string | null = null;
    let detectedDatabase = false;
    const frameworkMap: Record<string, string> = {
      next: 'Next.js',
      nuxt: 'Nuxt',
      vite: 'Vite',
      remix: 'Remix',
      '@remix-run/react': 'Remix',
      express: 'Express',
      fastify: 'Fastify',
      astro: 'Astro',
    };
    const dbPackages = ['pg', 'prisma', 'drizzle-orm', 'typeorm', 'sequelize'];

    try {
      const pkgRaw = await readFile(join(cwd, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      } as Record<string, string>;

      for (const [key, label] of Object.entries(frameworkMap)) {
        if (allDeps[key]) {
          detectedFramework = label;
          break;
        }
      }

      for (const dbPkg of dbPackages) {
        if (allDeps[dbPkg]) {
          detectedDatabase = true;
          break;
        }
      }
    } catch {
      // No package.json — that's fine, skip detection
    }

    // --- Detection summary ---
    const detections: string[] = [];
    if (detectedFramework) detections.push(`${detectedFramework} project`);
    if (detectedDatabase) detections.push('PostgreSQL');
    if (detections.length > 0) {
      console.error(`[f4tl] Detected: ${detections.join(' with ')}`);
    }

    // --- Build extra excludePatterns based on framework ---
    const extraExcludes: string[] = [];
    if (detectedFramework === 'Next.js') extraExcludes.push('.next');
    if (detectedFramework === 'Nuxt') extraExcludes.push('.nuxt');
    if (detectedFramework === 'Vite') extraExcludes.push('dist');
    if (detectedFramework === 'Remix') extraExcludes.push('build', 'public/build');
    if (detectedFramework === 'Astro') extraExcludes.push('dist', '.astro');

    // --- Build template ---
    const frameworkComment = detectedFramework ? `  // Auto-detected: ${detectedFramework}\n` : '';

    const excludeBlock =
      extraExcludes.length > 0
        ? `    excludePatterns: [${extraExcludes.map((e) => `'${e}'`).join(', ')}],\n`
        : '';

    const databaseBlock = detectedDatabase
      ? `
  // Database detected — uncomment and configure:
  // database: {
  //   type: 'postgres',
  //   connectionString: process.env.DATABASE_URL,
  // },
`
      : '';

    const template = `import { defineConfig } from 'f4tl';

export default defineConfig({
${frameworkComment}  browser: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  session: {
    outputDir: '.f4tl/sessions',
  },
  capture: {
    format: 'png',
  },
  codebase: {
    projectRoot: process.cwd(),
${excludeBlock}  },${databaseBlock}
});
`;

    try {
      await writeFile(configPath, template, { flag: args.force ? 'w' : 'wx' });
      console.log(`Created ${configPath}`);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        console.error('Config already exists. Use --force to overwrite.');
        process.exit(1);
      }
      throw err;
    }
  },
});

const cleanCommand = defineCommand({
  meta: {
    name: 'clean',
    description: 'Remove generated sessions, reports, or the entire .f4tl directory',
  },
  args: {
    sessions: {
      type: 'boolean',
      description: 'Only clean the sessions directory',
      default: false,
    },
    reports: {
      type: 'boolean',
      description: 'Only clean the reports directory',
      default: false,
    },
    all: {
      type: 'boolean',
      description: 'Remove the entire .f4tl directory',
      default: false,
    },
    'older-than': {
      type: 'string',
      description: 'Only remove items older than N days',
    },
    'dry-run': {
      type: 'boolean',
      description: 'Print what would be deleted without actually deleting',
      default: false,
    },
  },
  async run({ args }) {
    const { loadF4tlConfig } = await import('../config/loader.js');
    const config = await loadF4tlConfig();

    const sessionsDir = config.session.outputDir;
    const reportsDir = config.report.outputDir;
    const dryRun = args['dry-run'];
    const olderThanDays = args['older-than'] ? parseInt(args['older-than'], 10) : undefined;

    if (args.all) {
      // Remove the parent .f4tl directory (common ancestor) or both configured dirs
      const parentDir = join(process.cwd(), '.f4tl');
      if (dryRun) {
        console.log(`Would remove: ${parentDir}`);
      } else {
        await rm(parentDir, { recursive: true, force: true });
        console.log(`Removed: ${parentDir}`);
      }
      return;
    }

    // Determine which dirs to clean
    const targetSessions = args.sessions || (!args.sessions && !args.reports);
    const targetReports = args.reports || (!args.sessions && !args.reports);

    let sessionsCount = 0;
    let reportsCount = 0;
    let totalBytes = 0;

    async function getDirSize(dirPath: string): Promise<number> {
      let size = 0;
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = join(dirPath, entry.name);
          if (entry.isDirectory()) {
            size += await getDirSize(entryPath);
          } else {
            const s = await stat(entryPath);
            size += s.size;
          }
        }
      } catch {
        // directory may not exist
      }
      return size;
    }

    async function cleanDir(dirPath: string, _label: string): Promise<number> {
      const resolvedDir = join(process.cwd(), dirPath);
      let cleaned = 0;
      try {
        const entries = await readdir(resolvedDir, { withFileTypes: true });
        const now = Date.now();

        for (const entry of entries) {
          const entryPath = join(resolvedDir, entry.name);
          if (olderThanDays !== undefined) {
            const s = await stat(entryPath);
            const ageDays = (now - s.mtimeMs) / (1000 * 60 * 60 * 24);
            if (ageDays < olderThanDays) continue;
          }
          if (dryRun) {
            const size = entry.isDirectory()
              ? await getDirSize(entryPath)
              : (await stat(entryPath)).size;
            totalBytes += size;
            console.log(`Would remove: ${entryPath}`);
          } else {
            const size = entry.isDirectory()
              ? await getDirSize(entryPath)
              : (await stat(entryPath)).size;
            totalBytes += size;
            await rm(entryPath, { recursive: true, force: true });
          }
          cleaned++;
        }
      } catch {
        // directory does not exist — nothing to clean
      }
      return cleaned;
    }

    if (targetSessions) {
      sessionsCount = await cleanDir(sessionsDir, 'sessions');
    }
    if (targetReports) {
      reportsCount = await cleanDir(reportsDir, 'reports');
    }

    const bytesLabel =
      totalBytes < 1024
        ? `${totalBytes} bytes`
        : totalBytes < 1024 * 1024
          ? `${(totalBytes / 1024).toFixed(1)} KB`
          : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

    if (dryRun) {
      console.log(
        `Would clean ${sessionsCount} sessions, ${reportsCount} reports (${bytesLabel} freed)`,
      );
    } else {
      console.log(
        `Cleaned ${sessionsCount} sessions, ${reportsCount} reports (${bytesLabel} freed)`,
      );
    }
  },
});

const sessionsCommand = defineCommand({
  meta: { name: 'sessions', description: 'List recorded sessions' },
  args: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
    limit: {
      type: 'string',
      description: 'Maximum number of sessions to display',
    },
  },
  async run({ args }) {
    const { loadF4tlConfig } = await import('../config/loader.js');
    const config = await loadF4tlConfig();

    const sessionsDir = join(process.cwd(), config.session.outputDir);
    let entries: string[];
    try {
      const dirEntries = await readdir(sessionsDir, { withFileTypes: true });
      entries = dirEntries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      entries = [];
    }

    interface SessionInfo {
      id: string;
      startTime: string;
      duration: string;
      stepCount: number;
      status: string;
    }

    const sessions: SessionInfo[] = [];

    for (const dirName of entries) {
      const sessionJsonPath = join(sessionsDir, dirName, 'session.json');
      try {
        const raw = await readFile(sessionJsonPath, 'utf-8');
        const data = JSON.parse(raw);

        const startMs = data.startTime ? new Date(data.startTime).getTime() : 0;
        const endMs = data.endTime ? new Date(data.endTime).getTime() : 0;
        const durationMs = endMs && startMs ? endMs - startMs : 0;

        const durationStr = durationMs ? formatDuration(durationMs) : '-';

        sessions.push({
          id: data.id ?? dirName,
          startTime: data.startTime ? new Date(data.startTime).toLocaleString() : 'unknown',
          duration: durationStr,
          stepCount: Array.isArray(data.steps) ? data.steps.length : 0,
          status: data.endTime ? 'completed' : 'unknown',
        });
      } catch {
        // skip directories without a valid session.json
      }
    }

    // Sort by startTime descending (newest first)
    sessions.sort((a, b) => {
      if (a.startTime === 'unknown') return 1;
      if (b.startTime === 'unknown') return -1;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    const limit = args.limit ? parseInt(args.limit, 10) : undefined;
    const displayed = limit ? sessions.slice(0, limit) : sessions;

    if (args.json) {
      console.log(JSON.stringify(displayed, null, 2));
      return;
    }

    if (displayed.length === 0) {
      console.log('No sessions found.');
      return;
    }

    // Print formatted table
    const idWidth = Math.max(4, ...displayed.map((s) => s.id.length));
    const startWidth = Math.max(10, ...displayed.map((s) => s.startTime.length));
    const durWidth = Math.max(8, ...displayed.map((s) => s.duration.length));
    const stepsWidth = 5;
    const statusWidth = Math.max(6, ...displayed.map((s) => s.status.length));

    const header = [
      'ID'.padEnd(idWidth),
      'Started'.padEnd(startWidth),
      'Duration'.padEnd(durWidth),
      'Steps'.padEnd(stepsWidth),
      'Status'.padEnd(statusWidth),
    ].join('  ');

    console.log(header);
    console.log('-'.repeat(header.length));

    for (const s of displayed) {
      console.log(
        [
          s.id.padEnd(idWidth),
          s.startTime.padEnd(startWidth),
          s.duration.padEnd(durWidth),
          String(s.stepCount).padEnd(stepsWidth),
          s.status.padEnd(statusWidth),
        ].join('  '),
      );
    }
  },
});

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}

const dashboardCommand = defineCommand({
  meta: {
    name: 'dashboard',
    description: 'Start the dashboard UI to browse historical sessions',
  },
  args: {
    port: {
      type: 'string',
      description: 'Dashboard port',
    },
  },
  async run({ args }) {
    const { loadF4tlConfig } = await import('../config/loader.js');
    const { DashboardServer } = await import('../dashboard/server.js');

    const overrides: Record<string, unknown> = {};
    if (args.port) {
      overrides.dashboard = { port: parseInt(args.port, 10) };
    }

    const config = await loadF4tlConfig(overrides as never);

    // Standalone mode — no MCP session manager, just browse historical data
    const dashboard = new DashboardServer(config.dashboard, config.session, null, null);
    await dashboard.start();

    console.error('[f4tl] Dashboard running in standalone mode (historical sessions only)');
    await new Promise(() => {});
  },
});

export const main = defineCommand({
  meta: {
    name: 'f4tl',
    version: '0.1.0',
    description: 'MCP server for autonomous full-stack QA',
  },
  subCommands: {
    serve: serveCommand,
    init: initCommand,
    clean: cleanCommand,
    sessions: sessionsCommand,
    dashboard: dashboardCommand,
  },
});
