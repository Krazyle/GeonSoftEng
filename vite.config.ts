import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vitest/config";

export default defineConfig((env) => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins:
    env.mode === "test"
      ? [react()]
      : [
          react(),
          nodePolyfills({
            globals: {
              Buffer: false,
              global: false,
              process: false,
            },
          }),
        ],
  worker: {
    format: "es",
  },
  test: {
    dir: "./",
    deps: {
      interopDefault: true,
    },
    globals: true,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
}));
