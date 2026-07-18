"use client";

import { Button } from "@deepread/ui/components/button";
import { Label } from "@deepread/ui/components/label";
import { CheckCircle2 } from "lucide-react";

import {
	AdminDialog,
	AdminSpinner,
	AnimatedEllipsis,
} from "../admin-remediation-ui";
import type {
	DuplicateResolutionGroup,
	ResolutionErrors,
} from "./duplicate-resolution-types";
import { MAX_REASON_LENGTH } from "./duplicate-resolution-utils";

type KeepBothDialogProps = {
	group: DuplicateResolutionGroup;
	formId: string;
	open: boolean;
	reason: string;
	errors: ResolutionErrors;
	isPending: boolean;
	onReasonChange: (reason: string) => void;
	onClose: () => void;
	onSubmit: () => void;
};

export function KeepBothDialog({
	group,
	formId,
	open,
	reason,
	errors,
	isPending,
	onReasonChange,
	onClose,
	onSubmit,
}: KeepBothDialogProps) {
	const reasonId = `${formId}-keep-reason`;

	return (
		<AdminDialog
			busy={isPending}
			contentClassName="overflow-hidden"
			description="Confirm that these papers are distinct records and should remain in the dataset."
			onClose={onClose}
			open={open}
			title="Keep both papers"
		>
			<form
				aria-busy={isPending}
				className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
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
							<Label htmlFor={reasonId}>Review reason</Label>
							<textarea
								aria-describedby={errors.reason ? `${reasonId}-error` : undefined}
								aria-invalid={Boolean(errors.reason)}
								className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
								disabled={isPending}
								id={reasonId}
								maxLength={MAX_REASON_LENGTH}
								onChange={(event) => onReasonChange(event.target.value)}
								placeholder="Explain why these papers are distinct records"
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
					<Button aria-busy={isPending} disabled={isPending} type="submit">
						{isPending ? (
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
	);
}
