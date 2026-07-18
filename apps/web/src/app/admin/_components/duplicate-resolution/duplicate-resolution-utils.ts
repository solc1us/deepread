import { getAdminMutationError } from "../admin-remediation-ui";
import type {
	DuplicateResolutionPaper,
	RelationCounts,
	ResolutionErrorField,
} from "./duplicate-resolution-types";

export const MIN_REASON_LENGTH = 20;
export const MAX_REASON_LENGTH = 2000;

export function formatAuthors(authors: string[]) {
	return authors.length > 0 ? authors.join(", ") : "Unknown authors";
}

export function formatProviderId(paper: DuplicateResolutionPaper) {
	return paper.provider && paper.externalId
		? `${paper.provider}: ${paper.externalId}`
		: "Not available";
}

export function validateReason(reason: string) {
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

export function getResolutionError(error: unknown): {
	field: ResolutionErrorField;
	message: string;
} {
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
			field: "form",
			message:
				"This duplicate group changed after it was loaded. Refresh the audit and review it again.",
		};
	}
	if (normalized.includes("already been resolved")) {
		return {
			field: "form",
			message: "This group has already been resolved.",
		};
	}
	if (
		normalized.includes("canonical paper") ||
		normalized.includes("complete classification")
	) {
		return {
			field: "canonical",
			message: "The selected paper is not eligible to remain published.",
		};
	}
	if (safeError.field === "reason" || normalized.includes("reason")) {
		return { field: "reason", message: safeError.message };
	}

	return { field: "form", message: safeError.message };
}

export function calculateRelationCounts(
	papers: DuplicateResolutionPaper[],
): RelationCounts {
	return papers.reduce<RelationCounts>(
		(totals, paper) => ({
			bookmarks: totals.bookmarks + paper.bookmarkCount,
			notes: totals.notes + paper.noteCount,
			progress: totals.progress + paper.readingProgressCount,
		}),
		{ bookmarks: 0, notes: 0, progress: 0 },
	);
}
