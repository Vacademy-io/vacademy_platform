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

                    // Quill editor - rich text editing
                    if (id.includes('react-quill') || id.includes('quill')) {
                        return 'quill-editor';
                    }

                    // KaTeX - math rendering
                    if (id.includes('katex')) {
                        return 'katex';
                    }

                    // Charts libraries - for dashboard
                    if (id.includes('recharts') ||
                        id.includes('echarts') ||
                        id.includes('echarts-for-react') ||
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
