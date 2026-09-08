import { defineConfig } from 'vite';

export default defineConfig({
  root: 'game/client',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '^/api/': 'http://127.0.0.1:3001' },
  },
  // Offline browser evidence uses the frozen production bundle on the same local URL.
  preview: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '^/api/': 'http://127.0.0.1:3001' } },
  build: { outDir: '../../dist/client', emptyOutDir: true },
});
