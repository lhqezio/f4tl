import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';

export interface FrameworkHint {
  tip: string;
  category: 'input' | 'navigation' | 'wait' | 'general';
}

export interface FrameworkDetectionResult {
  framework: string | null;
  version?: string;
  isSPA: boolean;
  database?: string;
  hints: FrameworkHint[];
}

const FRAMEWORK_MAP: Record<string, string> = {
  next: 'Next.js',
  nuxt: 'Nuxt',
  vite: 'Vite',
  remix: 'Remix',
  '@remix-run/react': 'Remix',
  express: 'Express',
  fastify: 'Fastify',
  astro: 'Astro',
  'react-scripts': 'Create React App',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  '@sveltejs/kit': 'SvelteKit',
  vue: 'Vue',
};

const DB_PACKAGES = ['pg', 'prisma', 'drizzle-orm', 'typeorm', 'sequelize', 'mongoose', 'knex'];

const SPA_FRAMEWORKS = new Set([
  'Next.js',
  'Nuxt',
  'Remix',
  'Create React App',
  'Angular',
  'SvelteKit',
  'Vue',
  'Vite',
]);

const FRAMEWORK_HINTS: Record<string, FrameworkHint[]> = {
  'Next.js': [
    { tip: 'Use type() instead of fill() for controlled React inputs', category: 'input' },
    {
      tip: 'Wait for hydration after navigation (waitForLoadState "networkidle")',
      category: 'wait',
    },
    {
      tip: 'SPA navigation: URL changes without full page load — use waitForURL()',
      category: 'navigation',
    },
    { tip: 'Check for __NEXT_DATA__ in page for SSR/SSG detection', category: 'general' },
  ],
  Nuxt: [
    { tip: 'Vue v-model inputs need type() tool for reactivity', category: 'input' },
    { tip: 'SPA navigation: use waitForURL() instead of waitForLoadState', category: 'navigation' },
    { tip: 'Check for __NUXT__ global for SSR state', category: 'general' },
  ],
  Remix: [
    {
      tip: 'Forms submit via fetch — wait for network idle after form submission',
      category: 'wait',
    },
    { tip: 'SPA navigation with route transitions — use waitForURL()', category: 'navigation' },
    { tip: 'Check for __remixContext global', category: 'general' },
  ],
  'Create React App': [
    { tip: 'Use type() instead of fill() for controlled React inputs', category: 'input' },
    { tip: 'SPA — all navigation is client-side, use waitForURL()', category: 'navigation' },
  ],
  Angular: [
    {
      tip: 'Angular change detection may delay UI updates — add short waits after actions',
      category: 'wait',
    },
    { tip: 'SPA navigation uses Angular router — use waitForURL()', category: 'navigation' },
  ],
  SvelteKit: [
    { tip: 'SPA navigation with page transitions — use waitForURL()', category: 'navigation' },
    { tip: 'Svelte inputs are reactive — type() works well', category: 'input' },
  ],
  Vue: [
    { tip: 'Vue v-model inputs need type() tool for reactivity', category: 'input' },
    { tip: 'SPA navigation — use waitForURL() for route changes', category: 'navigation' },
  ],
  Vite: [
    {
      tip: 'Vite HMR may cause page flickering during dev — wait for network idle',
      category: 'wait',
    },
  ],
};

export async function detectFrameworkFromPackageJson(
  projectRoot: string,
): Promise<{ framework: string | null; version?: string; database?: string }> {
  try {
    const pkgRaw = await readFile(join(projectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    } as Record<string, string>;

    let framework: string | null = null;
    let version: string | undefined;

    for (const [key, label] of Object.entries(FRAMEWORK_MAP)) {
      if (allDeps[key]) {
        framework = label;
        version = allDeps[key].replace(/^[\^~>=<]/, '');
        break;
      }
    }

    let database: string | undefined;
    for (const dbPkg of DB_PACKAGES) {
      if (allDeps[dbPkg]) {
        database = dbPkg;
        break;
      }
    }

    return { framework, version, database };
  } catch {
    return { framework: null };
  }
}

export async function detectFrameworkRuntime(
  page: Page,
): Promise<{ framework: string | null; isSPA: boolean }> {
  try {
    // page.evaluate runs in browser context — the function is serialized and executed there
    const result = await page.evaluate(
      /* istanbul ignore next */
      () => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const w = globalThis as any;
        const d = w.document as any;
        const detected: string[] = [];

        if (w.__NEXT_DATA__) detected.push('Next.js');
        if (w.__NUXT__) detected.push('Nuxt');
        if (w.__remixContext) detected.push('Remix');

        const rootEl = d.getElementById('root') || d.getElementById('__next');
        if (rootEl && rootEl._reactRootContainer) detected.push('React');

        if (d.querySelector('[ng-version]') || d.querySelector('[_ngcontent-]'))
          detected.push('Angular');

        if (d.querySelector('[data-v-]') || w.__VUE__) detected.push('Vue');

        if (d.querySelector('[class*="svelte-"]')) detected.push('Svelte');

        const hasSPARouter =
          !!d.querySelector('[data-reactroot]') ||
          !!d.querySelector('router-outlet') ||
          !!d.querySelector('[id="__nuxt"]') ||
          !!d.querySelector('[id="__next"]');

        return { frameworks: detected, hasSPARouter };
        /* eslint-enable @typescript-eslint/no-explicit-any */
      },
    );

    const framework = result.frameworks[0] ?? null;
    const isSPA = result.hasSPARouter || result.frameworks.length > 0;

    return { framework, isSPA };
  } catch {
    return { framework: null, isSPA: false };
  }
}

export function getFrameworkHints(framework: string | null): FrameworkHint[] {
  if (!framework) return [];
  return FRAMEWORK_HINTS[framework] ?? [];
}

export async function detectFramework(
  projectRoot: string,
  page?: Page,
): Promise<FrameworkDetectionResult> {
  const pkgResult = await detectFrameworkFromPackageJson(projectRoot);

  let runtimeResult: { framework: string | null; isSPA: boolean } = {
    framework: null,
    isSPA: false,
  };

  if (page) {
    runtimeResult = await detectFrameworkRuntime(page);
  }

  // Prefer package.json detection, fall back to runtime
  const framework = pkgResult.framework ?? runtimeResult.framework;
  const isSPA = framework ? SPA_FRAMEWORKS.has(framework) : runtimeResult.isSPA;
  const hints = getFrameworkHints(framework);

  return {
    framework,
    version: pkgResult.version,
    isSPA,
    database: pkgResult.database,
    hints,
  };
}
