// vite.config.ts
import react from "file:///C:/Users/shrey/OneDrive/Desktop/frontend-admin-dashboard/node_modules/.pnpm/@vitejs+plugin-react-swc@3._f6b4ca4abdf62b4968c7b97030c563bd/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { defineConfig } from "file:///C:/Users/shrey/OneDrive/Desktop/frontend-admin-dashboard/node_modules/.pnpm/vite@5.4.11_@types+node@22.10.5_sass@1.51.0_terser@5.37.0/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///C:/Users/shrey/OneDrive/Desktop/frontend-admin-dashboard/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_t_e0a63ad4284c30c09e3ae97f646532ca/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { TanStackRouterVite } from "file:///C:/Users/shrey/OneDrive/Desktop/frontend-admin-dashboard/node_modules/.pnpm/@tanstack+router-plugin@1.9_2074b2f95bc64bcae7f671c89ae05e7a/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import svgr from "file:///C:/Users/shrey/OneDrive/Desktop/frontend-admin-dashboard/node_modules/.pnpm/vite-plugin-svgr@4.3.0_roll_addb6d2261ddb73fcfb401b9b935fe2f/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\shrey\\OneDrive\\Desktop\\frontend-admin-dashboard";
var vite_config_default = defineConfig({
  plugins: [react(), tsconfigPaths(), TanStackRouterVite(), svgr({ include: "**/*.svg" })],
  // plugins: [react(), tsconfigPaths(), svgr({ include: "**/*.svg" })],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Group vendor dependencies
          vendor: ["react", "react-dom", "react-router-dom"],
          // Group large libraries separately
          pdfjs: ["pdfjs-dist", "pdf-lib"]
          // Add other large dependencies here
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ".vitest/setup",
    include: ["**/test.{ts,tsx}"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzaHJleVxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXGZyb250ZW5kLWFkbWluLWRhc2hib2FyZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcc2hyZXlcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxmcm9udGVuZC1hZG1pbi1kYXNoYm9hcmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3NocmV5L09uZURyaXZlL0Rlc2t0b3AvZnJvbnRlbmQtYWRtaW4tZGFzaGJvYXJkL3ZpdGUuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3RcIiAvPlxyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xyXG5pbXBvcnQgeyBUYW5TdGFja1JvdXRlclZpdGUgfSBmcm9tIFwiQHRhbnN0YWNrL3JvdXRlci1wbHVnaW4vdml0ZVwiO1xyXG5pbXBvcnQgc3ZnciBmcm9tIFwidml0ZS1wbHVnaW4tc3ZnclwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZyBodHRwczovL3ZpdGVzdC5kZXYvY29uZmlnXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpLCBUYW5TdGFja1JvdXRlclZpdGUoKSwgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KV0sXHJcbiAgICAvLyBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpLCBzdmdyKHsgaW5jbHVkZTogXCIqKi8qLnN2Z1wiIH0pXSxcclxuXHJcbiAgICBidWlsZDoge1xyXG4gICAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICAgICAvLyBHcm91cCB2ZW5kb3IgZGVwZW5kZW5jaWVzXHJcbiAgICAgICAgICAgICAgdmVuZG9yOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgICAgICAgLy8gR3JvdXAgbGFyZ2UgbGlicmFyaWVzIHNlcGFyYXRlbHlcclxuICAgICAgICAgICAgICBwZGZqczogWydwZGZqcy1kaXN0JywgJ3BkZi1saWInXSxcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgLy8gQWRkIG90aGVyIGxhcmdlIGRlcGVuZGVuY2llcyBoZXJlXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9fSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgICBhbGlhczoge1xyXG4gICAgICAgXHJcbiAgICAgICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICB0ZXN0OiB7XHJcbiAgICAgICAgZ2xvYmFsczogdHJ1ZSxcclxuICAgICAgICBlbnZpcm9ubWVudDogXCJoYXBweS1kb21cIixcclxuICAgICAgICBzZXR1cEZpbGVzOiBcIi52aXRlc3Qvc2V0dXBcIixcclxuICAgICAgICBpbmNsdWRlOiBbXCIqKi90ZXN0Lnt0cyx0c3h9XCJdLFxyXG4gICAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sbUJBQW1CO0FBQzFCLFNBQVMsMEJBQTBCO0FBQ25DLE9BQU8sVUFBVTtBQU5qQixJQUFNLG1DQUFtQztBQVN6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTLENBQUMsTUFBTSxHQUFHLGNBQWMsR0FBRyxtQkFBbUIsR0FBRyxLQUFLLEVBQUUsU0FBUyxXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUEsRUFHdkYsT0FBTztBQUFBLElBQ0gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBO0FBQUEsVUFFWixRQUFRLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBO0FBQUEsVUFFakQsT0FBTyxDQUFDLGNBQWMsU0FBUztBQUFBO0FBQUEsUUFHakM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQUM7QUFBQSxFQUNMLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUVILEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUV4QztBQUFBLEVBQ0o7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNGLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFlBQVk7QUFBQSxJQUNaLFNBQVMsQ0FBQyxrQkFBa0I7QUFBQSxFQUNoQztBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
