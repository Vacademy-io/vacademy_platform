// vite.config.ts
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  server: {
    port: 3020, // Change this to your desired port
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // add other PWA options here
    }),
    tsconfigPaths(),
  ],
})