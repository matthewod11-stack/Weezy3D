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
        // 2D Phaser game removed (lives in a separate repo) — the 3D testbed
        // is the game now; maps.html stays as the level-design surface.
        maps: resolve(__dirname, "maps.html"),
        three: resolve(__dirname, "3d.html"),
      },
    },
  },
});
