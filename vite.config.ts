import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  assetsInclude: ["**/*.json"],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        maps: resolve(__dirname, "maps.html"),
        three: resolve(__dirname, "3d.html"),
      },
    },
  },
});
