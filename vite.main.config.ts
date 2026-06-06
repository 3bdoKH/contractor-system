import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'pdfkit', 'electron', 'node:path', 'node:fs', 'node:os', 'node:crypto', 'node:stream', 'node:buffer', 'node:util', 'node:events', 'node:zlib'],
    },
  },
});