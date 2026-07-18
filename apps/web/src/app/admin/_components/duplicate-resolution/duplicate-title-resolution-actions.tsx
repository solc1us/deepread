"use client";

import { Button } from "@deepread/ui/components/button";
import { GitMerge, Scale } from "lucide-react";

import type {
	DuplicateResolutionGroup,
	ResolveDuplicateResult,
} from "./duplicate-resolution-types";
import { KeepBothDialog } from "./keep-both-dialog";
import { MergeDuplicatesDialog } from "./merge-duplicates-dialog";
import { useDuplicateResolution } from "./use-duplicate-resolution";

export function DuplicateTitleResolutionActions({
	group,
	onResolved,
}: {
	group: DuplicateResolutionGroup;
	onResolved: (result: ResolveDuplicateResult) => void;
}) {
	const workflow = useDuplicateResolution({ group, onResolved });

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
						disabled={workflow.isPending}
						onClick={() => workflow.openDialog("keep_both")}
						size="sm"
						variant="outline"
					>
						<Scale aria-hidden="true" />
						Keep both
					</Button>
					<Button
						disabled={workflow.isPending}
						onClick={() => workflow.openDialog("merge")}
						size="sm"
						variant="destructive"
					>
						<GitMerge aria-hidden="true" />
						Merge duplicates
					</Button>
				</div>
			</div>

			<KeepBothDialog
				errors={workflow.errors}
				formId={workflow.formId}
				group={group}
				isPending={workflow.isPending}
				onClose={workflow.closeDialog}
				onReasonChange={workflow.changeReason}
				onSubmit={workflow.submitKeepBoth}
				open={workflow.dialog === "keep_both"}
				reason={workflow.reason}
			/>

			<MergeDuplicatesDialog
				canonicalPaper={workflow.canonicalPaper}
				canonicalPaperId={workflow.canonicalPaperId}
				duplicatePaperIds={workflow.duplicatePaperIds}
				duplicatePapers={workflow.duplicatePapers}
				errors={workflow.errors}
				formId={workflow.formId}
				group={group}
				isPending={workflow.isPending}
				onClose={workflow.closeDialog}
				onReasonChange={workflow.changeReason}
				onSelectPaperToKeep={workflow.selectPaperToKeep}
				onSetDuplicateSelected={workflow.setDuplicateSelected}
				onSubmit={workflow.submitMerge}
				open={workflow.dialog === "merge"}
				reason={workflow.reason}
				selectedRelations={workflow.selectedRelations}
			/>
		</>
	);
}
