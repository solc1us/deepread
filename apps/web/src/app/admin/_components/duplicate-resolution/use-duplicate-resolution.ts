"use client";

import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import { invalidateAdminRemediationQueries } from "../admin-remediation-cache";
import type {
	DuplicateResolutionGroup,
	DuplicateResolutionPaper,
	RelationCounts,
	ResolutionDialog,
	ResolutionErrors,
	ResolveDuplicateInput,
	ResolveDuplicateResult,
} from "./duplicate-resolution-types";
import {
	calculateRelationCounts,
	getResolutionError,
	validateReason,
} from "./duplicate-resolution-utils";

type UseDuplicateResolutionOptions = {
	group: DuplicateResolutionGroup;
	onResolved: (result: ResolveDuplicateResult) => void;
};

export type DuplicateResolutionWorkflow = {
	formId: string;
	dialog: ResolutionDialog;
	reason: string;
	canonicalPaperId: string;
	duplicatePaperIds: string[];
	errors: ResolutionErrors;
	isPending: boolean;
	canonicalPaper: DuplicateResolutionPaper | undefined;
	duplicatePapers: DuplicateResolutionPaper[];
	selectedRelations: RelationCounts;
	openDialog: (dialog: Exclude<ResolutionDialog, null>) => void;
	closeDialog: () => void;
	changeReason: (reason: string) => void;
	selectPaperToKeep: (paperId: string) => void;
	setDuplicateSelected: (paperId: string, selected: boolean) => void;
	submitKeepBoth: () => void;
	submitMerge: () => void;
};

export function useDuplicateResolution({
	group,
	onResolved,
}: UseDuplicateResolutionOptions): DuplicateResolutionWorkflow {
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

	const changeReason = (nextReason: string) => {
		setReason(nextReason);
		setErrors((current) => ({ ...current, reason: undefined }));
	};

	const selectPaperToKeep = (paperId: string) => {
		setCanonicalPaperId(paperId);
		setDuplicatePaperIds(
			group.papers
				.filter((paper) => paper.paperId !== paperId)
				.map((paper) => paper.paperId),
		);
		setErrors((current) => ({
			...current,
			canonical: undefined,
			duplicates: undefined,
		}));
	};

	const setDuplicateSelected = (paperId: string, selected: boolean) => {
		setDuplicatePaperIds((current) =>
			selected
				? [...new Set([...current, paperId])]
				: current.filter((currentPaperId) => currentPaperId !== paperId),
		);
		setErrors((current) => ({ ...current, duplicates: undefined }));
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

	return {
		formId,
		dialog,
		reason,
		canonicalPaperId,
		duplicatePaperIds,
		errors,
		isPending: resolution.isPending,
		canonicalPaper,
		duplicatePapers,
		selectedRelations: calculateRelationCounts(duplicatePapers),
		openDialog,
		closeDialog,
		changeReason,
		selectPaperToKeep,
		setDuplicateSelected,
		submitKeepBoth,
		submitMerge,
	};
}
