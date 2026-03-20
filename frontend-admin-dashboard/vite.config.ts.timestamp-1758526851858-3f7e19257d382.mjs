// vite.config.ts
import react from "file:///D:/frontend-admin-dashboard/node_modules/.pnpm/@vitejs+plugin-react-swc@3._8f832d38584c602f153e23d406465dcc/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { defineConfig } from "file:///D:/frontend-admin-dashboard/node_modules/.pnpm/vite@5.4.19_@types+node@22.16.4_sass@1.51.0_terser@5.43.1/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///D:/frontend-admin-dashboard/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_t_59ba795212b5b150e9e707c9313553b5/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { TanStackRouterVite } from "file:///D:/frontend-admin-dashboard/node_modules/.pnpm/@tanstack+router-plugin@1.1_1ced4891676ab2d592bd222515687e6f/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import svgr from "file:///D:/frontend-admin-dashboard/node_modules/.pnpm/vite-plugin-svgr@4.3.0_roll_3d098ad36f696053a607e33500c0790f/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "D:\\frontend-admin-dashboard";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    TanStackRouterVite(),
    svgr({ include: "**/*.svg" })
    // Temporarily disabled PWA plugin due to build error
    // VitePWA({
    //     registerType: 'autoUpdate',
    //     devOptions: {
    //         enabled: false,
    //     },
    //     includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    //     manifest: {
    //         name: 'Admin Dashboard',
    //         short_name: 'Admin',
    //         description: 'Admin Dashboard Application',
    //         theme_color: '#ffffff',
    //         icons: [
    //             {
    //                 src: 'pwa-192x192.png',
    //                 sizes: '192x192',
    //                 type: 'image/png',
    //             },
    //             {
    //                 src: 'pwa-512x512.png',
    //                 sizes: '512x512',
    //                 type: 'image/png',
    //             },
    //         ],
    //     },
    //     workbox: {
    //         maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB
    //         globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
    //         runtimeCaching: [
    //             {
    //                 urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    //                 handler: 'CacheFirst',
    //                 options: {
    //                     cacheName: 'google-fonts-cache',
    //                     expiration: {
    //                         maxEntries: 10,
    //                         maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
    //                     },
    //                     cacheableResponse: {
    //                         statuses: [0, 200],
    //                     },
    //                 },
    //             },
    //         ],
    //     },
    // }),
  ],
  // plugins: [react(), tsconfigPaths(), svgr({ include: "**/*.svg" })],
  build: {
    rollupOptions: {
      external: (id) => {
        if (id.includes("woff2-wasm")) return true;
        if (id.includes("pyodide")) return false;
        return false;
      },
      onLog(level, log, handler) {
        if (log.code === "CIRCULAR_DEPENDENCY" && log.message?.includes("pako")) return;
        handler(level, log);
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/react/") || id.includes("/react-dom/"))
              return "react-vendor";
            if (id.includes("/react-router-dom/") || id.includes("/@tanstack/react-router/") || id.includes("/zustand/"))
              return "routing-vendor";
            if (id.includes("/jspdf/") || id.includes("/html2canvas/") || id.includes("/pdf-lib/") || id.includes("/pdfjs-dist/"))
              return "pdf-tools-vendor";
            if (id.includes("/@radix-ui/react-") || id.includes("/lucide-react/"))
              return "ui-vendor";
            if (id.includes("/lodash/") || id.includes("/date-fns/") || id.includes("/axios/") || id.includes("/clsx/") || id.includes("/class-variance-authority/"))
              return "utils-vendor";
            if (id.includes("/pyodide/")) return "pyodide-vendor";
            if (id.includes("/papaparse/")) return "csv-vendor";
            if (id.includes("/framer-motion/")) return "motion-vendor";
            if (id.includes("/phosphor-react/")) return "icons-vendor";
            if (id.includes("/@excalidraw/excalidraw/")) return "excalidraw-vendor";
          }
        }
      },
      onwarn: (warning, warn) => {
        if (warning.code === "CIRCULAR_DEPENDENCY") return;
        if (warning.code === "INVALID_ANNOTATION") return;
        warn(warning);
      }
    },
    target: "esnext",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    chunkSizeWarningLimit: 1e3,
    assetsInlineLimit: 0
    // Disable asset inlining to prevent issues
    // Worker-specific options are configured at the top-level `worker` field if needed
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  assetsInclude: ["**/*.wasm"],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ".vitest/setup",
    include: ["**/test.{ts,tsx}"]
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
      "Content-Security-Policy": "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: wasm:; worker-src * blob:; frame-src *; frame-ancestors 'self' https://www.youtube.com https://youtube.com https://*.youtube.com;"
    },
    proxy: {
      "/youtube": {
        target: "https://www.youtube.com",
        changeOrigin: true,
        rewrite: (path2) => path2.replace(/^\/youtube/, ""),
        secure: false,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    },
    cors: true,
    hmr: {
      protocol: "ws",
      host: "localhost"
    }
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util", "pyodide"],
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "axios",
      "lodash",
      "date-fns",
      "pako",
      "@tanstack/react-router",
      "@tanstack/router-devtools"
    ],
    esbuildOptions: {
      target: "esnext",
      supported: {
        bigint: true
      }
    },
    force: true
    // Force re-optimization to fix dependency issues
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxmcm9udGVuZC1hZG1pbi1kYXNoYm9hcmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXGZyb250ZW5kLWFkbWluLWRhc2hib2FyZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovZnJvbnRlbmQtYWRtaW4tZGFzaGJvYXJkL3ZpdGUuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3RcIiAvPlxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0LXN3Yyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSAndml0ZS10c2NvbmZpZy1wYXRocyc7XG5pbXBvcnQgeyBUYW5TdGFja1JvdXRlclZpdGUgfSBmcm9tICdAdGFuc3RhY2svcm91dGVyLXBsdWdpbi92aXRlJztcbmltcG9ydCBzdmdyIGZyb20gJ3ZpdGUtcGx1Z2luLXN2Z3InO1xuLy8gaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcgaHR0cHM6Ly92aXRlc3QuZGV2L2NvbmZpZ1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICAgIHJlYWN0KCksXG4gICAgICAgIHRzY29uZmlnUGF0aHMoKSxcbiAgICAgICAgVGFuU3RhY2tSb3V0ZXJWaXRlKCksXG4gICAgICAgIHN2Z3IoeyBpbmNsdWRlOiAnKiovKi5zdmcnIH0pLFxuICAgICAgICAvLyBUZW1wb3JhcmlseSBkaXNhYmxlZCBQV0EgcGx1Z2luIGR1ZSB0byBidWlsZCBlcnJvclxuICAgICAgICAvLyBWaXRlUFdBKHtcbiAgICAgICAgLy8gICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgICAvLyAgICAgZGV2T3B0aW9uczoge1xuICAgICAgICAvLyAgICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICAvLyAgICAgfSxcbiAgICAgICAgLy8gICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnbWFza2VkLWljb24uc3ZnJ10sXG4gICAgICAgIC8vICAgICBtYW5pZmVzdDoge1xuICAgICAgICAvLyAgICAgICAgIG5hbWU6ICdBZG1pbiBEYXNoYm9hcmQnLFxuICAgICAgICAvLyAgICAgICAgIHNob3J0X25hbWU6ICdBZG1pbicsXG4gICAgICAgIC8vICAgICAgICAgZGVzY3JpcHRpb246ICdBZG1pbiBEYXNoYm9hcmQgQXBwbGljYXRpb24nLFxuICAgICAgICAvLyAgICAgICAgIHRoZW1lX2NvbG9yOiAnI2ZmZmZmZicsXG4gICAgICAgIC8vICAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgLy8gICAgICAgICAgICAge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgLy8gICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICAgICAge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgc3JjOiAncHdhLTUxMng1MTIucG5nJyxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgLy8gICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICBdLFxuICAgICAgICAvLyAgICAgfSxcbiAgICAgICAgLy8gICAgIHdvcmtib3g6IHtcbiAgICAgICAgLy8gICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogMzAgKiAxMDI0ICogMTAyNCwgLy8gMzBNQlxuICAgICAgICAvLyAgICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmMix3b2ZmfSddLFxuICAgICAgICAvLyAgICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgIC8vICAgICAgICAgICAgIHtcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMtY2FjaGUnLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAsXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSwgLy8gPD09IDM2NSBkYXlzXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF0sXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIH0sXG4gICAgICAgIC8vICAgICAgICAgICAgIH0sXG4gICAgICAgIC8vICAgICAgICAgXSxcbiAgICAgICAgLy8gICAgIH0sXG4gICAgICAgIC8vIH0pLFxuICAgIF0sXG4gICAgLy8gcGx1Z2luczogW3JlYWN0KCksIHRzY29uZmlnUGF0aHMoKSwgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KV0sXG5cbiAgICBidWlsZDoge1xuICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICBleHRlcm5hbDogKGlkKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIHByb2JsZW1hdGljIGRlcGVuZGVuY2llc1xuICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnd29mZjItd2FzbScpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCBleHRlcm5hbGl6ZSBweW9kaWRlIC0gaXQgbmVlZHMgdG8gYmUgYnVuZGxlZFxuICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncHlvZGlkZScpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uTG9nKGxldmVsLCBsb2csIGhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBTdXBwcmVzcyBjaXJjdWxhciBkZXBlbmRlbmN5IHdhcm5pbmdzIGZvciBrbm93biBzYWZlIGNhc2VzXG4gICAgICAgICAgICAgICAgaWYgKGxvZy5jb2RlID09PSAnQ0lSQ1VMQVJfREVQRU5ERU5DWScgJiYgbG9nLm1lc3NhZ2U/LmluY2x1ZGVzKCdwYWtvJykpIHJldHVybjtcbiAgICAgICAgICAgICAgICBoYW5kbGVyKGxldmVsLCBsb2cpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG91dHB1dDoge1xuICAgICAgICAgICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9yZWFjdC8nKSB8fCBpZC5pbmNsdWRlcygnL3JlYWN0LWRvbS8nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3JlYWN0LXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9yZWFjdC1yb3V0ZXItZG9tLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9AdGFuc3RhY2svcmVhY3Qtcm91dGVyLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy96dXN0YW5kLycpXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdyb3V0aW5nLXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9qc3BkZi8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvaHRtbDJjYW52YXMvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3BkZi1saWIvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3BkZmpzLWRpc3QvJylcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3BkZi10b29scy12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQHJhZGl4LXVpL3JlYWN0LScpIHx8IGlkLmluY2x1ZGVzKCcvbHVjaWRlLXJlYWN0LycpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAndWktdmVuZG9yJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL2xvZGFzaC8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvZGF0ZS1mbnMvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL2F4aW9zLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9jbHN4LycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9jbGFzcy12YXJpYW5jZS1hdXRob3JpdHkvJylcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3V0aWxzLXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9weW9kaWRlLycpKSByZXR1cm4gJ3B5b2RpZGUtdmVuZG9yJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3BhcGFwYXJzZS8nKSkgcmV0dXJuICdjc3YtdmVuZG9yJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2ZyYW1lci1tb3Rpb24vJykpIHJldHVybiAnbW90aW9uLXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9waG9zcGhvci1yZWFjdC8nKSkgcmV0dXJuICdpY29ucy12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQGV4Y2FsaWRyYXcvZXhjYWxpZHJhdy8nKSkgcmV0dXJuICdleGNhbGlkcmF3LXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9ud2FybjogKHdhcm5pbmcsIHdhcm4pID0+IHtcbiAgICAgICAgICAgICAgICAvLyBTdXBwcmVzcyBzcGVjaWZpYyB3YXJuaW5ncyB0aGF0IG1pZ2h0IGNhdXNlIGlzc3Vlc1xuICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdDSVJDVUxBUl9ERVBFTkRFTkNZJykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdJTlZBTElEX0FOTk9UQVRJT04nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gICAgICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgICAgIHRlcnNlck9wdGlvbnM6IHtcbiAgICAgICAgICAgIGNvbXByZXNzOiB7XG4gICAgICAgICAgICAgICAgZHJvcF9jb25zb2xlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgICAgIGFzc2V0c0lubGluZUxpbWl0OiAwLCAvLyBEaXNhYmxlIGFzc2V0IGlubGluaW5nIHRvIHByZXZlbnQgaXNzdWVzXG4gICAgICAgIC8vIFdvcmtlci1zcGVjaWZpYyBvcHRpb25zIGFyZSBjb25maWd1cmVkIGF0IHRoZSB0b3AtbGV2ZWwgYHdvcmtlcmAgZmllbGQgaWYgbmVlZGVkXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICAgIGFsaWFzOiB7XG4gICAgICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgYXNzZXRzSW5jbHVkZTogWycqKi8qLndhc20nXSxcbiAgICB0ZXN0OiB7XG4gICAgICAgIGdsb2JhbHM6IHRydWUsXG4gICAgICAgIGVudmlyb25tZW50OiAnaGFwcHktZG9tJyxcbiAgICAgICAgc2V0dXBGaWxlczogJy52aXRlc3Qvc2V0dXAnLFxuICAgICAgICBpbmNsdWRlOiBbJyoqL3Rlc3Que3RzLHRzeH0nXSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnQ3Jvc3MtT3JpZ2luLUVtYmVkZGVyLVBvbGljeSc6ICdjcmVkZW50aWFsbGVzcycsXG4gICAgICAgICAgICAnQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3knOiAnc2FtZS1vcmlnaW4nLFxuICAgICAgICAgICAgJ0Nyb3NzLU9yaWdpbi1SZXNvdXJjZS1Qb2xpY3knOiAnY3Jvc3Mtb3JpZ2luJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdHRVQsIFBPU1QsIFBVVCwgREVMRVRFLCBQQVRDSCwgT1BUSU9OUycsXG4gICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdYLVJlcXVlc3RlZC1XaXRoLCBjb250ZW50LXR5cGUsIEF1dGhvcml6YXRpb24nLFxuICAgICAgICAgICAgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzpcbiAgICAgICAgICAgICAgICBcImRlZmF1bHQtc3JjICogJ3Vuc2FmZS1pbmxpbmUnICd1bnNhZmUtZXZhbCcgZGF0YTogYmxvYjogd2FzbTo7IHdvcmtlci1zcmMgKiBibG9iOjsgZnJhbWUtc3JjICo7IGZyYW1lLWFuY2VzdG9ycyAnc2VsZicgaHR0cHM6Ly93d3cueW91dHViZS5jb20gaHR0cHM6Ly95b3V0dWJlLmNvbSBodHRwczovLyoueW91dHViZS5jb207XCIsXG4gICAgICAgIH0sXG4gICAgICAgIHByb3h5OiB7XG4gICAgICAgICAgICAnL3lvdXR1YmUnOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly93d3cueW91dHViZS5jb20nLFxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwveW91dHViZS8sICcnKSxcbiAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgY29yczogdHJ1ZSxcbiAgICAgICAgaG1yOiB7XG4gICAgICAgICAgICBwcm90b2NvbDogJ3dzJyxcbiAgICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICAgIGV4Y2x1ZGU6IFsnQGZmbXBlZy9mZm1wZWcnLCAnQGZmbXBlZy91dGlsJywgJ3B5b2RpZGUnXSxcbiAgICAgICAgaW5jbHVkZTogW1xuICAgICAgICAgICAgJ3JlYWN0JyxcbiAgICAgICAgICAgICdyZWFjdC1kb20nLFxuICAgICAgICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxuICAgICAgICAgICAgJ2F4aW9zJyxcbiAgICAgICAgICAgICdsb2Rhc2gnLFxuICAgICAgICAgICAgJ2RhdGUtZm5zJyxcbiAgICAgICAgICAgICdwYWtvJyxcbiAgICAgICAgICAgICdAdGFuc3RhY2svcmVhY3Qtcm91dGVyJyxcbiAgICAgICAgICAgICdAdGFuc3RhY2svcm91dGVyLWRldnRvb2xzJ1xuICAgICAgICBdLFxuICAgICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICAgICAgICAgIHN1cHBvcnRlZDoge1xuICAgICAgICAgICAgICAgIGJpZ2ludDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGZvcmNlOiB0cnVlLCAvLyBGb3JjZSByZS1vcHRpbWl6YXRpb24gdG8gZml4IGRlcGVuZGVuY3kgaXNzdWVzXG4gICAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxtQkFBbUI7QUFDMUIsU0FBUywwQkFBMEI7QUFDbkMsT0FBTyxVQUFVO0FBTmpCLElBQU0sbUNBQW1DO0FBVXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVM7QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLG1CQUFtQjtBQUFBLElBQ25CLEtBQUssRUFBRSxTQUFTLFdBQVcsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUErQ2hDO0FBQUE7QUFBQSxFQUdBLE9BQU87QUFBQSxJQUNILGVBQWU7QUFBQSxNQUNYLFVBQVUsQ0FBQyxPQUFPO0FBRWQsWUFBSSxHQUFHLFNBQVMsWUFBWSxFQUFHLFFBQU87QUFFdEMsWUFBSSxHQUFHLFNBQVMsU0FBUyxFQUFHLFFBQU87QUFDbkMsZUFBTztBQUFBLE1BQ1g7QUFBQSxNQUNBLE1BQU0sT0FBTyxLQUFLLFNBQVM7QUFFdkIsWUFBSSxJQUFJLFNBQVMseUJBQXlCLElBQUksU0FBUyxTQUFTLE1BQU0sRUFBRztBQUN6RSxnQkFBUSxPQUFPLEdBQUc7QUFBQSxNQUN0QjtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ0osYUFBYSxJQUFJO0FBQ2IsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQzdCLGdCQUFJLEdBQUcsU0FBUyxTQUFTLEtBQUssR0FBRyxTQUFTLGFBQWE7QUFDbkQscUJBQU87QUFDWCxnQkFDSSxHQUFHLFNBQVMsb0JBQW9CLEtBQ2hDLEdBQUcsU0FBUywwQkFBMEIsS0FDdEMsR0FBRyxTQUFTLFdBQVc7QUFFdkIscUJBQU87QUFDWCxnQkFDSSxHQUFHLFNBQVMsU0FBUyxLQUNyQixHQUFHLFNBQVMsZUFBZSxLQUMzQixHQUFHLFNBQVMsV0FBVyxLQUN2QixHQUFHLFNBQVMsY0FBYztBQUUxQixxQkFBTztBQUNYLGdCQUFJLEdBQUcsU0FBUyxtQkFBbUIsS0FBSyxHQUFHLFNBQVMsZ0JBQWdCO0FBQ2hFLHFCQUFPO0FBQ1gsZ0JBQ0ksR0FBRyxTQUFTLFVBQVUsS0FDdEIsR0FBRyxTQUFTLFlBQVksS0FDeEIsR0FBRyxTQUFTLFNBQVMsS0FDckIsR0FBRyxTQUFTLFFBQVEsS0FDcEIsR0FBRyxTQUFTLDRCQUE0QjtBQUV4QyxxQkFBTztBQUNYLGdCQUFJLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUNyQyxnQkFBSSxHQUFHLFNBQVMsYUFBYSxFQUFHLFFBQU87QUFDdkMsZ0JBQUksR0FBRyxTQUFTLGlCQUFpQixFQUFHLFFBQU87QUFDM0MsZ0JBQUksR0FBRyxTQUFTLGtCQUFrQixFQUFHLFFBQU87QUFDNUMsZ0JBQUksR0FBRyxTQUFTLDBCQUEwQixFQUFHLFFBQU87QUFBQSxVQUN4RDtBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQUEsTUFDQSxRQUFRLENBQUMsU0FBUyxTQUFTO0FBRXZCLFlBQUksUUFBUSxTQUFTLHNCQUF1QjtBQUM1QyxZQUFJLFFBQVEsU0FBUyxxQkFBc0I7QUFDM0MsYUFBSyxPQUFPO0FBQUEsTUFDaEI7QUFBQSxJQUNKO0FBQUEsSUFDQSxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDWCxVQUFVO0FBQUEsUUFDTixjQUFjO0FBQUEsUUFDZCxlQUFlO0FBQUEsTUFDbkI7QUFBQSxJQUNKO0FBQUEsSUFDQSx1QkFBdUI7QUFBQSxJQUN2QixtQkFBbUI7QUFBQTtBQUFBO0FBQUEsRUFFdkI7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUNBLGVBQWUsQ0FBQyxXQUFXO0FBQUEsRUFDM0IsTUFBTTtBQUFBLElBQ0YsU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLElBQ1osU0FBUyxDQUFDLGtCQUFrQjtBQUFBLEVBQ2hDO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDSixTQUFTO0FBQUEsTUFDTCxnQ0FBZ0M7QUFBQSxNQUNoQyw4QkFBOEI7QUFBQSxNQUM5QixnQ0FBZ0M7QUFBQSxNQUNoQywrQkFBK0I7QUFBQSxNQUMvQixnQ0FBZ0M7QUFBQSxNQUNoQyxnQ0FBZ0M7QUFBQSxNQUNoQywyQkFDSTtBQUFBLElBQ1I7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNILFlBQVk7QUFBQSxRQUNSLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFNBQVMsQ0FBQ0EsVUFBU0EsTUFBSyxRQUFRLGNBQWMsRUFBRTtBQUFBLFFBQ2hELFFBQVE7QUFBQSxRQUNSLFNBQVM7QUFBQSxVQUNMLCtCQUErQjtBQUFBLFFBQ25DO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNELFVBQVU7QUFBQSxNQUNWLE1BQU07QUFBQSxJQUNWO0FBQUEsRUFDSjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1YsU0FBUyxDQUFDLGtCQUFrQixnQkFBZ0IsU0FBUztBQUFBLElBQ3JELFNBQVM7QUFBQSxNQUNMO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNKO0FBQUEsSUFDQSxnQkFBZ0I7QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxRQUNQLFFBQVE7QUFBQSxNQUNaO0FBQUEsSUFDSjtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUEsRUFDWDtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbInBhdGgiXQp9Cg==
