"use client";

import { Button } from "@deepread/ui/components/button";
import { Label } from "@deepread/ui/components/label";
import { cn } from "@deepread/ui/lib/utils";
import { GitMerge } from "lucide-react";

import {
	AdminDialog,
	AdminSpinner,
	AnimatedEllipsis,
} from "../admin-remediation-ui";
import type {
	DuplicateResolutionGroup,
	DuplicateResolutionPaper,
	RelationCounts,
	ResolutionErrors,
} from "./duplicate-resolution-types";
import { MAX_REASON_LENGTH } from "./duplicate-resolution-utils";
import { MergeConfirmationSummary } from "./merge-confirmation-summary";
import { PaperOptionSummary } from "./paper-option-summary";

type MergeDuplicatesDialogProps = {
	group: DuplicateResolutionGroup;
	formId: string;
	open: boolean;
	reason: string;
	canonicalPaperId: string;
	duplicatePaperIds: string[];
	errors: ResolutionErrors;
	isPending: boolean;
	canonicalPaper: DuplicateResolutionPaper | undefined;
	duplicatePapers: DuplicateResolutionPaper[];
	selectedRelations: RelationCounts;
	onReasonChange: (reason: string) => void;
	onSelectPaperToKeep: (paperId: string) => void;
	onSetDuplicateSelected: (paperId: string, selected: boolean) => void;
	onClose: () => void;
	onSubmit: () => void;
};

export function MergeDuplicatesDialog({
	group,
	formId,
	open,
	reason,
	canonicalPaperId,
	duplicatePaperIds,
	errors,
	isPending,
	canonicalPaper,
	duplicatePapers,
	selectedRelations,
	onReasonChange,
	onSelectPaperToKeep,
	onSetDuplicateSelected,
	onClose,
	onSubmit,
}: MergeDuplicatesDialogProps) {
	const reasonId = `${formId}-merge-reason`;

	return (
		<AdminDialog
			busy={isPending}
			contentClassName="overflow-hidden"
			description="The selected paper will be retained. Selected duplicate papers will become inactive after user relations and unique sources are safely moved or deduplicated."
			maxWidthClassName="max-w-4xl"
			onClose={onClose}
			open={open}
			title="Merge duplicate papers"
		>
			<form
				aria-busy={isPending}
				className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}
			>
				<div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
					<div className="grid gap-6">
						{errors.form ? (
							<p className="text-sm text-destructive" role="alert">
								{errors.form}
							</p>
						) : null}
						<fieldset className="grid gap-3" disabled={isPending}>
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
												onChange={() => onSelectPaperToKeep(paper.paperId)}
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
							disabled={isPending || !canonicalPaperId}
						>
							<legend className="text-sm font-semibold">
								2. Select duplicate papers
							</legend>
							<p className="text-xs leading-5 text-muted-foreground">
								Duplicate papers are selected by default. Groups with more than
								two papers may leave candidates unselected for later review.
							</p>
							{canonicalPaperId ? (
								<div className="grid gap-2">
									{group.papers
										.filter((paper) => paper.paperId !== canonicalPaperId)
										.map((paper) => {
											const checkboxId = `${formId}-duplicate-${paper.paperId}`;
											const checked = duplicatePaperIds.includes(paper.paperId);
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
														disabled={selectionLocked || isPending}
														id={checkboxId}
														onChange={(event) =>
															onSetDuplicateSelected(
																paper.paperId,
																event.target.checked,
															)
														}
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
							<Label htmlFor={reasonId}>Review reason</Label>
							<textarea
								aria-describedby={errors.reason ? `${reasonId}-error` : undefined}
								aria-invalid={Boolean(errors.reason)}
								className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
								disabled={isPending}
								id={reasonId}
								maxLength={MAX_REASON_LENGTH}
								onChange={(event) => onReasonChange(event.target.value)}
								placeholder="Explain why the selected papers are confirmed duplicates"
								value={reason}
							/>
							{errors.reason ? (
								<p
									className="text-xs text-destructive"
									id={`${reasonId}-error`}
									role="alert"
								>
									{errors.reason}
								</p>
							) : null}
						</div>

						<MergeConfirmationSummary
							duplicatePapers={duplicatePapers}
							paperToKeep={canonicalPaper}
							selectedRelations={selectedRelations}
						/>
					</div>
				</div>
				<footer className="flex flex-wrap justify-end gap-2 border-t border-border/80 bg-card px-5 py-4">
					<Button
						disabled={isPending}
						onClick={onClose}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						aria-busy={isPending}
						disabled={isPending}
						type="submit"
						variant="destructive"
					>
						{isPending ? (
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
	);
}
