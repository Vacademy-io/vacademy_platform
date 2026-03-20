// vite.config.ts
import react from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/@vitejs+plugin-react-swc@3.10.2_@swc+helpers@0.5.17_vite@5.4.19_@types+node@22.16.4_sass@1.51.0_terser@5.43.1_/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { defineConfig } from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/vite@5.4.19_@types+node@22.16.4_sass@1.51.0_terser@5.43.1/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_typescript@5.0.4_vite@5.4.19_@types+node@22.16.4_sass@1.51.0_terser@5.43.1_/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { TanStackRouterVite } from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/@tanstack+router-plugin@1.127.8_@tanstack+react-router@1.127.8_react-dom@18.3.1_react@1_1ced4891676ab2d592bd222515687e6f/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import svgr from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/vite-plugin-svgr@4.3.0_rollup@4.21.2_typescript@5.0.4_vite@5.4.19_@types+node@22.16.4_sass@1.51.0_terser@5.43.1_/node_modules/vite-plugin-svgr/dist/index.js";
import flowbiteReact from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/flowbite-react@0.12.10_react-dom@18.3.1_react@18.3.1__react@18.3.1_tailwindcss@3.4.17_typescript@5.0.4/node_modules/flowbite-react/dist/plugin/vite.js";
import { visualizer } from "file:///Users/shreyashjain/code_repos/frontend-admin-dashboard/node_modules/.pnpm/rollup-plugin-visualizer@6.0.5_rollup@4.21.2/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "/Users/shreyashjain/code_repos/frontend-admin-dashboard";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    TanStackRouterVite(),
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
    svgr({ include: "**/*.svg" }),
    flowbiteReact(),
    // Bundle analyzer - generates stats.html after build
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: "treemap"
      // 'sunburst', 'network', 'treemap'
    })
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
            if (id.includes("/jspdf/") || id.includes("/html2canvas/") || id.includes("/pdf-lib/") || id.includes("/pdfjs-dist/") || id.includes("/@react-pdf-viewer/") || id.includes("/react-pdf/") || id.includes("/@react-pdf/") || id.includes("/pdfkit/") || id.includes("/@pdfme/"))
              return "pdf-tools-vendor";
            if (id.includes("/@radix-ui/react-"))
              return "ui-vendor";
            if (id.includes("/lodash/") || id.includes("/date-fns/") || id.includes("/axios/") || id.includes("/clsx/") || id.includes("/class-variance-authority/"))
              return "utils-vendor";
            if (id.includes("/@excalidraw/") || id.includes("/roughjs/") || id.includes("/perfect-freehand/"))
              return "excalidraw-vendor";
            if (id.includes("/grapesjs/"))
              return "grapes-vendor";
            if (id.includes("/mermaid/") || id.includes("/elkjs/") || id.includes("/dagre/") || id.includes("/reactflow/") || id.includes("/@reactflow/"))
              return "diagram-vendor";
            if (id.includes("/quill/") || id.includes("/react-quill/") || id.includes("/jquery/") || id.includes("/mathquill/") || id.includes("/mathquill4quill/"))
              return "quill-vendor";
            if (id.includes("/@tiptap/"))
              return "tiptap-vendor";
            if (id.includes("/@yoopta/"))
              return "yoopta-vendor";
            if (id.includes("/@monaco-editor/") || id.includes("/monaco-editor/"))
              return "monaco-vendor";
            if (id.includes("/recharts/") || id.includes("/d3/") || id.includes("/victory/"))
              return "chart-vendor";
            if (id.includes("/fabric/"))
              return "fabric-vendor";
            if (id.includes("/reveal.js/") || id.includes("/pptxgenjs/"))
              return "presentation-vendor";
            if (id.includes("/firebase/") || id.includes("/@firebase/"))
              return "firebase-vendor";
            if (id.includes("/katex/"))
              return "katex-vendor";
            if (id.includes("/phosphor-react/") || id.includes("/@phosphor-icons/") || id.includes("/lucide-react/") || id.includes("/react-icons/"))
              return "icons-vendor";
            if (id.includes("/@tanstack/react-query"))
              return "query-vendor";
            if (id.includes("/flowbite/") || id.includes("/flowbite-react/"))
              return "flowbite-vendor";
            if (id.includes("/framer-motion/"))
              return "motion-vendor";
            if (id.includes("/pyodide/")) return "pyodide-vendor";
            if (id.includes("/papaparse/")) return "csv-vendor";
            if (id.includes("/mammoth/")) return "docx-vendor";
            if (id.includes("/socket.io/")) return "socket-vendor";
            if (id.includes("/intro.js/")) return "intro-vendor";
            if (id.includes("/prismjs/")) return "prism-vendor";
            if (id.includes("/@dnd-kit/")) return "dnd-vendor";
            if (id.includes("/reactflow/")) return "flow-vendor";
            if (id.includes("/@sentry/")) return "sentry-vendor";
            if (id.includes("/i18next/") || id.includes("/react-i18next/")) return "i18n-vendor";
            if (id.includes("/@amplitude/")) return "amplitude-vendor";
          }
        }
      },
      onwarn: (warning, warn) => {
        if (warning.code === "CIRCULAR_DEPENDENCY") return;
        if (warning.code === "INVALID_ANNOTATION") return;
        warn(warning);
      },
      maxParallelFileOps: 2
      // Reduce parallel operations to save memory
    },
    target: "esnext",
    minify: "esbuild",
    // Use esbuild instead of terser for faster, less memory-intensive builds
    chunkSizeWarningLimit: 1e3,
    assetsInlineLimit: 0,
    // Disable asset inlining to prevent issues
    sourcemap: false,
    // Disable sourcemaps in production to save memory
    reportCompressedSize: false
    // Skip compressed size reporting to save memory
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvc2hyZXlhc2hqYWluL2NvZGVfcmVwb3MvZnJvbnRlbmQtYWRtaW4tZGFzaGJvYXJkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvc2hyZXlhc2hqYWluL2NvZGVfcmVwb3MvZnJvbnRlbmQtYWRtaW4tZGFzaGJvYXJkL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9zaHJleWFzaGphaW4vY29kZV9yZXBvcy9mcm9udGVuZC1hZG1pbi1kYXNoYm9hcmQvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcbmltcG9ydCB7IFRhblN0YWNrUm91dGVyVml0ZSB9IGZyb20gJ0B0YW5zdGFjay9yb3V0ZXItcGx1Z2luL3ZpdGUnO1xuaW1wb3J0IHN2Z3IgZnJvbSAndml0ZS1wbHVnaW4tc3Zncic7XG4vLyBpbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcbmltcG9ydCBmbG93Yml0ZVJlYWN0IGZyb20gXCJmbG93Yml0ZS1yZWFjdC9wbHVnaW4vdml0ZVwiO1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gJ3JvbGx1cC1wbHVnaW4tdmlzdWFsaXplcic7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcgaHR0cHM6Ly92aXRlc3QuZGV2L2NvbmZpZ1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICAgIHJlYWN0KCksXG4gICAgICAgIHRzY29uZmlnUGF0aHMoKSxcbiAgICAgICAgVGFuU3RhY2tSb3V0ZXJWaXRlKCksXG4gICAgICAgIC8vIFRlbXBvcmFyaWx5IGRpc2FibGVkIFBXQSBwbHVnaW4gZHVlIHRvIGJ1aWxkIGVycm9yXG4gICAgICAgIC8vIFZpdGVQV0Eoe1xuICAgICAgICAvLyAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICAgIC8vICAgICBkZXZPcHRpb25zOiB7XG4gICAgICAgIC8vICAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIC8vICAgICB9LFxuICAgICAgICAvLyAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdhcHBsZS10b3VjaC1pY29uLnBuZycsICdtYXNrZWQtaWNvbi5zdmcnXSxcbiAgICAgICAgLy8gICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIC8vICAgICAgICAgbmFtZTogJ0FkbWluIERhc2hib2FyZCcsXG4gICAgICAgIC8vICAgICAgICAgc2hvcnRfbmFtZTogJ0FkbWluJyxcbiAgICAgICAgLy8gICAgICAgICBkZXNjcmlwdGlvbjogJ0FkbWluIERhc2hib2FyZCBBcHBsaWNhdGlvbicsXG4gICAgICAgIC8vICAgICAgICAgdGhlbWVfY29sb3I6ICcjZmZmZmZmJyxcbiAgICAgICAgLy8gICAgICAgICBpY29uczogW1xuICAgICAgICAvLyAgICAgICAgICAgICB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICBzcmM6ICdwd2EtMTkyeDE5Mi5wbmcnLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAvLyAgICAgICAgICAgICB9LFxuICAgICAgICAvLyAgICAgICAgICAgICB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAvLyAgICAgICAgICAgICB9LFxuICAgICAgICAvLyAgICAgICAgIF0sXG4gICAgICAgIC8vICAgICB9LFxuICAgICAgICAvLyAgICAgd29ya2JveDoge1xuICAgICAgICAvLyAgICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAzMCAqIDEwMjQgKiAxMDI0LCAvLyAzME1CXG4gICAgICAgIC8vICAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyLHdvZmZ9J10sXG4gICAgICAgIC8vICAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgLy8gICAgICAgICAgICAge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb21cXC8uKi9pLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2dvb2dsZS1mb250cy1jYWNoZScsXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMCxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1LCAvLyA8PT0gMzY1IGRheXNcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICAgICAgfSxcbiAgICAgICAgLy8gICAgICAgICBdLFxuICAgICAgICAvLyAgICAgfSxcbiAgICAgICAgLy8gfSksXG4gICAgICAgIHN2Z3IoeyBpbmNsdWRlOiAnKiovKi5zdmcnIH0pLFxuICAgICAgICBmbG93Yml0ZVJlYWN0KCksXG4gICAgICAgIC8vIEJ1bmRsZSBhbmFseXplciAtIGdlbmVyYXRlcyBzdGF0cy5odG1sIGFmdGVyIGJ1aWxkXG4gICAgICAgIHZpc3VhbGl6ZXIoe1xuICAgICAgICAgICAgZmlsZW5hbWU6ICdkaXN0L3N0YXRzLmh0bWwnLFxuICAgICAgICAgICAgb3BlbjogZmFsc2UsXG4gICAgICAgICAgICBnemlwU2l6ZTogdHJ1ZSxcbiAgICAgICAgICAgIGJyb3RsaVNpemU6IHRydWUsXG4gICAgICAgICAgICB0ZW1wbGF0ZTogJ3RyZWVtYXAnLCAvLyAnc3VuYnVyc3QnLCAnbmV0d29yaycsICd0cmVlbWFwJ1xuICAgICAgICB9KSxcbiAgICBdLFxuICAgIC8vIHBsdWdpbnM6IFtyZWFjdCgpLCB0c2NvbmZpZ1BhdGhzKCksIHN2Z3IoeyBpbmNsdWRlOiBcIioqLyouc3ZnXCIgfSldLFxuXG4gICAgYnVpbGQ6IHtcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgICAgZXh0ZXJuYWw6IChpZCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBwcm9ibGVtYXRpYyBkZXBlbmRlbmNpZXNcbiAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3dvZmYyLXdhc20nKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgZXh0ZXJuYWxpemUgcHlvZGlkZSAtIGl0IG5lZWRzIHRvIGJlIGJ1bmRsZWRcbiAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3B5b2RpZGUnKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbkxvZyhsZXZlbCwgbG9nLCBoYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgLy8gU3VwcHJlc3MgY2lyY3VsYXIgZGVwZW5kZW5jeSB3YXJuaW5ncyBmb3Iga25vd24gc2FmZSBjYXNlc1xuICAgICAgICAgICAgICAgIGlmIChsb2cuY29kZSA9PT0gJ0NJUkNVTEFSX0RFUEVOREVOQ1knICYmIGxvZy5tZXNzYWdlPy5pbmNsdWRlcygncGFrbycpKSByZXR1cm47XG4gICAgICAgICAgICAgICAgaGFuZGxlcihsZXZlbCwgbG9nKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ29yZSBSZWFjdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcmVhY3QvJykgfHwgaWQuaW5jbHVkZXMoJy9yZWFjdC1kb20vJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdyZWFjdC12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSb3V0aW5nICYgU3RhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3JlYWN0LXJvdXRlci1kb20vJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL0B0YW5zdGFjay9yZWFjdC1yb3V0ZXIvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3p1c3RhbmQvJylcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3JvdXRpbmctdmVuZG9yJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUERGIFRvb2xzIChoZWF2eSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL2pzcGRmLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9odG1sMmNhbnZhcy8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcGRmLWxpYi8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcGRmanMtZGlzdC8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvQHJlYWN0LXBkZi12aWV3ZXIvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3JlYWN0LXBkZi8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvQHJlYWN0LXBkZi8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcGRma2l0LycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9AcGRmbWUvJylcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3BkZi10b29scy12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVSSBDb21wb25lbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9AcmFkaXgtdWkvcmVhY3QtJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICd1aS12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVdGlsaXR5IExpYnJhcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvbG9kYXNoLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9kYXRlLWZucy8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvYXhpb3MvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL2Nsc3gvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL2NsYXNzLXZhcmlhbmNlLWF1dGhvcml0eS8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAndXRpbHMtdmVuZG9yJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGVhdnkgTGlicmFyaWVzIC0gRXhjYWxpZHJhdyAod2hpdGVib2FyZC9zbGlkZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9AZXhjYWxpZHJhdy8nKSB8fCBpZC5pbmNsdWRlcygnL3JvdWdoanMvJykgfHwgaWQuaW5jbHVkZXMoJy9wZXJmZWN0LWZyZWVoYW5kLycpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnZXhjYWxpZHJhdy12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBIZWF2eSBMaWJyYXJpZXMgLSBHcmFwZXNKUyAoZW1haWwgZWRpdG9yKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvZ3JhcGVzanMvJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdncmFwZXMtdmVuZG9yJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGVhdnkgTGlicmFyaWVzIC0gTWVybWFpZC9FTEsvUmVhY3RGbG93IChkaWFncmFtcylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL21lcm1haWQvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL2Vsa2pzLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9kYWdyZS8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcmVhY3RmbG93LycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9AcmVhY3RmbG93LycpXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdkaWFncmFtLXZlbmRvcic7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlYXZ5IExpYnJhcmllcyAtIFJpY2ggVGV4dCBFZGl0b3JzIChqUXVlcnkgKyBNYXRoUXVpbGwgbXVzdCBsb2FkIHRvZ2V0aGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcXVpbGwvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3JlYWN0LXF1aWxsLycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9qcXVlcnkvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL21hdGhxdWlsbC8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvbWF0aHF1aWxsNHF1aWxsLycpXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdxdWlsbC12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQHRpcHRhcC8nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3RpcHRhcC12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQHlvb3B0YS8nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3lvb3B0YS12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBIZWF2eSBMaWJyYXJpZXMgLSBNb25hY28gRWRpdG9yIChjb2RlKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQG1vbmFjby1lZGl0b3IvJykgfHwgaWQuaW5jbHVkZXMoJy9tb25hY28tZWRpdG9yLycpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnbW9uYWNvLXZlbmRvcic7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlYXZ5IExpYnJhcmllcyAtIENoYXJ0c1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcmVjaGFydHMvJykgfHwgaWQuaW5jbHVkZXMoJy9kMy8nKSB8fCBpZC5pbmNsdWRlcygnL3ZpY3RvcnkvJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdjaGFydC12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBIZWF2eSBMaWJyYXJpZXMgLSBDYW52YXMvRmFicmljXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9mYWJyaWMvJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdmYWJyaWMtdmVuZG9yJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGVhdnkgTGlicmFyaWVzIC0gUHJlc2VudGF0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcmV2ZWFsLmpzLycpIHx8IGlkLmluY2x1ZGVzKCcvcHB0eGdlbmpzLycpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAncHJlc2VudGF0aW9uLXZlbmRvcic7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlYXZ5IExpYnJhcmllcyAtIEZpcmViYXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9maXJlYmFzZS8nKSB8fCBpZC5pbmNsdWRlcygnL0BmaXJlYmFzZS8nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2ZpcmViYXNlLXZlbmRvcic7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlYXZ5IExpYnJhcmllcyAtIE1hdGggcmVuZGVyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9rYXRleC8nKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2thdGV4LXZlbmRvcic7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbnNvbGlkYXRlZCBJY29ucyAoYWxsIGljb24gbGlicmFyaWVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcGhvc3Bob3ItcmVhY3QvJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL0BwaG9zcGhvci1pY29ucy8nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvbHVjaWRlLXJlYWN0LycpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9yZWFjdC1pY29ucy8nKVxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnaWNvbnMtdmVuZG9yJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGFuU3RhY2sgUXVlcnlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL0B0YW5zdGFjay9yZWFjdC1xdWVyeScpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAncXVlcnktdmVuZG9yJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmxvd2JpdGUgVUlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2Zsb3diaXRlLycpIHx8IGlkLmluY2x1ZGVzKCcvZmxvd2JpdGUtcmVhY3QvJykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdmbG93Yml0ZS12ZW5kb3InO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBBbmltYXRpb24gbGlicmFyaWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9mcmFtZXItbW90aW9uLycpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnbW90aW9uLXZlbmRvcic7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE90aGVyIGhlYXZ5IGRlcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3B5b2RpZGUvJykpIHJldHVybiAncHlvZGlkZS12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcGFwYXBhcnNlLycpKSByZXR1cm4gJ2Nzdi12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvbWFtbW90aC8nKSkgcmV0dXJuICdkb2N4LXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zb2NrZXQuaW8vJykpIHJldHVybiAnc29ja2V0LXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9pbnRyby5qcy8nKSkgcmV0dXJuICdpbnRyby12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcHJpc21qcy8nKSkgcmV0dXJuICdwcmlzbS12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQGRuZC1raXQvJykpIHJldHVybiAnZG5kLXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9yZWFjdGZsb3cvJykpIHJldHVybiAnZmxvdy12ZW5kb3InO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvQHNlbnRyeS8nKSkgcmV0dXJuICdzZW50cnktdmVuZG9yJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2kxOG5leHQvJykgfHwgaWQuaW5jbHVkZXMoJy9yZWFjdC1pMThuZXh0LycpKSByZXR1cm4gJ2kxOG4tdmVuZG9yJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL0BhbXBsaXR1ZGUvJykpIHJldHVybiAnYW1wbGl0dWRlLXZlbmRvcic7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9ud2FybjogKHdhcm5pbmcsIHdhcm4pID0+IHtcbiAgICAgICAgICAgICAgICAvLyBTdXBwcmVzcyBzcGVjaWZpYyB3YXJuaW5ncyB0aGF0IG1pZ2h0IGNhdXNlIGlzc3Vlc1xuICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdDSVJDVUxBUl9ERVBFTkRFTkNZJykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdJTlZBTElEX0FOTk9UQVRJT04nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhQYXJhbGxlbEZpbGVPcHM6IDIsIC8vIFJlZHVjZSBwYXJhbGxlbCBvcGVyYXRpb25zIHRvIHNhdmUgbWVtb3J5XG4gICAgICAgIH0sXG4gICAgICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gICAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLCAvLyBVc2UgZXNidWlsZCBpbnN0ZWFkIG9mIHRlcnNlciBmb3IgZmFzdGVyLCBsZXNzIG1lbW9yeS1pbnRlbnNpdmUgYnVpbGRzXG4gICAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcbiAgICAgICAgYXNzZXRzSW5saW5lTGltaXQ6IDAsIC8vIERpc2FibGUgYXNzZXQgaW5saW5pbmcgdG8gcHJldmVudCBpc3N1ZXNcbiAgICAgICAgc291cmNlbWFwOiBmYWxzZSwgLy8gRGlzYWJsZSBzb3VyY2VtYXBzIGluIHByb2R1Y3Rpb24gdG8gc2F2ZSBtZW1vcnlcbiAgICAgICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlLCAvLyBTa2lwIGNvbXByZXNzZWQgc2l6ZSByZXBvcnRpbmcgdG8gc2F2ZSBtZW1vcnlcbiAgICAgICAgLy8gV29ya2VyLXNwZWNpZmljIG9wdGlvbnMgYXJlIGNvbmZpZ3VyZWQgYXQgdGhlIHRvcC1sZXZlbCBgd29ya2VyYCBmaWVsZCBpZiBuZWVkZWRcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBhc3NldHNJbmNsdWRlOiBbJyoqLyoud2FzbSddLFxuICAgIHRlc3Q6IHtcbiAgICAgICAgZ2xvYmFsczogdHJ1ZSxcbiAgICAgICAgZW52aXJvbm1lbnQ6ICdoYXBweS1kb20nLFxuICAgICAgICBzZXR1cEZpbGVzOiAnLnZpdGVzdC9zZXR1cCcsXG4gICAgICAgIGluY2x1ZGU6IFsnKiovdGVzdC57dHMsdHN4fSddLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICdDcm9zcy1PcmlnaW4tRW1iZWRkZXItUG9saWN5JzogJ2NyZWRlbnRpYWxsZXNzJyxcbiAgICAgICAgICAgICdDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeSc6ICdzYW1lLW9yaWdpbicsXG4gICAgICAgICAgICAnQ3Jvc3MtT3JpZ2luLVJlc291cmNlLVBvbGljeSc6ICdjcm9zcy1vcmlnaW4nLFxuICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ0dFVCwgUE9TVCwgUFVULCBERUxFVEUsIFBBVENILCBPUFRJT05TJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ1gtUmVxdWVzdGVkLVdpdGgsIGNvbnRlbnQtdHlwZSwgQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgICAnQ29udGVudC1TZWN1cml0eS1Qb2xpY3knOlxuICAgICAgICAgICAgICAgIFwiZGVmYXVsdC1zcmMgKiAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBkYXRhOiBibG9iOiB3YXNtOjsgd29ya2VyLXNyYyAqIGJsb2I6OyBmcmFtZS1zcmMgKjsgZnJhbWUtYW5jZXN0b3JzICdzZWxmJyBodHRwczovL3d3dy55b3V0dWJlLmNvbSBodHRwczovL3lvdXR1YmUuY29tIGh0dHBzOi8vKi55b3V0dWJlLmNvbTtcIixcbiAgICAgICAgfSxcbiAgICAgICAgcHJveHk6IHtcbiAgICAgICAgICAgICcveW91dHViZSc6IHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwczovL3d3dy55b3V0dWJlLmNvbScsXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC95b3V0dWJlLywgJycpLFxuICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBjb3JzOiB0cnVlLFxuICAgICAgICBobXI6IHtcbiAgICAgICAgICAgIHByb3RvY29sOiAnd3MnLFxuICAgICAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgICAgZXhjbHVkZTogWydAZmZtcGVnL2ZmbXBlZycsICdAZmZtcGVnL3V0aWwnLCAncHlvZGlkZSddLFxuICAgICAgICBpbmNsdWRlOiBbXG4gICAgICAgICAgICAncmVhY3QnLFxuICAgICAgICAgICAgJ3JlYWN0LWRvbScsXG4gICAgICAgICAgICAncmVhY3Qtcm91dGVyLWRvbScsXG4gICAgICAgICAgICAnYXhpb3MnLFxuICAgICAgICAgICAgJ2xvZGFzaCcsXG4gICAgICAgICAgICAnZGF0ZS1mbnMnLFxuICAgICAgICAgICAgJ3Bha28nLFxuICAgICAgICAgICAgJ0B0YW5zdGFjay9yZWFjdC1yb3V0ZXInLFxuICAgICAgICAgICAgJ0B0YW5zdGFjay9yb3V0ZXItZGV2dG9vbHMnLFxuICAgICAgICBdLFxuICAgICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICAgICAgICAgIHN1cHBvcnRlZDoge1xuICAgICAgICAgICAgICAgIGJpZ2ludDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGZvcmNlOiB0cnVlLCAvLyBGb3JjZSByZS1vcHRpbWl6YXRpb24gdG8gZml4IGRlcGVuZGVuY3kgaXNzdWVzXG4gICAgfSxcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sbUJBQW1CO0FBQzFCLFNBQVMsMEJBQTBCO0FBQ25DLE9BQU8sVUFBVTtBQUVqQixPQUFPLG1CQUFtQjtBQUMxQixTQUFTLGtCQUFrQjtBQVQzQixJQUFNLG1DQUFtQztBQVl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsSUFDZCxtQkFBbUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBK0NuQixLQUFLLEVBQUUsU0FBUyxXQUFXLENBQUM7QUFBQSxJQUM1QixjQUFjO0FBQUE7QUFBQSxJQUVkLFdBQVc7QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLE1B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
