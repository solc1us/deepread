import { describe, expect, mock, test } from "bun:test";

import {
  getFrontendOperationCalls,
  setFrontendOperationHandler,
} from "@/test/test-doubles";
import { renderWithProviders, screen, waitFor } from "@/test/render";

import { DuplicateResolutionNotice } from "./duplicate-resolution-notice";
import { DuplicateTitleResolutionActions } from "./duplicate-title-resolution-actions";
import type {
  DuplicateResolutionGroup,
  ResolveDuplicateResult,
} from "./duplicate-resolution-types";

const group: DuplicateResolutionGroup = {
  groupKey: "shared paper title",
  normalizedTitle: "shared paper title",
  papers: [
    {
      paperId: "paper-a",
      title: "Paper Alpha",
      authors: ["Ada Author"],
      publicationYear: 2024,
      categoryName: "Education",
      status: "published",
      doi: "10.1000/a",
      provider: "openalex",
      externalId: "W1",
      bookmarkCount: 2,
      noteCount: 1,
      readingProgressCount: 1,
    },
    {
      paperId: "paper-b",
      title: "Paper Beta",
      authors: ["Ben Scholar"],
      publicationYear: 2023,
      categoryName: "Education",
      status: "published",
      doi: "10.1000/b",
      provider: "openalex",
      externalId: "W2",
      bookmarkCount: 3,
      noteCount: 2,
      readingProgressCount: 1,
    },
    {
      paperId: "paper-c",
      title: "Paper Gamma",
      authors: ["Cara Researcher"],
      publicationYear: 2022,
      categoryName: "Education",
      status: "needs_review",
      doi: null,
      provider: "openalex",
      externalId: "W3",
      bookmarkCount: 0,
      noteCount: 1,
      readingProgressCount: 0,
    },
  ],
};

const mergeResult: ResolveDuplicateResult = {
  resolution: "merge",
  groupFingerprint: "fingerprint",
  canonicalPaperId: "paper-a",
  duplicatePaperIds: ["paper-b"],
  moved: { sources: 3, bookmarks: 2, notes: 4, readingProgress: 1 },
  deduplicated: { sources: 1, bookmarks: 1, readingProgress: 1 },
  inactivePapers: 1,
};

describe("duplicate-title resolution actions", () => {
  test("requires a valid keep-both reason and sends the backend contract", async () => {
    const onResolved = mock(() => undefined);
    const result: ResolveDuplicateResult = {
      resolution: "keep_both",
      groupFingerprint: "fingerprint",
      paperIds: ["paper-a", "paper-b", "paper-c"],
    };
    setFrontendOperationHandler("admin.dataQuality.resolveDuplicateGroup", () => result);
    const { user } = renderWithProviders(
      <DuplicateTitleResolutionActions group={group} onResolved={onResolved} />,
    );

    await user.click(screen.getByRole("button", { name: "Keep both" }));
    await user.click(screen.getByRole("button", { name: "Confirm keep both" }));
    expect(screen.getByText("Review reason is required.")).toBeTruthy();
    expect(getFrontendOperationCalls("admin.dataQuality.resolveDuplicateGroup")).toEqual([]);

    const reason = "These are distinct editions with separate study samples.";
    await user.type(screen.getByRole("textbox", { name: "Review reason" }), reason);
    await user.click(screen.getByRole("button", { name: "Confirm keep both" }));

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(result));
    expect(getFrontendOperationCalls("admin.dataQuality.resolveDuplicateGroup")).toEqual([
      {
        resolution: "keep_both",
        groupKey: "shared paper title",
        paperIds: ["paper-a", "paper-b", "paper-c"],
        reason,
      },
    ]);
  });

  test("defaults non-retained papers to duplicates and enforces merge selections", async () => {
    const onResolved = mock(() => undefined);
    setFrontendOperationHandler("admin.dataQuality.resolveDuplicateGroup", () => mergeResult);
    const { user } = renderWithProviders(
      <DuplicateTitleResolutionActions group={group} onResolved={onResolved} />,
    );

    await user.click(screen.getByRole("button", { name: "Merge duplicates" }));
    await user.click(screen.getByRole("button", { name: "Confirm safe merge" }));
    expect(screen.getByText("Select one paper to keep.")).toBeTruthy();
    expect(screen.getByText("Select at least one duplicate paper.")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /Paper Alpha/ }));
    const duplicateChoices = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(duplicateChoices).toHaveLength(2);
    expect(duplicateChoices.every((choice) => choice.checked)).toBe(true);

    await user.click(duplicateChoices[0]);
    await user.click(duplicateChoices[1]);
    const reason = "The selected records describe the same confirmed publication.";
    await user.type(screen.getByRole("textbox", { name: "Review reason" }), reason);
    await user.click(screen.getByRole("button", { name: "Confirm safe merge" }));
    expect(screen.getByText("Select at least one duplicate paper.")).toBeTruthy();

    await user.click(duplicateChoices[0]);
    await user.click(screen.getByRole("button", { name: "Confirm safe merge" }));

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(mergeResult));
    expect(getFrontendOperationCalls("admin.dataQuality.resolveDuplicateGroup")).toEqual([
      {
        resolution: "merge",
        groupKey: "shared paper title",
        canonicalPaperId: "paper-a",
        duplicatePaperIds: ["paper-b"],
        reason,
      },
    ]);
  });

  test("preserves dialog values after a failed resolution", async () => {
    setFrontendOperationHandler("admin.dataQuality.resolveDuplicateGroup", () => {
      throw new Error("Group membership changed.");
    });
    const { user } = renderWithProviders(
      <DuplicateTitleResolutionActions group={group} onResolved={() => undefined} />,
    );
    const reason = "The papers are distinct because their study populations differ.";

    await user.click(screen.getByRole("button", { name: "Keep both" }));
    await user.type(screen.getByRole("textbox", { name: "Review reason" }), reason);
    await user.click(screen.getByRole("button", { name: "Confirm keep both" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "This duplicate group changed after it was loaded. Refresh the audit and review it again.",
    );
    expect(screen.getByRole("textbox", { name: "Review reason" })).toHaveProperty("value", reason);
  });

  test("renders every returned safe-merge metric in the result notice", () => {
    renderWithProviders(
      <DuplicateResolutionNotice
        groupTitle="Shared paper title"
        onDismiss={() => undefined}
        result={mergeResult}
      />,
    );

    expect(screen.getByText("Safe merge completed")).toBeTruthy();
    const expectedMetrics = new Map([
      ["Sources moved", "3"],
      ["Sources deduplicated", "1"],
      ["Bookmarks moved", "2"],
      ["Bookmarks deduplicated", "1"],
      ["Notes moved", "4"],
      ["Reading progress moved", "1"],
      ["Reading progress deduplicated", "1"],
      ["Papers made inactive", "1"],
    ]);

    for (const [label, value] of expectedMetrics) {
      expect(screen.getByText(label).parentElement?.querySelector("dd")?.textContent).toBe(value);
    }
  });
});
