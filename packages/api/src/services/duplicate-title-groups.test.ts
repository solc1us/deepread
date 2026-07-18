import { describe, expect, test } from "bun:test";

import {
  buildDuplicateTitleGroups,
  createDuplicateGroupFingerprint,
  excludeResolvedDuplicateGroups,
  normalizeTitleCandidate,
} from "./duplicate-title-groups";

const title = "A sufficiently specific duplicate paper title";

describe("duplicate title groups", () => {
  test("preserves the existing conservative title normalization", () => {
    expect(normalizeTitleCandidate("  A Sufficiently-Specific Duplicate Paper Title! ")).toBe(
      "a sufficiently specific duplicate paper title",
    );
    expect(normalizeTitleCandidate("Short title")).toBeNull();
  });

  test("fingerprints are independent of client paper order", () => {
    expect(createDuplicateGroupFingerprint(title, ["b", "a"])).toBe(
      createDuplicateGroupFingerprint(title, ["a", "b"]),
    );
  });

  test("changed membership produces a new auditable fingerprint", () => {
    const original = createDuplicateGroupFingerprint(title, ["a", "b"]);
    const changed = createDuplicateGroupFingerprint(title, ["a", "b", "c"]);

    expect(changed).not.toBe(original);
  });

  test("only the exact resolved fingerprint is excluded", () => {
    const original = buildDuplicateTitleGroups([
      { id: "a", title },
      { id: "b", title },
    ]);
    const changed = buildDuplicateTitleGroups([
      { id: "a", title },
      { id: "b", title },
      { id: "c", title },
    ]);
    const resolved = new Set([original[0]?.groupFingerprint ?? ""]);

    expect(excludeResolvedDuplicateGroups(original, resolved)).toHaveLength(0);
    expect(excludeResolvedDuplicateGroups(changed, resolved)).toHaveLength(1);
  });

  test("inactive merged papers leave the candidate group", () => {
    const groups = buildDuplicateTitleGroups([
      { id: "canonical", title, status: "published" },
      { id: "duplicate", title, status: "inactive" },
    ]);

    expect(groups).toHaveLength(0);
  });
});
