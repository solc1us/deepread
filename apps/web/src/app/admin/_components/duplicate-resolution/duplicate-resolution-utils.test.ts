/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import type { DuplicateResolutionPaper } from "./duplicate-resolution-types";
import {
	MAX_REASON_LENGTH,
	MIN_REASON_LENGTH,
	calculateRelationCounts,
	getResolutionError,
	validateReason,
} from "./duplicate-resolution-utils";

function createPaper(
	overrides: Partial<DuplicateResolutionPaper> = {},
): DuplicateResolutionPaper {
	return {
		paperId: "paper-1",
		title: "Paper title",
		authors: ["Author One"],
		publicationYear: 2026,
		categoryName: "Education",
		status: "published",
		doi: null,
		provider: null,
		externalId: null,
		bookmarkCount: 0,
		noteCount: 0,
		readingProgressCount: 0,
		...overrides,
	};
}

describe("validateReason", () => {
	test("rejects blank and short reasons", () => {
		expect(validateReason("   ")).toBe("Review reason is required.");
		expect(validateReason("x".repeat(MIN_REASON_LENGTH - 1))).toBe(
			`Review reason must be at least ${MIN_REASON_LENGTH} characters.`,
		);
	});

	test("accepts trimmed reasons within the backend limits", () => {
		expect(validateReason(`  ${"x".repeat(MIN_REASON_LENGTH)}  `)).toBeNull();
		expect(validateReason("x".repeat(MAX_REASON_LENGTH))).toBeNull();
	});

	test("rejects reasons above the maximum length", () => {
		expect(validateReason("x".repeat(MAX_REASON_LENGTH + 1))).toBe(
			`Review reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
		);
	});
});

describe("getResolutionError", () => {
	test("maps stale and already-resolved groups to concise form errors", () => {
		expect(getResolutionError(new Error("Group membership changed"))).toEqual({
			field: "form",
			message:
				"This duplicate group changed after it was loaded. Refresh the audit and review it again.",
		});
		expect(getResolutionError(new Error("Group has already been resolved"))).toEqual(
			{
				field: "form",
				message: "This group has already been resolved.",
			},
		);
	});

	test("maps paper-to-keep and reason failures to their fields", () => {
		expect(
			getResolutionError(
				new Error("Canonical paper needs a complete classification"),
			),
		).toEqual({
			field: "canonical",
			message: "The selected paper is not eligible to remain published.",
		});
		expect(getResolutionError(new Error("Review reason is too short"))).toEqual({
			field: "reason",
			message: "Review reason is too short",
		});
	});
});

describe("calculateRelationCounts", () => {
	test("adds selected-paper relation counts deterministically", () => {
		const counts = calculateRelationCounts([
			createPaper({
				bookmarkCount: 2,
				noteCount: 3,
				readingProgressCount: 1,
			}),
			createPaper({
				paperId: "paper-2",
				bookmarkCount: 4,
				noteCount: 1,
				readingProgressCount: 2,
			}),
		]);

		expect(counts).toEqual({ bookmarks: 6, notes: 4, progress: 3 });
		expect(calculateRelationCounts([])).toEqual({
			bookmarks: 0,
			notes: 0,
			progress: 0,
		});
	});
});
