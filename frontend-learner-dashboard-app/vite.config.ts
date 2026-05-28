// vite.config.ts
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        TanStackRouterVite(),
        viteReact(),
        svgr({
            include: "**/*.svg",
            exclude: [
                "**/ssdc-logo*.svg",
                "**/ssdc_logo.svg",
                "**/registration-logo.svg"
            ]
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 8100,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        },
        // --- Local backend microservices -------------------------------------
        // Active only when VITE_BACKEND_URL points at this dev origin (see
        // .env.development.local). Each service runs on its own port and serves
        // its own "/<name>-service/..." path prefix, so NO rewrite is needed.
        // When VITE_BACKEND_URL is the default staging URL these routes are
        // never hit. ai-service is a Python/FastAPI app run via uvicorn on :8077.
        proxy: {
            '/auth-service': { target: 'http://localhost:8071', changeOrigin: true },
            '/admin-core-service': { target: 'http://localhost:8072', changeOrigin: true },
            '/community-service': { target: 'http://localhost:8073', changeOrigin: true },
            '/assessment-service': { target: 'http://localhost:8074', changeOrigin: true },
            '/media-service': { target: 'http://localhost:8075', changeOrigin: true },
            '/notification-service': { target: 'http://localhost:8076', changeOrigin: true },
            '/ai-service': { target: 'http://localhost:8077', changeOrigin: true },
        },
    },
    build: {
        // Optimize build for memory usage
        chunkSizeWarningLimit: 1000,
        // Disable source maps for smaller builds
        sourcemap: false,
        rollupOptions: {
            output: {
                // Conservative chunking strategy - only split truly independent heavy libs
                manualChunks: (id) => {

                    // Firebase - can be safely split as it's dynamically imported
                    if (id.includes('firebase/') || id.includes('@firebase/')) {
                        return 'firebase';
                    }

                    // Excalidraw - huge, must be separate for lazy loading
                    if (id.includes('@excalidraw/')) {
                        return 'excalidraw';
                    }

                    // Monaco Editor - large, for code editor feature
                    if (id.includes('@monaco-editor/') || id.includes('monaco-editor')) {
                        return 'monaco-editor';
                    }

                    // PDF Viewer - large, for PDF viewing feature  
                    if (id.includes('@react-pdf-viewer/')) {
                        return 'pdf-viewer';
                    }


                    // Pyodide - Python runtime, for code execution
                    if (id.includes('pyodide')) {
                        return 'pyodide';
                    }

                    // Quill editor - rich text editing.
                    // IMPORTANT: only match Quill *node_modules* — never src
                    // paths. The src/components/quill/* files transitively
                    // import axios (via use-file-upload → upload_file), and a
                    // bare `id.includes('quill')` was hoisting axios into the
                    // quill chunk, making *every* axios call drag in Quill +
                    // mathquill + jquery and triggering a circular-init
                    // ("Cannot access 'B' before initialization") on app load.
                    // jquery must live in this chunk too — mathquill reads
                    // window.jQuery at module-eval time, and the import order
                    // in MainViewQuillEditor.jsx only holds within one chunk.
                    if (
                        id.includes('node_modules/react-quill-new') ||
                        id.includes('node_modules/quill/') ||
                        id.includes('node_modules/quill-delta') ||
                        id.includes('node_modules/mathquill4quill') ||
                        id.includes('node_modules/@edtr-io/mathquill') ||
                        id.includes('node_modules/jquery')
                    ) {
                        return 'quill-editor';
                    }

                    // KaTeX - math rendering
                    if (id.includes('katex')) {
                        return 'katex';
                    }

                    // Charts libraries - for dashboard
                    if (id.includes('recharts') ||
                        id.includes('@nivo/') ||
                        id.includes('@visx/')) {
                        return 'charts';
                    }

                    // Huge Icon Libraries - Need to be split
                    if (id.includes('react-icons')) {
                        return 'react-icons';
                    }
                    if (id.includes('@phosphor-icons') || id.includes('phosphor-react')) {
                        return 'phosphor-icons';
                    }
                    if (id.includes('@tabler/icons-react')) {
                        return 'tabler-icons';
                    }

                    // Large Data Processing Libraries
                    if (id.includes('country-state-city')) {
                        return 'country-state-city';
                    }
                    if (id.includes('xlsx')) {
                        return 'excel-processor';
                    }
                    if (id.includes('mermaid')) {
                        return 'mermaid';
                    }
                    if (id.includes('lottie-react')) {
                        return 'lottie';
                    }
                    if (id.includes('framer-motion')) {
                        return 'framer-motion';
                    }

                    // Don't split React, Radix, or other core UI libs - keep them together
                    // This prevents forwardRef and other React primitive issues
                },
            },
        },
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            '@tanstack/react-router',
            '@tanstack/react-query',
            'zustand',
            'axios',
            'clsx',
            'tailwind-merge',
        ],
        exclude: [
            '@excalidraw/excalidraw',
            'pyodide',
        ],
    },
});
