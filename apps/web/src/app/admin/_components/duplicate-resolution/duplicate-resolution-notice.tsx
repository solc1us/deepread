"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent } from "@deepread/ui/components/card";
import { CheckCircle2 } from "lucide-react";

import type { ResolveDuplicateResult } from "./duplicate-resolution-types";

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

export function ResultMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="font-semibold tabular-nums">{value}</dd>
		</div>
	);
}
