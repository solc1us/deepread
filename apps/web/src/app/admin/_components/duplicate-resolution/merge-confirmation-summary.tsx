import type {
	DuplicateResolutionPaper,
	RelationCounts,
} from "./duplicate-resolution-types";

export function MergeConfirmationSummary({
	paperToKeep,
	duplicatePapers,
	selectedRelations,
}: {
	paperToKeep: DuplicateResolutionPaper | undefined;
	duplicatePapers: DuplicateResolutionPaper[];
	selectedRelations: RelationCounts;
}) {
	return (
		<section
			aria-label="Merge confirmation summary"
			className="grid gap-3 rounded-md border border-border/80 bg-muted/20 p-4"
		>
			<h3 className="text-sm font-semibold">Confirmation summary</h3>
			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-xs text-muted-foreground">Paper to keep</dt>
					<dd className="mt-1 font-medium">
						{paperToKeep?.title ?? "Not selected"}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-muted-foreground">
						Expected duplicate-paper status
					</dt>
					<dd className="mt-1 font-medium">Inactive</dd>
				</div>
				<div className="sm:col-span-2">
					<dt className="text-xs text-muted-foreground">Duplicate papers</dt>
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
						{selectedRelations.bookmarks} bookmarks, {selectedRelations.notes}{" "}
						notes, {selectedRelations.progress} reading progress
					</dd>
				</div>
			</dl>
		</section>
	);
}
