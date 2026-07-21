import { describe, expect, test } from "bun:test";

import {
  getFrontendOperationCalls,
  setFrontendOperationHandler,
} from "@/test/test-doubles";
import { renderWithProviders, screen, waitFor, within } from "@/test/render";

import { PaperMetadataEditor } from "./paper-metadata-editor";

const initialValues = {
  authors: ["Ada Author", "Ben Scholar"],
  abstract: "Existing abstract",
  publicationYear: 2024,
  sourceUrl: "https://example.com/source",
  pdfUrl: "https://example.com/paper.pdf",
};

describe("paper metadata editor", () => {
  test("renders existing values in a viewport-safe scrollable dialog", async () => {
    setFrontendOperationHandler("admin.papers.updateMetadata", () => ({ paperId: "paper-1" }));
    const manyAuthors = Array.from({ length: 12 }, (_, index) => `Author ${index + 1}`);
    const { user } = renderWithProviders(
      <PaperMetadataEditor
        initialValues={{ ...initialValues, authors: manyAuthors }}
        paperId="paper-1"
        paperTitle="Test paper"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit metadata" }));
    const dialog = screen.getByRole("dialog", { name: "Edit paper metadata" });

    expect(within(dialog).getByLabelText("Author 1")).toHaveProperty("value", "Author 1");
    expect(within(dialog).getByLabelText("Author 12")).toHaveProperty("value", "Author 12");
    expect(within(dialog).getByLabelText("Abstract")).toHaveProperty("value", "Existing abstract");
    expect(within(dialog).getByLabelText("Publication year")).toHaveProperty("value", "2024");
    expect(within(dialog).getByRole("button", { name: "Save metadata" })).toBeTruthy();
    expect(dialog.firstElementChild?.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog.querySelector(".overflow-y-auto")).toBeTruthy();
  });

  test("adds and removes authors and submits normalized changed values", async () => {
    setFrontendOperationHandler("admin.papers.updateMetadata", () => ({ paperId: "paper-1" }));
    const { user } = renderWithProviders(
      <PaperMetadataEditor
        initialValues={initialValues}
        paperId="paper-1"
        paperTitle="Test paper"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit metadata" }));
    const firstAuthor = screen.getByLabelText("Author 1");
    await user.clear(firstAuthor);
    await user.type(firstAuthor, "  Alice Updated  ");
    await user.click(screen.getByRole("button", { name: "Add author" }));
    await user.type(screen.getByLabelText("Author 3"), "  Cara Researcher  ");
    await user.click(screen.getByRole("button", { name: "Remove author 2" }));
    await user.click(screen.getByRole("button", { name: "Save metadata" }));

    await waitFor(() => {
      expect(getFrontendOperationCalls("admin.papers.updateMetadata")).toEqual([
        {
          paperId: "paper-1",
          authors: ["Alice Updated", "Cara Researcher"],
        },
      ]);
    });
    expect(screen.queryByRole("dialog", { name: "Edit paper metadata" })).toBeNull();
  });

  test("shows field validation and does not submit unusable authors", async () => {
    setFrontendOperationHandler("admin.papers.updateMetadata", () => ({ paperId: "paper-1" }));
    const { user } = renderWithProviders(
      <PaperMetadataEditor
        initialValues={{ ...initialValues, authors: ["Ada Author"] }}
        paperId="paper-1"
        paperTitle="Test paper"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit metadata" }));
    await user.clear(screen.getByLabelText("Author 1"));
    await user.click(screen.getByRole("button", { name: "Save metadata" }));

    expect(screen.getByRole("alert").textContent).toContain("Add at least one author.");
    expect(getFrontendOperationCalls("admin.papers.updateMetadata")).toEqual([]);
  });
});
