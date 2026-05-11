import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      manifest: false,
      devOptions: {
        enabled: false,
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{html,js,css,ico,png,svg,webmanifest}'],
        globIgnores: ['**/node_modules/**', 'offline.html'],
      },
    }),
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Inline assets smaller than 4 KB
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Stable chunk names so SW precache hashes are deterministic
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    // Proxy API + uploads to the Node server in development
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  // Service Worker is a separate entry point — Vite must not tree-shake it
  worker: {
    format: 'es',
  },
});
