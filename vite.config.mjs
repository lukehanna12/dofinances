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
    manifest: true,
    rollupOptions: {
      // The route is imported directly by the persistent shell. Rollup must
      // preserve its named mountLogin export instead of treating it as a
      // side-effect-only HTML companion entry.
      preserveEntrySignatures: "strict",
      // The public shell lazy-loads the login module from this extra entry.
      input: {
        home: resolve(root, "index.html"),
        loginRoute: resolve(root, "src/routes/login-entry.jsx"),
      },
    },
  },
});
