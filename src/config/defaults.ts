import type { F4tlConfig } from '../types/index.js';

export const DEFAULT_CONFIG: F4tlConfig = {
  browser: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    slowMo: 0,
    timeout: 30_000,
    devtools: false,
    args: [],
  },
  session: {
    outputDir: '.f4tl/sessions',
    maxSteps: 1000,
    keepArtifacts: true,
  },
  capture: {
    format: 'png',
    quality: 90,
    fullPage: false,
    animations: 'disabled',
  },
  mcp: {
    name: 'f4tl',
    version: '0.1.0',
    logLevel: 'info',
  },
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
  report: {
    outputDir: '.f4tl/reports',
  },
  dashboard: {
    port: 4173,
    host: 'localhost',
  },
};
