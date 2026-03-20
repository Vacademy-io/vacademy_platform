// vite.config.ts
import react from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin-dashboard-1/node_modules/.pnpm/@vitejs+plugin-react-swc@3._f6b4ca4abdf62b4968c7b97030c563bd/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { defineConfig } from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin-dashboard-1/node_modules/.pnpm/vite@5.4.11_@types+node@22.10.5_sass@1.51.0_terser@5.37.0/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin-dashboard-1/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_t_e0a63ad4284c30c09e3ae97f646532ca/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { TanStackRouterVite } from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin-dashboard-1/node_modules/.pnpm/@tanstack+router-plugin@1.9_2074b2f95bc64bcae7f671c89ae05e7a/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import svgr from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin-dashboard-1/node_modules/.pnpm/vite-plugin-svgr@4.3.0_roll_addb6d2261ddb73fcfb401b9b935fe2f/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Admin\\Documents\\GitHub\\frontend-admin-dashboard-1";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pblxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXGZyb250ZW5kLWFkbWluLWRhc2hib2FyZC0xXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pblxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXGZyb250ZW5kLWFkbWluLWRhc2hib2FyZC0xXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9BZG1pbi9Eb2N1bWVudHMvR2l0SHViL2Zyb250ZW5kLWFkbWluLWRhc2hib2FyZC0xL3ZpdGUuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3RcIiAvPlxyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcclxuaW1wb3J0IHsgVGFuU3RhY2tSb3V0ZXJWaXRlIH0gZnJvbSAnQHRhbnN0YWNrL3JvdXRlci1wbHVnaW4vdml0ZSc7XHJcbmltcG9ydCBzdmdyIGZyb20gJ3ZpdGUtcGx1Z2luLXN2Z3InO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZyBodHRwczovL3ZpdGVzdC5kZXYvY29uZmlnXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpLCBUYW5TdGFja1JvdXRlclZpdGUoKSwgc3Zncih7IGluY2x1ZGU6ICcqKi8qLnN2ZycgfSldLFxyXG4gICAgLy8gcGx1Z2luczogW3JlYWN0KCksIHRzY29uZmlnUGF0aHMoKSwgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KV0sXHJcblxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gR3JvdXAgdmVuZG9yIGRlcGVuZGVuY2llc1xyXG4gICAgICAgICAgICAgICAgICAgIHZlbmRvcjogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEdyb3VwIGxhcmdlIGxpYnJhcmllcyBzZXBhcmF0ZWx5XHJcbiAgICAgICAgICAgICAgICAgICAgcGRmanM6IFsncGRmanMtZGlzdCcsICdwZGYtbGliJ10sXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBvdGhlciBsYXJnZSBkZXBlbmRlbmNpZXMgaGVyZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgICBhbGlhczoge1xyXG4gICAgICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgdGVzdDoge1xyXG4gICAgICAgIGdsb2JhbHM6IHRydWUsXHJcbiAgICAgICAgZW52aXJvbm1lbnQ6ICdoYXBweS1kb20nLFxyXG4gICAgICAgIHNldHVwRmlsZXM6ICcudml0ZXN0L3NldHVwJyxcclxuICAgICAgICBpbmNsdWRlOiBbJyoqL3Rlc3Que3RzLHRzeH0nXSxcclxuICAgIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLG1CQUFtQjtBQUMxQixTQUFTLDBCQUEwQjtBQUNuQyxPQUFPLFVBQVU7QUFOakIsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDeEIsU0FBUyxDQUFDLE1BQU0sR0FBRyxjQUFjLEdBQUcsbUJBQW1CLEdBQUcsS0FBSyxFQUFFLFNBQVMsV0FBVyxDQUFDLENBQUM7QUFBQTtBQUFBLEVBR3ZGLE9BQU87QUFBQSxJQUNILGVBQWU7QUFBQSxNQUNYLFFBQVE7QUFBQSxRQUNKLGNBQWM7QUFBQTtBQUFBLFVBRVYsUUFBUSxDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQTtBQUFBLFVBRWpELE9BQU8sQ0FBQyxjQUFjLFNBQVM7QUFBQTtBQUFBLFFBR25DO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDSCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDeEM7QUFBQSxFQUNKO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDRixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZO0FBQUEsSUFDWixTQUFTLENBQUMsa0JBQWtCO0FBQUEsRUFDaEM7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
