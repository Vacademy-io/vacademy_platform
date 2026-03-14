/// <reference types="vitest" />
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import svgr from 'vite-plugin-svgr';
// import { VitePWA } from 'vite-plugin-pwa';
import flowbiteReact from "flowbite-react/plugin/vite";
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig({
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
        svgr({ include: '**/*.svg' }),
        flowbiteReact(),
        // Bundle analyzer - generates stats.html after build
        visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap', // 'sunburst', 'network', 'treemap'
        }),
    ],
    // plugins: [react(), tsconfigPaths(), svgr({ include: "**/*.svg" })],

    build: {
        rollupOptions: {
            external: (id) => {
                // Handle problematic dependencies
                if (id.includes('woff2-wasm')) return true;
                if (id === '@excalidraw/excalidraw') return true;
                // Don't externalize pyodide - it needs to be bundled
                if (id.includes('pyodide')) return false;
                return false;
            },
            onLog(level, log, handler) {
                // Suppress circular dependency warnings for known safe cases
                if (log.code === 'CIRCULAR_DEPENDENCY' && log.message?.includes('pako')) return;
                handler(level, log);
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // Core React
                        if (id.includes('/react/') || id.includes('/react-dom/'))
                            return 'react-vendor';

                        // Routing & State
                        if (
                            id.includes('/react-router-dom/') ||
                            id.includes('/@tanstack/react-router/') ||
                            id.includes('/zustand/')
                        )
                            return 'routing-vendor';

                        // PDF Tools (heavy)
                        if (
                            id.includes('/jspdf/') ||
                            id.includes('/html2canvas/') ||
                            id.includes('/pdf-lib/') ||
                            id.includes('/pdfjs-dist/') ||
                            id.includes('/@react-pdf-viewer/') ||
                            id.includes('/react-pdf/') ||
                            id.includes('/@react-pdf/') ||
                            id.includes('/pdfkit/') ||
                            id.includes('/@pdfme/')
                        )
                            return 'pdf-tools-vendor';

                        // UI Components
                        if (id.includes('/@radix-ui/react-'))
                            return 'ui-vendor';

                        // Utility Libraries
                        if (
                            id.includes('/lodash/') ||
                            id.includes('/date-fns/') ||
                            id.includes('/axios/') ||
                            id.includes('/clsx/') ||
                            id.includes('/class-variance-authority/')
                        )
                            return 'utils-vendor';

                        // Heavy Libraries - Excalidraw (whiteboard/slides)
                        if (id.includes('/@excalidraw/') || id.includes('/roughjs/') || id.includes('/perfect-freehand/'))
                            return 'excalidraw-vendor';

                        // Heavy Libraries - GrapesJS (email editor)
                        if (id.includes('/grapesjs/'))
                            return 'grapes-vendor';

                        // Heavy Libraries - Mermaid/ELK/ReactFlow (diagrams)
                        if (
                            id.includes('/mermaid/') ||
                            id.includes('/elkjs/') ||
                            id.includes('/dagre/') ||
                            id.includes('/reactflow/') ||
                            id.includes('/@reactflow/')
                        )
                            return 'diagram-vendor';

                        // Heavy Libraries - Rich Text Editors (jQuery + MathQuill must load together)
                        if (
                            id.includes('/quill/') ||
                            id.includes('/react-quill/') ||
                            id.includes('/jquery/') ||
                            id.includes('/mathquill/') ||
                            id.includes('/mathquill4quill/')
                        )
                            return 'quill-vendor';
                        if (id.includes('/@tiptap/'))
                            return 'tiptap-vendor';
                        if (id.includes('/@yoopta/'))
                            return 'yoopta-vendor';

                        // Heavy Libraries - Monaco Editor (code)
                        if (id.includes('/@monaco-editor/') || id.includes('/monaco-editor/'))
                            return 'monaco-vendor';

                        // Heavy Libraries - Charts
                        if (id.includes('/recharts/') || id.includes('/d3/') || id.includes('/victory/'))
                            return 'chart-vendor';

                        // Heavy Libraries - Canvas/Fabric
                        if (id.includes('/fabric/'))
                            return 'fabric-vendor';

                        // Heavy Libraries - Presentations
                        if (id.includes('/reveal.js/') || id.includes('/pptxgenjs/'))
                            return 'presentation-vendor';

                        // Heavy Libraries - Firebase
                        if (id.includes('/firebase/') || id.includes('/@firebase/'))
                            return 'firebase-vendor';

                        // Heavy Libraries - Math rendering
                        if (id.includes('/katex/'))
                            return 'katex-vendor';

                        // Consolidated Icons (all icon libraries)
                        if (
                            id.includes('/phosphor-react/') ||
                            id.includes('/@phosphor-icons/') ||
                            id.includes('/lucide-react/') ||
                            id.includes('/react-icons/')
                        )
                            return 'icons-vendor';

                        // TanStack Query
                        if (id.includes('/@tanstack/react-query'))
                            return 'query-vendor';

                        // Flowbite UI
                        if (id.includes('/flowbite/') || id.includes('/flowbite-react/'))
                            return 'flowbite-vendor';

                        // Animation libraries
                        if (id.includes('/framer-motion/'))
                            return 'motion-vendor';

                        // Other heavy deps
                        if (id.includes('/pyodide/')) return 'pyodide-vendor';
                        if (id.includes('/papaparse/')) return 'csv-vendor';
                        if (id.includes('/mammoth/')) return 'docx-vendor';
                        if (id.includes('/socket.io/')) return 'socket-vendor';
                        if (id.includes('/intro.js/')) return 'intro-vendor';
                        if (id.includes('/prismjs/')) return 'prism-vendor';
                        if (id.includes('/@dnd-kit/')) return 'dnd-vendor';
                        if (id.includes('/reactflow/')) return 'flow-vendor';
                        if (id.includes('/@sentry/')) return 'sentry-vendor';
                        if (id.includes('/i18next/') || id.includes('/react-i18next/')) return 'i18n-vendor';
                        if (id.includes('/@amplitude/')) return 'amplitude-vendor';
                    }
                },
            },
            onwarn: (warning, warn) => {
                // Suppress specific warnings that might cause issues
                if (warning.code === 'CIRCULAR_DEPENDENCY') return;
                if (warning.code === 'INVALID_ANNOTATION') return;
                warn(warning);
            },
            maxParallelFileOps: 2, // Reduce parallel operations to save memory
        },
        target: 'esnext',
        minify: 'esbuild', // Use esbuild instead of terser for faster, less memory-intensive builds
        chunkSizeWarningLimit: 1000,
        assetsInlineLimit: 0, // Disable asset inlining to prevent issues
        sourcemap: false, // Disable sourcemaps in production to save memory
        reportCompressedSize: false, // Skip compressed size reporting to save memory
        // Worker-specific options are configured at the top-level `worker` field if needed
    },
    define: {
        __VERSION__: JSON.stringify('0.16.11'),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    assetsInclude: ['**/*.wasm'],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: '.vitest/setup',
        include: ['**/test.{ts,tsx}'],
    },
    server: {
        headers: {
            'Cross-Origin-Embedder-Policy': 'credentialless',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
            'Content-Security-Policy':
                "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: wasm:; worker-src * blob:; frame-src *; frame-ancestors 'self' https://www.youtube.com https://youtube.com https://*.youtube.com;",
        },
        proxy: {
            '/youtube': {
                target: 'https://www.youtube.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/youtube/, ''),
                secure: false,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        },
        cors: true,
        hmr: {
            protocol: 'ws',
            host: 'localhost',
        },
    },
    optimizeDeps: {
        exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'pyodide'],
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            'axios',
            'lodash',
            'date-fns',
            'pako',
            '@tanstack/react-router',
            '@tanstack/router-devtools',
        ],
        esbuildOptions: {
            target: 'esnext',
            supported: {
                bigint: true,
            },
        },
        force: true, // Force re-optimization to fix dependency issues
    },
});
