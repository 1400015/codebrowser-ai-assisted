import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "src/ui/sidepanel.html"),
        overlay: resolve(__dirname, "src/ui/overlay.html"),
        capturePopup: resolve(__dirname, "src/ui/capture-popup.html"),
        content: resolve(__dirname, "src/content/main.ts"),
        clipboardHook: resolve(__dirname, "src/inject/clipboard-hook.ts"),
        sw: resolve(__dirname, "src/background/sw.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "content") return "content.js";
          if (chunk.name === "clipboardHook") return "clipboard-hook.js";
          if (chunk.name === "sw") return "sw.js";
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
