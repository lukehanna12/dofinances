import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // Studio has one entrypoint. CI also packages this build at apex /login.
      input: {
        home: resolve(root, "index.html"),
      },
    },
  },
});
