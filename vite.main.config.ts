import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['pdfkit', 'electron', 'node:path', 'node:fs', 'node:os', 'node:crypto', 'node:stream', 'node:buffer', 'node:util', 'node:events', 'node:zlib'],
    },
  },
});