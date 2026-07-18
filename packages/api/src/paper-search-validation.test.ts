import { describe, expect, test } from "bun:test";

import { MAX_PAPER_SEARCH_LENGTH } from "./paper-search-limits";
import { paperSearchQuerySchema } from "./paper-search-validation";

describe("paper search query validation", () => {
  test("allows an omitted query", () => {
    expect(paperSearchQuerySchema.parse(undefined)).toBeUndefined();
  });

  test("allows an empty query", () => {
    expect(paperSearchQuerySchema.parse("")).toBe("");
  });

  test("trims whitespace consistently", () => {
    expect(paperSearchQuerySchema.parse("   student learning   ")).toBe("student learning");
    expect(paperSearchQuerySchema.parse("   ")).toBe("");
  });

  test("accepts a query exactly at the maximum length", () => {
    const query = "a".repeat(MAX_PAPER_SEARCH_LENGTH);

    expect(paperSearchQuerySchema.parse(query)).toBe(query);
  });

  test("rejects a query over the maximum length", () => {
    const result = paperSearchQuerySchema.safeParse("a".repeat(MAX_PAPER_SEARCH_LENGTH + 1));

    expect(result.success).toBe(false);
  });

  test("does not alter other paper-list filters", () => {
    const filters = {
      categoryId: "2c39ca5d-0ec6-4d1c-ae23-e3e04a4f83a0",
      difficulty: "moderate" as const,
      sort: "title" as const,
      page: 2,
      limit: 10,
    };

    expect({ ...filters, q: paperSearchQuerySchema.parse("  education  ") }).toEqual({
      ...filters,
      q: "education",
    });
  });
});
