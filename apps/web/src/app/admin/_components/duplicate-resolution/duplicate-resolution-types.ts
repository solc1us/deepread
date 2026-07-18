import type { AppRouter } from "@deepread/api/routers/index";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type ResolveDuplicateInput =
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

export type ResolutionDialog = "keep_both" | "merge" | null;

export type ResolutionErrors = {
	canonical?: string;
	duplicates?: string;
	reason?: string;
	form?: string;
};

export type ResolutionErrorField = keyof ResolutionErrors;

export type RelationCounts = {
	bookmarks: number;
	notes: number;
	progress: number;
};
