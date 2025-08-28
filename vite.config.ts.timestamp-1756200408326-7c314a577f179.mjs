// vite.config.ts
import { defineConfig } from "file:///D:/frontend-learner-dashboard-app/node_modules/.pnpm/vite@4.5.14_@types+node@22.16.3_sass@1.51.0/node_modules/vite/dist/node/index.js";
import viteReact from "file:///D:/frontend-learner-dashboard-app/node_modules/.pnpm/@vitejs+plugin-react@4.6.0__df7e1177c776806c3d81a3d20bd7c78e/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { TanStackRouterVite } from "file:///D:/frontend-learner-dashboard-app/node_modules/.pnpm/@tanstack+router-plugin@1.1_c6d99056d0b18c9d0fd4adbc4fa37da8/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import path from "path";
import svgr from "file:///D:/frontend-learner-dashboard-app/node_modules/.pnpm/vite-plugin-svgr@4.3.0_roll_3109edb46b2ccf8cfed9039e967e01cd/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "D:\\frontend-learner-dashboard-app";
var vite_config_default = defineConfig({
  plugins: [
    TanStackRouterVite(),
    viteReact(),
    svgr({ include: "**/*.svg" })
    // ...,
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    // Optimize build for memory usage
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["@tanstack/react-router"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu"
          ]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxmcm9udGVuZC1sZWFybmVyLWRhc2hib2FyZC1hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXGZyb250ZW5kLWxlYXJuZXItZGFzaGJvYXJkLWFwcFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovZnJvbnRlbmQtbGVhcm5lci1kYXNoYm9hcmQtYXBwL3ZpdGUuY29uZmlnLnRzXCI7Ly8gdml0ZS5jb25maWcudHNcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHZpdGVSZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgVGFuU3RhY2tSb3V0ZXJWaXRlIH0gZnJvbSBcIkB0YW5zdGFjay9yb3V0ZXItcGx1Z2luL3ZpdGVcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHN2Z3IgZnJvbSBcInZpdGUtcGx1Z2luLXN2Z3JcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgVGFuU3RhY2tSb3V0ZXJWaXRlKCksXHJcbiAgICAgICAgdml0ZVJlYWN0KCksXHJcbiAgICAgICAgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KSxcclxuICAgICAgICAvLyAuLi4sXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgICAvLyBPcHRpbWl6ZSBidWlsZCBmb3IgbWVtb3J5IHVzYWdlXHJcbiAgICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICAgICAgICAgICB2ZW5kb3I6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCJdLFxyXG4gICAgICAgICAgICAgICAgICAgIHJvdXRlcjogW1wiQHRhbnN0YWNrL3JlYWN0LXJvdXRlclwiXSxcclxuICAgICAgICAgICAgICAgICAgICB1aTogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1kaWFsb2dcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sZUFBZTtBQUN0QixTQUFTLDBCQUEwQjtBQUNuQyxPQUFPLFVBQVU7QUFDakIsT0FBTyxVQUFVO0FBTGpCLElBQU0sbUNBQW1DO0FBUXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVM7QUFBQSxJQUNMLG1CQUFtQjtBQUFBLElBQ25CLFVBQVU7QUFBQSxJQUNWLEtBQUssRUFBRSxTQUFTLFdBQVcsQ0FBQztBQUFBO0FBQUEsRUFFaEM7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUgsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ1gsUUFBUTtBQUFBLFFBQ0osY0FBYztBQUFBLFVBQ1YsUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLFVBQzdCLFFBQVEsQ0FBQyx3QkFBd0I7QUFBQSxVQUNqQyxJQUFJO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
