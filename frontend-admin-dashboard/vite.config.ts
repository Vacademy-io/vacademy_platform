/// <reference types="vitest" />
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig({
    plugins: [react(), tsconfigPaths(), TanStackRouterVite(), svgr({ include: "**/*.svg" })],
    // plugins: [react(), tsconfigPaths(), svgr({ include: "**/*.svg" })],

    build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Group vendor dependencies
              vendor: ['react', 'react-dom', 'react-router-dom'],
              // Group large libraries separately
              pdfjs: ['pdfjs-dist', 'pdf-lib'],
            
              // Add other large dependencies here
            }
          }
        }},
    resolve: {
        alias: {
       
            "@": path.resolve(__dirname, "./src"),
       
        },
    },
    test: {
        globals: true,
        environment: "happy-dom",
        setupFiles: ".vitest/setup",
        include: ["**/test.{ts,tsx}"],
    },
});
