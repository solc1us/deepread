import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "vercel-app": "./src/app.ts",
  },
  format: "esm",
  outDir: "./dist",
  clean: true,
  deps: {
    alwaysBundle: [/@deepread\/.*/],
  },
});
