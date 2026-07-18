import { describe, expect, test } from "bun:test";

import { mergeReadingProgressValues } from "./duplicate-paper-merge-policy";

describe("duplicate paper reading progress policy", () => {
  test("keeps the highest progress and latest reading activity", () => {
    const merged = mergeReadingProgressValues([
      {
        status: "reading",
        progressPercentage: 25,
        startedAt: new Date("2026-01-02T00:00:00Z"),
        completedAt: null,
        lastReadAt: new Date("2026-01-03T00:00:00Z"),
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        status: "reading",
        progressPercentage: 70,
        startedAt: new Date("2026-01-01T00:00:00Z"),
        completedAt: null,
        lastReadAt: new Date("2026-01-05T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    expect(merged.status).toBe("reading");
    expect(merged.progressPercentage).toBe(70);
    expect(merged.startedAt).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(merged.lastReadAt).toEqual(new Date("2026-01-05T00:00:00Z"));
  });

  test("completion wins and preserves an existing completion timestamp", () => {
    const merged = mergeReadingProgressValues([
      {
        status: "reading",
        progressPercentage: 90,
        startedAt: null,
        completedAt: null,
        lastReadAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        status: "completed",
        progressPercentage: 100,
        startedAt: null,
        completedAt: new Date("2026-01-04T00:00:00Z"),
        lastReadAt: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    expect(merged.status).toBe("completed");
    expect(merged.progressPercentage).toBe(100);
    expect(merged.completedAt).toEqual(new Date("2026-01-04T00:00:00Z"));
  });
});
