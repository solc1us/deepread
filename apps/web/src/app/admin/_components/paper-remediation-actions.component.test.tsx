import { describe, expect, spyOn, test } from "bun:test";

import {
  getFrontendOperationCalls,
  queryClient,
  setFrontendOperationHandler,
} from "@/test/test-doubles";
import { renderWithProviders, screen, waitFor, within } from "@/test/render";

import { PaperRemediationActions } from "./paper-remediation-actions";

function renderActions() {
  return renderWithProviders(
    <PaperRemediationActions
      metadataInitialValues={{ authors: ["Ada Author"], abstract: "Paper abstract" }}
      paperId="paper-review"
      paperTitle="Review candidate"
      status="needs_review"
    />,
  );
}

describe("needs-review remediation", () => {
  test("shows a bounded loading state, publishes after reclassification, and invalidates admin data", async () => {
    let resolveReclassification: ((result: Record<string, unknown>) => void) | undefined;
    setFrontendOperationHandler(
      "admin.papers.reclassify",
      () => new Promise((resolve) => {
        resolveReclassification = resolve;
      }),
    );
    const invalidate = spyOn(queryClient, "invalidateQueries");
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Re-run classifier" }));
    expect(screen.getByRole("button", { name: /Classifying/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Manual classify" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Reject" })).toHaveProperty("disabled", true);

    resolveReclassification?.({
      outcome: "published",
      paperId: "paper-review",
      status: "published",
      classificationVersion: "rule-based-v2.1.4",
      difficulty: "moderate",
      reviewReasons: [],
    });

    await screen.findByText("Rule-based classification");
    expect(screen.getByText("Classification version: rule-based-v2.1.4")).toBeTruthy();
    expect(getFrontendOperationCalls("admin.papers.reclassify")).toEqual([
      { paperId: "paper-review" },
    ]);
    await waitFor(() => expect(invalidate.mock.calls.length).toBe(7));
    invalidate.mockRestore();
  });

  test("validates and submits an explicit manual-admin classification", async () => {
    setFrontendOperationHandler("admin.papers.manualClassifyAndPublish", (input) => ({
      paperId: "paper-review",
      status: "published",
      difficulty: input?.difficulty,
      classificationVersion: "manual-admin-v1",
    }));
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Manual classify" }));
    await user.click(screen.getByRole("button", { name: "Confirm and publish" }));
    expect(screen.getByText("Choose a difficulty level.")).toBeTruthy();
    expect(screen.getByText("Review reason is required.")).toBeTruthy();

    await user.selectOptions(screen.getByRole("combobox", { name: "Difficulty" }), "difficult");
    await user.type(screen.getByRole("textbox", { name: "Review reason" }), "too short");
    await user.click(screen.getByRole("button", { name: "Confirm and publish" }));
    expect(screen.getByText("Review reason must be at least 20 characters.")).toBeTruthy();

    const reason = "Manual review confirms advanced prerequisite knowledge.";
    await user.clear(screen.getByRole("textbox", { name: "Review reason" }));
    await user.type(screen.getByRole("textbox", { name: "Review reason" }), reason);
    await user.click(screen.getByRole("button", { name: "Confirm and publish" }));

    await screen.findByText("Manual admin classification");
    expect(getFrontendOperationCalls("admin.papers.manualClassifyAndPublish")).toEqual([
      {
        paperId: "paper-review",
        difficulty: "difficult",
        reason,
      },
    ]);
    expect(screen.getByText("Classification version: manual-admin-v1")).toBeTruthy();
  });

  test("requires confirmations for reject and inactive actions", async () => {
    setFrontendOperationHandler("admin.papers.reject", () => ({ status: "rejected" }));
    setFrontendOperationHandler("admin.papers.deactivate", () => ({ status: "inactive" }));
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("dialog", { name: "Reject needs-review paper" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reject paper" }));
    await waitFor(() => {
      expect(getFrontendOperationCalls("admin.papers.reject")).toEqual([
        { paperId: "paper-review" },
      ]);
    });

    await user.click(screen.getByRole("button", { name: "Set inactive" }));
    const inactiveDialog = screen.getByRole("dialog", { name: "Set paper inactive" });
    expect(inactiveDialog).toBeTruthy();
    await user.click(within(inactiveDialog).getByRole("button", { name: "Set inactive" }));
    await waitFor(() => {
      expect(getFrontendOperationCalls("admin.papers.deactivate")).toEqual([
        { paperId: "paper-review" },
      ]);
    });
  });

  test("shows a concise reclassification error and keeps actions available", async () => {
    setFrontendOperationHandler("admin.papers.reclassify", () => {
      throw new Error("Paper metadata is incomplete.");
    });
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Re-run classifier" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Paper metadata is incomplete.",
    );
    expect(screen.getByRole("button", { name: "Re-run classifier" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
