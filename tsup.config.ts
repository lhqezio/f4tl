import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'bin/f4tl': 'bin/f4tl.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: true,
    target: 'node22',
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: false,
    target: 'node22',
    outDir: 'dist',
  },
]);
