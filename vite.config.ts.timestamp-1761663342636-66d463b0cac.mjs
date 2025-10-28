// vite.config.ts
import { defineConfig } from "file:///C:/Users/dell/Documents/frontend-learner-dashboard-app/node_modules/.pnpm/vite@4.5.14_@types+node@22.16.3_sass@1.51.0/node_modules/vite/dist/node/index.js";
import viteReact from "file:///C:/Users/dell/Documents/frontend-learner-dashboard-app/node_modules/.pnpm/@vitejs+plugin-react@4.6.0__df7e1177c776806c3d81a3d20bd7c78e/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { TanStackRouterVite } from "file:///C:/Users/dell/Documents/frontend-learner-dashboard-app/node_modules/.pnpm/@tanstack+router-plugin@1.1_c6d99056d0b18c9d0fd4adbc4fa37da8/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
import path from "path";
import svgr from "file:///C:/Users/dell/Documents/frontend-learner-dashboard-app/node_modules/.pnpm/vite-plugin-svgr@4.3.0_roll_3109edb46b2ccf8cfed9039e967e01cd/node_modules/vite-plugin-svgr/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\dell\\Documents\\frontend-learner-dashboard-app";
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
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxkZWxsXFxcXERvY3VtZW50c1xcXFxmcm9udGVuZC1sZWFybmVyLWRhc2hib2FyZC1hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGRlbGxcXFxcRG9jdW1lbnRzXFxcXGZyb250ZW5kLWxlYXJuZXItZGFzaGJvYXJkLWFwcFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvZGVsbC9Eb2N1bWVudHMvZnJvbnRlbmQtbGVhcm5lci1kYXNoYm9hcmQtYXBwL3ZpdGUuY29uZmlnLnRzXCI7Ly8gdml0ZS5jb25maWcudHNcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHZpdGVSZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgVGFuU3RhY2tSb3V0ZXJWaXRlIH0gZnJvbSBcIkB0YW5zdGFjay9yb3V0ZXItcGx1Z2luL3ZpdGVcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHN2Z3IgZnJvbSBcInZpdGUtcGx1Z2luLXN2Z3JcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgVGFuU3RhY2tSb3V0ZXJWaXRlKCksXHJcbiAgICAgICAgdml0ZVJlYWN0KCksXHJcbiAgICAgICAgc3Zncih7IGluY2x1ZGU6IFwiKiovKi5zdmdcIiB9KSxcclxuICAgICAgICAvLyAuLi4sXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAnQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3knOiAnc2FtZS1vcmlnaW4tYWxsb3ctcG9wdXBzJyxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgICAgLy8gT3B0aW1pemUgYnVpbGQgZm9yIG1lbW9yeSB1c2FnZVxyXG4gICAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVuZG9yOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiXSxcclxuICAgICAgICAgICAgICAgICAgICByb3V0ZXI6IFtcIkB0YW5zdGFjay9yZWFjdC1yb3V0ZXJcIl0sXHJcbiAgICAgICAgICAgICAgICAgICAgdWk6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnVcIixcclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLGVBQWU7QUFDdEIsU0FBUywwQkFBMEI7QUFDbkMsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sVUFBVTtBQUxqQixJQUFNLG1DQUFtQztBQVF6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxtQkFBbUI7QUFBQSxJQUNuQixVQUFVO0FBQUEsSUFDVixLQUFLLEVBQUUsU0FBUyxXQUFXLENBQUM7QUFBQTtBQUFBLEVBRWhDO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDSCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDeEM7QUFBQSxFQUNKO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDSixTQUFTO0FBQUEsTUFDTCw4QkFBOEI7QUFBQSxJQUNsQztBQUFBLEVBQ0o7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUgsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ1gsUUFBUTtBQUFBLFFBQ0osY0FBYztBQUFBLFVBQ1YsUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLFVBQzdCLFFBQVEsQ0FBQyx3QkFBd0I7QUFBQSxVQUNqQyxJQUFJO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
