import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/server.ts"),
      name: "EufyRoboVacMCPServer",
      fileName: (format) => `server.${format}.js`,
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@modelcontextprotocol/sdk/server/index.js",
        "@modelcontextprotocol/sdk/server/stdio.js",
        "@modelcontextprotocol/sdk/types.js",
        "eufy-robovac",
        "crypto",
        "crypto-js",
        "node-rsa",
        "net",
        "child_process",
        "os",
      ],
    },
    target: "node18",
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
