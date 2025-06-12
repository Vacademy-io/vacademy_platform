// vite.config.ts
import react from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin/node_modules/.pnpm/@vitejs+plugin-react-swc@3._9f32e4ac447d920eab2590e8389cc651/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { defineConfig } from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin/node_modules/.pnpm/vite@5.4.11_@types+node@22.10.5_terser@5.37.0/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_t_f46057eeab56b1c8728ee70b95990091/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { TanStackRouterVite } from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin/node_modules/.pnpm/@tanstack+router-plugin@1.9_8e50fca1fc09b7042f1b54ee406c852b/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import svgr from "file:///C:/Users/Admin/Documents/GitHub/frontend-admin/node_modules/.pnpm/vite-plugin-svgr@4.3.0_roll_e6cb27edfcba290f2e908c5cf42fe5ca/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Admin\\Documents\\GitHub\\frontend-admin";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pblxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXGZyb250ZW5kLWFkbWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBZG1pblxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXGZyb250ZW5kLWFkbWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9BZG1pbi9Eb2N1bWVudHMvR2l0SHViL2Zyb250ZW5kLWFkbWluL3ZpdGUuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3RcIiAvPlxyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xyXG5pbXBvcnQgeyBUYW5TdGFja1JvdXRlclZpdGUgfSBmcm9tIFwiQHRhbnN0YWNrL3JvdXRlci1wbHVnaW4vdml0ZVwiO1xyXG5pbXBvcnQgc3ZnciBmcm9tIFwidml0ZS1wbHVnaW4tc3ZnclwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZyBodHRwczovL3ZpdGVzdC5kZXYvY29uZmlnXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpLCBUYW5TdGFja1JvdXRlclZpdGUoKSwgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KV0sXHJcbiAgICAvLyBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpLCBzdmdyKHsgaW5jbHVkZTogXCIqKi8qLnN2Z1wiIH0pXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgICBhbGlhczoge1xyXG4gICAgICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIHRlc3Q6IHtcclxuICAgICAgICBnbG9iYWxzOiB0cnVlLFxyXG4gICAgICAgIGVudmlyb25tZW50OiBcImhhcHB5LWRvbVwiLFxyXG4gICAgICAgIHNldHVwRmlsZXM6IFwiLnZpdGVzdC9zZXR1cFwiLFxyXG4gICAgICAgIGluY2x1ZGU6IFtcIioqL3Rlc3Que3RzLHRzeH1cIl0sXHJcbiAgICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxtQkFBbUI7QUFDMUIsU0FBUywwQkFBMEI7QUFDbkMsT0FBTyxVQUFVO0FBTmpCLElBQU0sbUNBQW1DO0FBU3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsY0FBYyxHQUFHLG1CQUFtQixHQUFHLEtBQUssRUFBRSxTQUFTLFdBQVcsQ0FBQyxDQUFDO0FBQUE7QUFBQSxFQUV2RixTQUFTO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDSCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDeEM7QUFBQSxFQUNKO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDRixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZO0FBQUEsSUFDWixTQUFTLENBQUMsa0JBQWtCO0FBQUEsRUFDaEM7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
