import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // three.js nặng ~700KB, chấp nhận được cho game
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node' },
} as never);
