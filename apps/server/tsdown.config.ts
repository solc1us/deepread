import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    standalone: "./src/standalone.ts",
    "vercel-app": "./src/express-app.ts",
  },
  format: "esm",
  outDir: "./dist",
  clean: true,
  deps: {
    alwaysBundle: [/@deepread\/.*/],
  },
});
