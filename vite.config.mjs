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
      // Two real HTML entry points, one shared Auth-3 React implementation.
      input: {
        home: resolve(root, "index.html"),
        login: resolve(root, "login/index.html"),
      },
    },
  },
});
