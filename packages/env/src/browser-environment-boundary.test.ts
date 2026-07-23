import path from "node:path";

import { describe, expect, test } from "bun:test";

const SERVER_ONLY_MARKERS = [
  "@deepread/env/server",
  "DATABASE_URL",
  "DIRECT_URL",
  "BETTER_AUTH_SECRET",
] as const;

describe("browser environment boundary", () => {
  test("web source does not import or reference server-only environment values", async () => {
    const repositoryRoot = path.resolve(import.meta.dir, "../../..");
    const webSourceRoot = path.join(repositoryRoot, "apps/web/src");
    const violations: string[] = [];

    for await (const relativePath of new Bun.Glob("**/*.{ts,tsx}").scan({
      cwd: webSourceRoot,
      onlyFiles: true,
    })) {
      const source = await Bun.file(path.join(webSourceRoot, relativePath)).text();
      for (const marker of SERVER_ONLY_MARKERS) {
        if (source.includes(marker)) {
          violations.push(`${relativePath}: ${marker}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
