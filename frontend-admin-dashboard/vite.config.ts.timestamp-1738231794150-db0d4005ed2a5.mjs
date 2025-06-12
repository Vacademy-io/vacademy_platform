// vite.config.ts
import react from "file:///C:/Users/Shristi%20Gupta/Documents/GitHub/frontend-admin-dashboard/node_modules/.pnpm/@vitejs+plugin-react-swc@3.7.2_vite@5.4.11_@types+node@22.10.5_terser@5.37.0_/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { defineConfig } from "file:///C:/Users/Shristi%20Gupta/Documents/GitHub/frontend-admin-dashboard/node_modules/.pnpm/vite@5.4.11_@types+node@22.10.5_terser@5.37.0/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///C:/Users/Shristi%20Gupta/Documents/GitHub/frontend-admin-dashboard/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_typescript@5.0.4_vite@5.4.11_@types+node@22.10.5_terser@5.37.0_/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { TanStackRouterVite } from "file:///C:/Users/Shristi%20Gupta/Documents/GitHub/frontend-admin-dashboard/node_modules/.pnpm/@tanstack+router-plugin@1.95.3_@tanstack+react-router@1.95.3_react-dom@18.3.1_react@18.3.1__r_zlrdvxvnsaeh7hxjul2pwhq2c4/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import svgr from "file:///C:/Users/Shristi%20Gupta/Documents/GitHub/frontend-admin-dashboard/node_modules/.pnpm/vite-plugin-svgr@4.3.0_rollup@2.79.2_typescript@5.0.4_vite@5.4.11_@types+node@22.10.5_terser@5.37.0_/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Shristi Gupta\\Documents\\GitHub\\frontend-admin-dashboard";
var vite_config_default = defineConfig({
  plugins: [react(), tsconfigPaths(), TanStackRouterVite(), svgr({ include: "**/*.svg" })],
  // plugins: [react(), tsconfigPaths(), svgr({ include: "**/*.svg" })],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxTaHJpc3RpIEd1cHRhXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcZnJvbnRlbmQtYWRtaW4tZGFzaGJvYXJkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxTaHJpc3RpIEd1cHRhXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcZnJvbnRlbmQtYWRtaW4tZGFzaGJvYXJkXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9TaHJpc3RpJTIwR3VwdGEvRG9jdW1lbnRzL0dpdEh1Yi9mcm9udGVuZC1hZG1pbi1kYXNoYm9hcmQvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuaW1wb3J0IHsgVGFuU3RhY2tSb3V0ZXJWaXRlIH0gZnJvbSBcIkB0YW5zdGFjay9yb3V0ZXItcGx1Z2luL3ZpdGVcIjtcbmltcG9ydCBzdmdyIGZyb20gXCJ2aXRlLXBsdWdpbi1zdmdyXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcgaHR0cHM6Ly92aXRlc3QuZGV2L2NvbmZpZ1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpLCBUYW5TdGFja1JvdXRlclZpdGUoKSwgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KV0sXG4gICAgLy8gcGx1Z2luczogW3JlYWN0KCksIHRzY29uZmlnUGF0aHMoKSwgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KV0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgICBhbGlhczoge1xuICAgICAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICB0ZXN0OiB7XG4gICAgICAgIGdsb2JhbHM6IHRydWUsXG4gICAgICAgIGVudmlyb25tZW50OiBcImhhcHB5LWRvbVwiLFxuICAgICAgICBzZXR1cEZpbGVzOiBcIi52aXRlc3Qvc2V0dXBcIixcbiAgICAgICAgaW5jbHVkZTogW1wiKiovdGVzdC57dHMsdHN4fVwiXSxcbiAgICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLG1CQUFtQjtBQUMxQixTQUFTLDBCQUEwQjtBQUNuQyxPQUFPLFVBQVU7QUFOakIsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDeEIsU0FBUyxDQUFDLE1BQU0sR0FBRyxjQUFjLEdBQUcsbUJBQW1CLEdBQUcsS0FBSyxFQUFFLFNBQVMsV0FBVyxDQUFDLENBQUM7QUFBQTtBQUFBLEVBRXZGLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNGLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFlBQVk7QUFBQSxJQUNaLFNBQVMsQ0FBQyxrQkFBa0I7QUFBQSxFQUNoQztBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
