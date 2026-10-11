import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/* Demo build: no API proxy — all requests are answered in the browser by src/api (mock). */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (id.includes("react-dom") || id.includes("react/")) return "react";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5176,
    strictPort: false,
  },
  preview: {
    port: 5176,
  },
});
