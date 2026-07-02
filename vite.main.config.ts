import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    build: {
      rollupOptions: {
        external: ['sql.js', 'pdfkit', 'electron', 'node:path', 'node:fs', 'node:os', 'node:crypto', 'node:stream', 'node:buffer', 'node:util', 'node:events', 'node:zlib', 'node:https'],
      },
    },
    define: {
      // Injected at build time — available as process.env.BOT_TOKEN in the main process bundle
      'process.env.BOT_TOKEN': JSON.stringify(env.BOT_TOKEN || ''),
    },
  };
});