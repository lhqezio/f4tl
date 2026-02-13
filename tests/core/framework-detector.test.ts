import { describe, it, expect, vi } from 'vitest';
import {
  detectFrameworkFromPackageJson,
  getFrameworkHints,
  detectFramework,
} from '../../src/core/framework-detector.js';

// Mock fs/promises for package.json reading
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual('node:fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

import { readFile } from 'node:fs/promises';
const mockedReadFile = vi.mocked(readFile);

describe('detectFrameworkFromPackageJson', () => {
  it('detects Next.js from dependencies', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.2.0' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBe('Next.js');
    expect(result.version).toBe('14.0.0');
  });

  it('detects Nuxt from devDependencies', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        devDependencies: { nuxt: '~3.8.0' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBe('Nuxt');
  });

  it('detects Remix via @remix-run/react', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { '@remix-run/react': '^2.0.0' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBe('Remix');
  });

  it('detects database package', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { express: '^4.18.0', pg: '^8.11.0' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBe('Express');
    expect(result.database).toBe('pg');
  });

  it('returns null framework when no matching deps', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { lodash: '^4.17.21' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBeNull();
  });

  it('returns null framework when no package.json', async () => {
    mockedReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBeNull();
  });

  it('detects Angular', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { '@angular/core': '^17.0.0' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBe('Angular');
  });

  it('detects SvelteKit', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        devDependencies: { '@sveltejs/kit': '^2.0.0' },
      }),
    );

    const result = await detectFrameworkFromPackageJson('/fake/project');
    expect(result.framework).toBe('SvelteKit');
  });
});

describe('getFrameworkHints', () => {
  it('returns hints for Next.js', () => {
    const hints = getFrameworkHints('Next.js');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.category === 'input')).toBe(true);
    expect(hints.some((h) => h.category === 'navigation')).toBe(true);
  });

  it('returns hints for Vue', () => {
    const hints = getFrameworkHints('Vue');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.tip.includes('v-model'))).toBe(true);
  });

  it('returns empty array for unknown framework', () => {
    expect(getFrameworkHints('UnknownFW')).toEqual([]);
  });

  it('returns empty array for null framework', () => {
    expect(getFrameworkHints(null)).toEqual([]);
  });
});

describe('detectFramework', () => {
  it('combines package.json and returns SPA flag for Next.js', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { next: '^14.0.0' },
      }),
    );

    const result = await detectFramework('/fake/project');
    expect(result.framework).toBe('Next.js');
    expect(result.isSPA).toBe(true);
    expect(result.hints.length).toBeGreaterThan(0);
  });

  it('returns isSPA false for Express', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { express: '^4.18.0' },
      }),
    );

    const result = await detectFramework('/fake/project');
    expect(result.framework).toBe('Express');
    expect(result.isSPA).toBe(false);
  });

  it('includes database info when detected', async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        dependencies: { next: '^14.0.0', prisma: '^5.0.0' },
      }),
    );

    const result = await detectFramework('/fake/project');
    expect(result.database).toBe('prisma');
  });
});
