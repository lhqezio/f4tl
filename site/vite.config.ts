import { defineConfig } from 'vite';

export default defineConfig({
  base: '/f4tl/',
  build: {
    outDir: '../dist/site',
    emptyOutDir: true,
  },
});
