import { AdminStatusBadge } from "../admin-ui";
import type { DuplicateResolutionPaper } from "./duplicate-resolution-types";
import {
	formatAuthors,
	formatProviderId,
} from "./duplicate-resolution-utils";

export function PaperOptionSummary({
	paper,
}: {
	paper: DuplicateResolutionPaper;
}) {
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
