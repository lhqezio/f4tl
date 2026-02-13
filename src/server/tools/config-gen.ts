import { z } from 'zod';
import type { CodeExplorer } from '../../core/code-explorer.js';
import type { CodebaseConfig, ToolResult } from '../../types/index.js';
import { detectFrameworkFromPackageJson } from '../../core/framework-detector.js';

export const generateConfigSchema = z.object({
  projectRoot: z
    .string()
    .optional()
    .describe('Project root directory (defaults to configured codebase.projectRoot)'),
});

export class ConfigGenTools {
  constructor(
    private codeExplorer: CodeExplorer,
    private codebaseConfig: CodebaseConfig,
  ) {}

  async generateConfig(params: z.infer<typeof generateConfigSchema>): Promise<ToolResult> {
    const root = params.projectRoot ?? this.codebaseConfig.projectRoot;

    try {
      const analysis = await this.analyzeProject(root);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2),
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

  private async analyzeProject(root: string) {
    // Run all analysis steps concurrently
    const [
      framework,
      packageInfo,
      envVars,
      authPatterns,
      routes,
      dbPatterns,
      webhookPatterns,
      baseUrl,
    ] = await Promise.all([
      this.detectFramework(root),
      this.analyzePackageJson(root),
      this.findEnvVars(root),
      this.findAuthPatterns(),
      this.findRoutes(),
      this.findDatabasePatterns(),
      this.findWebhookPatterns(),
      this.findBaseUrl(),
    ]);

    return {
      projectRoot: root,
      framework,
      packageInfo,
      envVars,
      authPatterns,
      routes,
      databasePatterns: dbPatterns,
      webhookPatterns,
      baseUrl,
      instructions:
        'Use these findings to compose an f4tl.config.ts file. Import { defineConfig } from "f4tl" and call defineConfig({...}). Configure sections based on what was detected above.',
    };
  }

  private async detectFramework(root: string) {
    try {
      const result = await detectFrameworkFromPackageJson(root);
      return {
        name: result.framework,
        version: result.version,
        database: result.database,
      };
    } catch {
      return { name: null, version: null, database: null };
    }
  }

  private async analyzePackageJson(_root: string) {
    try {
      const content = await this.codeExplorer.readFile('package.json');
      const pkg = JSON.parse(content.content);
      return {
        name: pkg.name ?? null,
        scripts: pkg.scripts ?? {},
      };
    } catch {
      return { name: null, scripts: {} };
    }
  }

  private async findEnvVars(_root?: string) {
    try {
      const envFiles = await this.codeExplorer.findFiles('**/.env*', { maxResults: 10 });
      const varNames: Record<string, string[]> = {};
      for (const file of envFiles) {
        try {
          const { content } = await this.codeExplorer.readFile(file);
          const names = content
            .split('\n')
            .filter((line: string) => line.includes('=') && !line.startsWith('#'))
            .map((line: string) => line.split('=')[0].trim())
            .filter(Boolean);
          varNames[file] = names;
        } catch {
          // skip unreadable files
        }
      }
      return varNames;
    } catch {
      return {};
    }
  }

  private async findAuthPatterns() {
    const patterns: string[] = [];
    try {
      const passwordInputs = await this.codeExplorer.search('type="password"', { maxResults: 5 });
      if (passwordInputs.length > 0) patterns.push('form-login');

      const jwtUsage = await this.codeExplorer.search('jsonwebtoken|jose|jwt\\.sign|jwt\\.verify', {
        maxResults: 5,
      });
      if (jwtUsage.length > 0) patterns.push('jwt');

      const oauthUsage = await this.codeExplorer.search('passport|next-auth|@auth/|oauth2', {
        maxResults: 5,
      });
      if (oauthUsage.length > 0) patterns.push('oauth');
    } catch {
      // search failures are non-fatal
    }
    return patterns;
  }

  private async findRoutes() {
    const found: { type: string; paths: string[] }[] = [];
    try {
      // Next.js app router
      const appPages = await this.codeExplorer.findFiles('**/app/**/page.{tsx,jsx,ts,js}', {
        maxResults: 50,
      });
      if (appPages.length > 0) {
        found.push({ type: 'next-app-router', paths: appPages });
      }

      // Next.js pages router
      const pagesRouter = await this.codeExplorer.findFiles('**/pages/**/*.{tsx,jsx,ts,js}', {
        maxResults: 50,
      });
      // Filter out _app, _document, api routes for route detection
      const pageRoutes = pagesRouter.filter(
        (p) => !p.includes('_app') && !p.includes('_document') && !p.includes('/api/'),
      );
      if (pageRoutes.length > 0 && appPages.length === 0) {
        found.push({ type: 'next-pages-router', paths: pageRoutes });
      }

      // Express/Hono route definitions
      const expressRoutes = await this.codeExplorer.search(
        '\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'"`]/',
        { maxResults: 30 },
      );
      if (expressRoutes.length > 0) {
        found.push({
          type: 'express-routes',
          paths: expressRoutes.map((m) => `${m.file}:${m.line}`),
        });
      }
    } catch {
      // search failures are non-fatal
    }
    return found;
  }

  private async findDatabasePatterns() {
    const patterns: string[] = [];
    try {
      const dbUrl = await this.codeExplorer.search('DATABASE_URL', { maxResults: 3 });
      if (dbUrl.length > 0) patterns.push('DATABASE_URL');

      const prisma = await this.codeExplorer.findFiles('**/prisma/schema.prisma', {
        maxResults: 1,
      });
      if (prisma.length > 0) patterns.push('prisma');

      const drizzle = await this.codeExplorer.findFiles('**/drizzle.config.{ts,js}', {
        maxResults: 1,
      });
      if (drizzle.length > 0) patterns.push('drizzle');
    } catch {
      // search failures are non-fatal
    }
    return patterns;
  }

  private async findWebhookPatterns() {
    const patterns: string[] = [];
    try {
      const webhook = await this.codeExplorer.search('webhook|stripe\\.events|svix', {
        maxResults: 5,
      });
      if (webhook.length > 0) {
        patterns.push(...webhook.map((m) => `${m.file}:${m.line}`));
      }
    } catch {
      // non-fatal
    }
    return patterns;
  }

  private async findBaseUrl() {
    const candidates: string[] = [];
    try {
      const portMatches = await this.codeExplorer.search(
        'PORT\\s*=\\s*\\d+|listen\\(\\s*\\d+|localhost:\\d+',
        { maxResults: 10 },
      );
      for (const m of portMatches) {
        const portMatch = m.text.match(/(?:PORT\s*=\s*|listen\(\s*|localhost:)(\d+)/);
        if (portMatch) {
          const port = portMatch[1];
          if (!candidates.includes(`http://localhost:${port}`)) {
            candidates.push(`http://localhost:${port}`);
          }
        }
      }
    } catch {
      // non-fatal
    }
    return candidates;
  }
}
