"use client";

import type { AppRouter } from "@deepread/api/routers/index";
import { Button } from "@deepread/ui/components/button";
import { Card, CardContent } from "@deepread/ui/components/card";
import { Label } from "@deepread/ui/components/label";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { CheckCircle2, GitMerge, Scale } from "lucide-react";
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
import { AdminStatusBadge } from "./admin-ui";

type ResolveDuplicateInput =
	inferRouterInputs<AppRouter>["admin"]["dataQuality"]["resolveDuplicateGroup"];
export type ResolveDuplicateResult =
	inferRouterOutputs<AppRouter>["admin"]["dataQuality"]["resolveDuplicateGroup"];

export type DuplicateResolutionPaper = {
	paperId: string;
	title: string;
	authors: string[];
	publicationYear: number | null;
	categoryName: string;
	status: string;
	doi: string | null;
	provider: string | null;
	externalId: string | null;
	bookmarkCount: number;
	noteCount: number;
	readingProgressCount: number;
};

export type DuplicateResolutionGroup = {
	groupKey: string;
	normalizedTitle: string;
	papers: DuplicateResolutionPaper[];
};

const MIN_REASON_LENGTH = 20;
const MAX_REASON_LENGTH = 2000;

type ResolutionDialog = "keep_both" | "merge" | null;
type ResolutionErrors = {
	canonical?: string;
	duplicates?: string;
	reason?: string;
	form?: string;
};

function formatAuthors(authors: string[]) {
	return authors.length > 0 ? authors.join(", ") : "Unknown authors";
}

function formatProviderId(paper: DuplicateResolutionPaper) {
	return paper.provider && paper.externalId
		? `${paper.provider}: ${paper.externalId}`
		: "Not available";
}

function getResolutionError(error: unknown) {
	const safeError = getAdminMutationError(
		error,
		"Duplicate group could not be resolved.",
	);
	const normalized = safeError.message.toLowerCase();

	if (
		normalized.includes("membership changed") ||
		normalized.includes("data changed during resolution") ||
		normalized.includes("papers were not found")
	) {
		return {
			field: "form" as const,
			message:
				"This duplicate group changed after it was loaded. Refresh the audit and review it again.",
		};
	}
	if (normalized.includes("already been resolved")) {
		return {
			field: "form" as const,
			message: "This group has already been resolved.",
		};
	}
	if (
		normalized.includes("canonical paper") ||
		normalized.includes("complete classification")
	) {
		return {
			field: "canonical" as const,
			message: "The selected paper is not eligible to remain published.",
		};
	}
	if (safeError.field === "reason" || normalized.includes("reason")) {
		return { field: "reason" as const, message: safeError.message };
	}

	return { field: "form" as const, message: safeError.message };
}

function validateReason(reason: string) {
	const normalized = reason.trim();

	if (!normalized) {
		return "Review reason is required.";
	}
	if (normalized.length < MIN_REASON_LENGTH) {
		return `Review reason must be at least ${MIN_REASON_LENGTH} characters.`;
	}
	if (normalized.length > MAX_REASON_LENGTH) {
		return `Review reason must be ${MAX_REASON_LENGTH} characters or fewer.`;
	}

	return null;
}

function PaperOptionSummary({ paper }: { paper: DuplicateResolutionPaper }) {
	return (
		<div className="grid min-w-0 gap-2">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="font-medium leading-5">{paper.title}</div>
					<div className="mt-1 text-xs leading-5 text-muted-foreground">
						{formatAuthors(paper.authors)}
					</div>
				</div>
				<AdminStatusBadge value={paper.status} />
			</div>
			<dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
				<div>
					<dt className="inline text-muted-foreground">Year: </dt>
					<dd className="inline">{paper.publicationYear ?? "Unknown"}</dd>
				</div>
				<div>
					<dt className="inline text-muted-foreground">Category: </dt>
					<dd className="inline">{paper.categoryName}</dd>
				</div>
				<div>
					<dt className="inline text-muted-foreground">DOI: </dt>
					<dd className="inline break-all">{paper.doi ?? "Not available"}</dd>
				</div>
				<div>
					<dt className="inline text-muted-foreground">Provider ID: </dt>
					<dd className="inline break-all">{formatProviderId(paper)}</dd>
				</div>
			</dl>
			<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
				<span>{paper.bookmarkCount} bookmarks</span>
				<span>{paper.noteCount} notes</span>
				<span>{paper.readingProgressCount} reading progress</span>
			</div>
		</div>
	);
}

export function DuplicateTitleResolutionActions({
	group,
	onResolved,
}: {
	group: DuplicateResolutionGroup;
	onResolved: (result: ResolveDuplicateResult) => void;
}) {
	const formId = useId();
	const [dialog, setDialog] = useState<ResolutionDialog>(null);
	const [reason, setReason] = useState("");
	const [canonicalPaperId, setCanonicalPaperId] = useState("");
	const [duplicatePaperIds, setDuplicatePaperIds] = useState<string[]>([]);
	const [errors, setErrors] = useState<ResolutionErrors>({});

	const resolution = useMutation(
		trpc.admin.dataQuality.resolveDuplicateGroup.mutationOptions({
			onSuccess: async (result) => {
				onResolved(result);
				setDialog(null);
				setReason("");
				setCanonicalPaperId("");
				setDuplicatePaperIds([]);
				setErrors({});

				if (result.resolution === "keep_both") {
					toast.success("Candidate group reviewed", {
						description: "All papers remain unchanged in the dataset.",
					});
				} else {
					toast.success("Duplicate papers safely merged");
				}

				await invalidateAdminRemediationQueries();
			},
			onError: (error) => {
				const mappedError = getResolutionError(error);
				setErrors((current) => ({
					...current,
					[mappedError.field]: mappedError.message,
				}));
			},
		}),
	);

	const openDialog = (nextDialog: Exclude<ResolutionDialog, null>) => {
		if (resolution.isPending) {
			return;
		}

		setDialog(nextDialog);
		setReason("");
		setCanonicalPaperId("");
		setDuplicatePaperIds([]);
		setErrors({});
	};

	const closeDialog = () => {
		if (!resolution.isPending) {
			setDialog(null);
			setErrors({});
		}
	};

	const submitKeepBoth = () => {
		if (resolution.isPending) {
			return;
		}

		const reasonError = validateReason(reason);
		if (reasonError) {
			setErrors({ reason: reasonError });
			return;
		}

		setErrors({});
		const input: ResolveDuplicateInput = {
			resolution: "keep_both",
			groupKey: group.groupKey,
			paperIds: group.papers.map((paper) => paper.paperId),
			reason: reason.trim(),
		};
		resolution.mutate(input);
	};

	const submitMerge = () => {
		if (resolution.isPending) {
			return;
		}

		const nextErrors: ResolutionErrors = {};
		const reasonError = validateReason(reason);
		const selectedDuplicateIds = duplicatePaperIds.filter(
			(paperId) => paperId !== canonicalPaperId,
		);

		if (!canonicalPaperId) {
			nextErrors.canonical = "Select one paper to keep.";
		}
		if (selectedDuplicateIds.length === 0) {
			nextErrors.duplicates = "Select at least one duplicate paper.";
		}
		if (reasonError) {
			nextErrors.reason = reasonError;
		}
		if (Object.keys(nextErrors).length > 0 || !canonicalPaperId) {
			setErrors(nextErrors);
			return;
		}

		setErrors({});
		const input: ResolveDuplicateInput = {
			resolution: "merge",
			groupKey: group.groupKey,
			canonicalPaperId,
			duplicatePaperIds: selectedDuplicateIds,
			reason: reason.trim(),
		};
		resolution.mutate(input);
	};

	const canonicalPaper = group.papers.find(
		(paper) => paper.paperId === canonicalPaperId,
	);
	const duplicatePapers = group.papers.filter((paper) =>
		duplicatePaperIds.includes(paper.paperId),
	);
	const selectedRelations = duplicatePapers.reduce(
		(totals, paper) => ({
			bookmarks: totals.bookmarks + paper.bookmarkCount,
			notes: totals.notes + paper.noteCount,
			progress: totals.progress + paper.readingProgressCount,
		}),
		{ bookmarks: 0, notes: 0, progress: 0 },
	);

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-muted/20 px-4 py-3">
				<div>
					<div className="text-sm font-medium">Resolve candidate group</div>
					<p className="mt-0.5 text-xs text-muted-foreground">
						Record a review decision or safely merge confirmed duplicates.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={resolution.isPending}
						onClick={() => openDialog("keep_both")}
						size="sm"
						variant="outline"
					>
						<Scale aria-hidden="true" />
						Keep both
					</Button>
					<Button
						disabled={resolution.isPending}
						onClick={() => openDialog("merge")}
						size="sm"
						variant="destructive"
					>
						<GitMerge aria-hidden="true" />
						Merge duplicates
					</Button>
				</div>
			</div>

			<AdminDialog
				busy={resolution.isPending}
				contentClassName="overflow-hidden"
				description="Confirm that these papers are distinct records and should remain in the dataset."
				onClose={closeDialog}
				open={dialog === "keep_both"}
				title="Keep both papers"
			>
				<form
					aria-busy={resolution.isPending}
					className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"
					onSubmit={(event) => {
						event.preventDefault();
						submitKeepBoth();
					}}
				>
					<div className="min-h-0 overflow-y-auto px-5 py-4">
						<div className="grid gap-5">
							<div className="rounded-md border border-border/80 bg-muted/20 p-3">
								<div className="text-sm font-medium">
									{group.papers[0]?.title ?? group.normalizedTitle}
								</div>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{group.papers.length} papers will remain unchanged. No status,
									metadata, classification, source, or user relation will be
									modified.
								</p>
							</div>
							{errors.form ? (
								<p className="text-sm text-destructive" role="alert">
									{errors.form}
								</p>
							) : null}
							<div className="grid gap-1.5">
								<Label htmlFor={`${formId}-keep-reason`}>Review reason</Label>
								<textarea
									aria-describedby={
										errors.reason ? `${formId}-keep-reason-error` : undefined
									}
									aria-invalid={Boolean(errors.reason)}
									className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
									disabled={resolution.isPending}
									id={`${formId}-keep-reason`}
									maxLength={MAX_REASON_LENGTH}
									onChange={(event) => {
										setReason(event.target.value);
										setErrors((current) => ({ ...current, reason: undefined }));
									}}
									placeholder="Explain why these papers are distinct records"
									value={reason}
								/>
								{errors.reason ? (
									<p
										className="text-xs text-destructive"
										id={`${formId}-keep-reason-error`}
										role="alert"
									>
										{errors.reason}
									</p>
								) : null}
							</div>
						</div>
					</div>
					<footer className="flex flex-wrap justify-end gap-2 border-t border-border/80 bg-card px-5 py-4">
						<Button
							disabled={resolution.isPending}
							onClick={closeDialog}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							aria-busy={resolution.isPending}
							disabled={resolution.isPending}
							type="submit"
						>
							{resolution.isPending ? (
								<>
									<AdminSpinner />
									Recording decision
									<AnimatedEllipsis />
								</>
							) : (
								<>
									<CheckCircle2 aria-hidden="true" />
									Confirm keep both
								</>
							)}
						</Button>
					</footer>
				</form>
			</AdminDialog>

			<AdminDialog
				busy={resolution.isPending}
				contentClassName="overflow-hidden"
				description="The selected paper will be retained. Selected duplicate papers will become inactive after user relations and unique sources are safely moved or deduplicated."
				maxWidthClassName="max-w-4xl"
				onClose={closeDialog}
				open={dialog === "merge"}
				title="Merge duplicate papers"
			>
				<form
					aria-busy={resolution.isPending}
					className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"
					onSubmit={(event) => {
						event.preventDefault();
						submitMerge();
					}}
				>
					<div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
						<div className="grid gap-6">
							{errors.form ? (
								<p className="text-sm text-destructive" role="alert">
									{errors.form}
								</p>
							) : null}
							<fieldset className="grid gap-3" disabled={resolution.isPending}>
								<legend className="text-sm font-semibold">
									1. Select a paper to keep
								</legend>
								<p className="text-xs leading-5 text-muted-foreground">
									Exactly one paper will retain its current ID, metadata,
									classification, and status.
								</p>
								<div className="grid gap-3 lg:grid-cols-2">
									{group.papers.map((paper) => {
										const inputId = `${formId}-canonical-${paper.paperId}`;
										return (
											<label
												className="cursor-pointer"
												htmlFor={inputId}
												key={paper.paperId}
											>
												<input
													checked={canonicalPaperId === paper.paperId}
													className="peer sr-only"
													id={inputId}
													name={`${formId}-canonical`}
													onChange={() => {
														setCanonicalPaperId(paper.paperId);
														setDuplicatePaperIds(
															group.papers
																.filter(
																	(candidate) =>
																		candidate.paperId !== paper.paperId,
																)
																.map((candidate) => candidate.paperId),
														);
														setErrors((current) => ({
															...current,
															canonical: undefined,
															duplicates: undefined,
														}));
													}}
													type="radio"
													value={paper.paperId}
												/>
												<div className="h-full rounded-md border border-border/80 bg-background p-3 transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
													<PaperOptionSummary paper={paper} />
												</div>
											</label>
										);
									})}
								</div>
								{errors.canonical ? (
									<p className="text-xs text-destructive" role="alert">
										{errors.canonical}
									</p>
								) : null}
							</fieldset>

							<fieldset
								className="grid gap-3"
								disabled={resolution.isPending || !canonicalPaperId}
							>
								<legend className="text-sm font-semibold">
									2. Select duplicate papers
								</legend>
								<p className="text-xs leading-5 text-muted-foreground">
									Duplicate papers are selected by default. Groups with more
									than two papers may leave candidates unselected for later
									review.
								</p>
								{canonicalPaperId ? (
									<div className="grid gap-2">
										{group.papers
											.filter((paper) => paper.paperId !== canonicalPaperId)
											.map((paper) => {
												const checkboxId = `${formId}-duplicate-${paper.paperId}`;
												const checked = duplicatePaperIds.includes(
													paper.paperId,
												);
												const selectionLocked = group.papers.length === 2;

												return (
													<label
														className={cn(
															"grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md border border-border/80 p-3",
															checked && "border-primary/60 bg-primary/5",
															selectionLocked && "cursor-default",
														)}
														htmlFor={checkboxId}
														key={paper.paperId}
													>
														<input
															checked={checked}
															className="mt-0.5 size-4 accent-primary"
															disabled={selectionLocked || resolution.isPending}
															id={checkboxId}
															onChange={(event) => {
																setDuplicatePaperIds((current) =>
																	event.target.checked
																		? [...new Set([...current, paper.paperId])]
																		: current.filter(
																				(paperId) => paperId !== paper.paperId,
																			),
																);
																setErrors((current) => ({
																	...current,
																	duplicates: undefined,
																}));
															}}
															type="checkbox"
														/>
														<PaperOptionSummary paper={paper} />
													</label>
												);
											})}
									</div>
								) : (
									<p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
										Select a paper to keep first.
									</p>
								)}
								{errors.duplicates ? (
									<p className="text-xs text-destructive" role="alert">
										{errors.duplicates}
									</p>
								) : null}
							</fieldset>

							<div className="grid gap-1.5">
								<Label htmlFor={`${formId}-merge-reason`}>Review reason</Label>
								<textarea
									aria-describedby={
										errors.reason ? `${formId}-merge-reason-error` : undefined
									}
									aria-invalid={Boolean(errors.reason)}
									className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
									disabled={resolution.isPending}
									id={`${formId}-merge-reason`}
									maxLength={MAX_REASON_LENGTH}
									onChange={(event) => {
										setReason(event.target.value);
										setErrors((current) => ({ ...current, reason: undefined }));
									}}
									placeholder="Explain why the selected papers are confirmed duplicates"
									value={reason}
								/>
								{errors.reason ? (
									<p
										className="text-xs text-destructive"
										id={`${formId}-merge-reason-error`}
										role="alert"
									>
										{errors.reason}
									</p>
								) : null}
							</div>

							<section
								aria-label="Merge confirmation summary"
								className="grid gap-3 rounded-md border border-border/80 bg-muted/20 p-4"
							>
								<h3 className="text-sm font-semibold">Confirmation summary</h3>
								<dl className="grid gap-3 text-sm sm:grid-cols-2">
									<div>
										<dt className="text-xs text-muted-foreground">
											Canonical paper
										</dt>
										<dd className="mt-1 font-medium">
											{canonicalPaper?.title ?? "Not selected"}
										</dd>
									</div>
									<div>
										<dt className="text-xs text-muted-foreground">
											Expected duplicate-paper status
										</dt>
										<dd className="mt-1 font-medium">Inactive</dd>
									</div>
									<div className="sm:col-span-2">
										<dt className="text-xs text-muted-foreground">
											Duplicate papers
										</dt>
										<dd className="mt-1">
											{duplicatePapers.length > 0
												? duplicatePapers.map((paper) => paper.title).join("; ")
												: "None selected"}
										</dd>
									</div>
									<div className="sm:col-span-2">
										<dt className="text-xs text-muted-foreground">
											Relations currently attached to selected duplicates
										</dt>
										<dd className="mt-1 text-muted-foreground">
											{selectedRelations.bookmarks} bookmarks,{" "}
											{selectedRelations.notes} notes,{" "}
											{selectedRelations.progress} reading progress
										</dd>
									</div>
								</dl>
							</section>
						</div>
					</div>
					<footer className="flex flex-wrap justify-end gap-2 border-t border-border/80 bg-card px-5 py-4">
						<Button
							disabled={resolution.isPending}
							onClick={closeDialog}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							aria-busy={resolution.isPending}
							disabled={resolution.isPending}
							type="submit"
							variant="destructive"
						>
							{resolution.isPending ? (
								<>
									<AdminSpinner />
									Merging safely
									<AnimatedEllipsis />
								</>
							) : (
								<>
									<GitMerge aria-hidden="true" />
									Confirm safe merge
								</>
							)}
						</Button>
					</footer>
				</form>
			</AdminDialog>
		</>
	);
}

export function DuplicateResolutionNotice({
	groupTitle,
	result,
	onDismiss,
}: {
	groupTitle: string;
	result: ResolveDuplicateResult;
	onDismiss: () => void;
}) {
	return (
		<Card className="rounded-lg border-primary/30 bg-primary/5 shadow-sm">
			<CardContent className="grid gap-4 py-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<CheckCircle2
							aria-hidden="true"
							className="mt-0.5 size-5 text-primary"
						/>
						<div>
							<div className="text-sm font-semibold">
								{result.resolution === "keep_both"
									? "Candidate group kept"
									: "Safe merge completed"}
							</div>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{groupTitle}
							</p>
						</div>
					</div>
					<Button onClick={onDismiss} size="sm" variant="ghost">
						Dismiss
					</Button>
				</div>

				{result.resolution === "keep_both" ? (
					<p className="text-sm text-muted-foreground">
						All records remain unchanged and this exact candidate group is
						marked reviewed.
					</p>
				) : (
					<dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
						<ResultMetric label="Sources moved" value={result.moved.sources} />
						<ResultMetric
							label="Sources deduplicated"
							value={result.deduplicated.sources}
						/>
						<ResultMetric
							label="Bookmarks moved"
							value={result.moved.bookmarks}
						/>
						<ResultMetric
							label="Bookmarks deduplicated"
							value={result.deduplicated.bookmarks}
						/>
						<ResultMetric label="Notes moved" value={result.moved.notes} />
						<ResultMetric
							label="Reading progress moved"
							value={result.moved.readingProgress}
						/>
						<ResultMetric
							label="Reading progress deduplicated"
							value={result.deduplicated.readingProgress}
						/>
						<ResultMetric
							label="Papers made inactive"
							value={result.inactivePapers}
						/>
					</dl>
				)}
			</CardContent>
		</Card>
	);
}

function ResultMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="font-semibold tabular-nums">{value}</dd>
		</div>
	);
}
