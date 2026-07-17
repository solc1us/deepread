"use client";

import type { AppRouter } from "@deepread/api/routers/index";
import { Button } from "@deepread/ui/components/button";
import { Label } from "@deepread/ui/components/label";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { CircleOff, FileCheck2, RefreshCw, Send, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import { invalidateAdminRemediationQueries } from "./admin-remediation-cache";
import {
  AdminDialog,
  AdminSpinner,
  AnimatedEllipsis,
  getAdminMutationError,
} from "./admin-remediation-ui";
import {
  AdminStatusBadge,
  adminSelectClassName,
  formatAdminClassificationProvenance,
  formatAdminDifficulty,
  getAdminDifficultyClass,
} from "./admin-ui";
import { PaperMetadataEditor } from "./paper-metadata-editor";
import type { PaperMetadataEditorInitialValues } from "./paper-metadata-editor";

type Difficulty = "beginner_friendly" | "moderate" | "difficult" | "expert";
type ReclassifyResult = inferRouterOutputs<AppRouter>["admin"]["papers"]["reclassify"];
type ManualResult = inferRouterOutputs<AppRouter>["admin"]["papers"]["manualClassifyAndPublish"];
type ActionResult = ReclassifyResult | ManualResult;

const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
  { value: "beginner_friendly", label: "Beginner friendly" },
  { value: "moderate", label: "Moderate" },
  { value: "difficult", label: "Difficult" },
  { value: "expert", label: "Expert" },
];

export function PaperRemediationActions({
  paperId,
  paperTitle,
  status = "needs_review",
  metadataInitialValues,
}: {
  paperId: string;
  paperTitle: string;
  status?: "pending" | "needs_review";
  metadataInitialValues?: PaperMetadataEditorInitialValues;
}) {
  const formId = useId();
  const [dialog, setDialog] = useState<"manual" | "reject" | "inactive" | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [reason, setReason] = useState("");
  const [manualErrors, setManualErrors] = useState<{ difficulty?: string; reason?: string; form?: string }>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const reclassify = useMutation(
    trpc.admin.papers.reclassify.mutationOptions({
      onSuccess: async (result) => {
        setActionError(null);
        setLastResult(result);
        if (result.outcome === "published") {
          toast.success("Published", {
            description: `${formatAdminClassificationProvenance(result.classificationVersion)} · ${formatAdminDifficulty(result.difficulty)}`,
          });
        } else {
          toast.warning("Paper still needs review");
        }
        await invalidateAdminRemediationQueries();
      },
      onError: (error) => {
        setActionError(getAdminMutationError(error, "Paper could not be reclassified.").message);
      },
    }),
  );

  const manualClassify = useMutation(
    trpc.admin.papers.manualClassifyAndPublish.mutationOptions({
      onSuccess: async (result) => {
        setActionError(null);
        setLastResult(result);
        setDialog(null);
        setDifficulty("");
        setReason("");
        setManualErrors({});
        toast.success("Published", {
          description: `${formatAdminClassificationProvenance(result.classificationVersion)} · ${formatAdminDifficulty(result.difficulty)}`,
        });
        await invalidateAdminRemediationQueries();
      },
      onError: (error) => {
        const safeError = getAdminMutationError(error, "Manual classification could not be published.");
        const field = safeError.field === "difficulty" || /difficulty/i.test(safeError.message)
          ? "difficulty"
          : safeError.field === "reason" || /reason/i.test(safeError.message)
            ? "reason"
            : "form";
        setManualErrors({ [field]: safeError.message });
      },
    }),
  );

  const reject = useMutation(
    trpc.admin.papers.reject.mutationOptions({
      onSuccess: async () => {
        setDialog(null);
        toast.success("Paper rejected");
        await invalidateAdminRemediationQueries();
      },
      onError: (error) => {
        const message = getAdminMutationError(error, "Paper could not be rejected.").message;
        setActionError(message);
        toast.error(message);
      },
    }),
  );

  const deactivate = useMutation(
    trpc.admin.papers.deactivate.mutationOptions({
      onSuccess: async () => {
        setDialog(null);
        toast.success("Paper set to inactive");
        await invalidateAdminRemediationQueries();
      },
      onError: (error) => {
        const message = getAdminMutationError(error, "Paper could not be set inactive.").message;
        setActionError(message);
        toast.error(message);
      },
    }),
  );

  const pending = reclassify.isPending || manualClassify.isPending || reject.isPending || deactivate.isPending;

  const submitManualClassification = () => {
    const errors: typeof manualErrors = {};
    const normalizedReason = reason.trim();

    if (!difficulty) errors.difficulty = "Choose a difficulty level.";
    if (!normalizedReason) errors.reason = "Review reason is required.";
    else if (normalizedReason.length < 20) errors.reason = "Review reason must be at least 20 characters.";

    if (Object.keys(errors).length > 0 || !difficulty) {
      setManualErrors(errors);
      return;
    }

    setManualErrors({});
    manualClassify.mutate({ paperId, difficulty, reason: normalizedReason });
  };

  return (
    <div className="grid w-full gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PaperMetadataEditor
          disabled={pending}
          initialValues={metadataInitialValues}
          paperId={paperId}
          paperTitle={paperTitle}
        />
        <Button
          aria-busy={reclassify.isPending}
          disabled={pending}
          onClick={() => {
            setActionError(null);
            reclassify.mutate({ paperId });
          }}
          size="sm"
        >
          {reclassify.isPending ? <><AdminSpinner />Classifying<AnimatedEllipsis /></> : <><RefreshCw aria-hidden="true" />Re-run classifier</>}
        </Button>
        <Button disabled={pending} onClick={() => setDialog("manual")} size="sm" variant="outline">
          <FileCheck2 aria-hidden="true" />Manual classify
        </Button>
        {status === "needs_review" ? (
          <>
            <Button disabled={pending} onClick={() => setDialog("inactive")} size="sm" variant="outline">
              <CircleOff aria-hidden="true" />Set inactive
            </Button>
            <Button disabled={pending} onClick={() => setDialog("reject")} size="sm" variant="destructive">
              <Trash2 aria-hidden="true" />Reject
            </Button>
          </>
        ) : null}
      </div>

      {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
      {lastResult ? <ClassificationResult result={lastResult} /> : null}

      <AdminDialog
        busy={manualClassify.isPending}
        description={`Review “${paperTitle}” and explicitly assign a difficulty. This records manual-admin-v1, not rule-based classifier output.`}
        onClose={() => setDialog(null)}
        open={dialog === "manual"}
        title="Manual classify and publish"
      >
        <form
          aria-busy={manualClassify.isPending}
          className="grid gap-5 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitManualClassification();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-difficulty`}>Difficulty</Label>
            <select
              aria-describedby={manualErrors.difficulty ? `${formId}-difficulty-error` : undefined}
              aria-invalid={Boolean(manualErrors.difficulty)}
              className={adminSelectClassName}
              data-autofocus
              disabled={manualClassify.isPending}
              id={`${formId}-difficulty`}
              onChange={(event) => {
                setDifficulty(event.target.value as Difficulty | "");
                setManualErrors((current) => ({ ...current, difficulty: undefined, form: undefined }));
              }}
              value={difficulty}
            >
              <option value="">Select difficulty</option>
              {difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {manualErrors.difficulty ? <p className="text-xs text-destructive" id={`${formId}-difficulty-error`} role="alert">{manualErrors.difficulty}</p> : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-reason`}>Review reason</Label>
            <textarea
              aria-describedby={manualErrors.reason ? `${formId}-reason-error` : undefined}
              aria-invalid={Boolean(manualErrors.reason)}
              className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
              disabled={manualClassify.isPending}
              id={`${formId}-reason`}
              onChange={(event) => {
                setReason(event.target.value);
                setManualErrors((current) => ({ ...current, reason: undefined, form: undefined }));
              }}
              placeholder="Explain the evidence supporting this manual difficulty decision"
              value={reason}
            />
            {manualErrors.reason ? <p className="text-xs text-destructive" id={`${formId}-reason-error`} role="alert">{manualErrors.reason}</p> : null}
          </div>

          <p className="rounded-md border border-difficulty-difficult-foreground/20 bg-difficulty-difficult px-3 py-2 text-xs leading-5 text-difficulty-difficult-foreground">
            Confirming publishes this paper with a manual admin classification. No rule-based score will be created.
          </p>
          {manualErrors.form ? <p className="text-sm text-destructive" role="alert">{manualErrors.form}</p> : null}

          <footer className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button disabled={manualClassify.isPending} onClick={() => setDialog(null)} type="button" variant="outline">Cancel</Button>
            <Button aria-busy={manualClassify.isPending} disabled={manualClassify.isPending} type="submit">
              {manualClassify.isPending ? <><AdminSpinner />Publishing</> : <><Send aria-hidden="true" />Confirm and publish</>}
            </Button>
          </footer>
        </form>
      </AdminDialog>

      <ConfirmationDialog
        busy={reject.isPending}
        confirmLabel="Reject paper"
        description={`Reject “${paperTitle}”? It will no longer be publicly visible.`}
        destructive
        onClose={() => setDialog(null)}
        onConfirm={() => reject.mutate({ paperId })}
        open={dialog === "reject"}
        title="Reject needs-review paper"
      />
      <ConfirmationDialog
        busy={deactivate.isPending}
        confirmLabel="Set inactive"
        description={`Set “${paperTitle}” inactive? The paper and its relations are retained, but it remains hidden from public access.`}
        onClose={() => setDialog(null)}
        onConfirm={() => deactivate.mutate({ paperId })}
        open={dialog === "inactive"}
        title="Set paper inactive"
      />
    </div>
  );
}

function ClassificationResult({ result }: { result: ActionResult }) {
  const isPublished = result.status === "published";
  const difficulty = "difficulty" in result ? result.difficulty : null;
  const version = "classificationVersion" in result ? result.classificationVersion : null;
  const reviewReasons = "reviewReasons" in result ? result.reviewReasons : [];

  return (
    <section aria-live="polite" className="grid gap-2 rounded-md border border-border/80 bg-muted/25 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge value={result.status} />
        {isPublished ? <span className="font-medium">{formatAdminClassificationProvenance(version)}</span> : <span className="font-medium">Review required</span>}
        {difficulty ? <span className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", getAdminDifficultyClass(difficulty))}>{formatAdminDifficulty(difficulty)}</span> : null}
      </div>
      {isPublished && version ? <p className="text-xs text-muted-foreground">Classification version: {version}</p> : null}
      {!isPublished && reviewReasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
          {reviewReasons.map((reviewReason) => <li key={reviewReason}>{reviewReason}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  busy,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  destructive?: boolean;
}) {
  return (
    <AdminDialog busy={busy} description={description} maxWidthClassName="max-w-lg" onClose={onClose} open={open} title={title}>
      <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
        <Button disabled={busy} onClick={onClose} variant="outline">Cancel</Button>
        <Button aria-busy={busy} data-autofocus disabled={busy} onClick={onConfirm} variant={destructive ? "destructive" : "default"}>
          {busy ? <><AdminSpinner />Updating</> : confirmLabel}
        </Button>
      </div>
    </AdminDialog>
  );
}
