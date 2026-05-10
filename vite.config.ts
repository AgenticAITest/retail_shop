import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: [
      "127.0.0.1",
      "change.this.from.replit.dev",
    ],
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Retail POS',
        short_name: 'POS',
        description: 'Multi-Shop Retail POS System',
        theme_color: '#1e293b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/pos',
        icons: [
          { src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB for large bundles
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // App shell — CacheFirst
            urlPattern: /\.(js|css|html|ico|png|svg|woff2)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'app-shell', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
          {
            // Product catalog + tax config — StaleWhileRevalidate with 24h TTL
            urlPattern: /\/api\/modules\/(product-catalog|tax-configuration|location-management)\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-catalog', expiration: { maxAgeSeconds: 24 * 60 * 60 } },
          },
          {
            // POS transaction API — NetworkFirst
            urlPattern: /\/api\/modules\/pos\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-pos', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
    // Sentry source-map upload — only active when SENTRY_AUTH_TOKEN is present (CI/CD)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "./src/client"),
      "@server": path.resolve(__dirname, "./src/server"),
      "@modules": path.resolve(__dirname, "./src/modules"),
    },
  },
});
