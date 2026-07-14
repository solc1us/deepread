"use client";

import {
	OPENALEX_INGESTION_DEFAULT_LIMIT,
	OPENALEX_INGESTION_MAX_LIMIT,
	OPENALEX_INGESTION_MIN_LIMIT,
} from "@deepread/api/openalex-ingestion-limits";
import { Button } from "@deepread/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@deepread/ui/components/card";
import { Input } from "@deepread/ui/components/input";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, FileCheck2 } from "lucide-react";
import { useState } from "react";

import { queryClient, trpc } from "@/utils/trpc";

import {
	AdminPageHeader,
	adminInputLabelClass,
	adminSelectClassName,
	formatAdminStatus,
	getAdminStatusClass,
} from "./admin-ui";

type IngestionControlResult = {
	provider: "openalex";
	status: "success" | "failed" | "partial";
	totalFetched: number;
	totalSaved: number;
	totalRejected: number;
	skipped: {
		duplicates: number;
		invalid: number;
	};
	errors?: string[];
};

type ClassificationBatchResult = {
	totalFound: number;
	totalClassified: number;
	totalPublished: number;
	totalNeedsReview: number;
	totalRejected: number;
	totalFailed: number;
	errors?: string[];
};

type ValidationIssue = {
	message?: unknown;
	path?: unknown;
};

const genericIngestionError = "OpenAlex ingestion failed. Please try again.";
const ingestionLimitError = `Limit must be between ${OPENALEX_INGESTION_MIN_LIMIT} and ${OPENALEX_INGESTION_MAX_LIMIT}.`;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function toValidationIssues(value: unknown): ValidationIssue[] {
	if (Array.isArray(value)) {
		return value.filter(isRecord);
	}

	if (isRecord(value) && Array.isArray(value.issues)) {
		return value.issues.filter(isRecord);
	}

	return [];
}

function getValidationIssues(error: unknown) {
	if (isRecord(error) && isRecord(error.data) && isRecord(error.data.zodError)) {
		const issues = toValidationIssues(error.data.zodError);
		if (issues.length > 0) {
			return issues;
		}
	}

	const message = error instanceof Error ? error.message : "";

	try {
		return toValidationIssues(JSON.parse(message));
	} catch {
		return [];
	}
}

function getIngestionErrorMessage(error: unknown) {
	const issues = getValidationIssues(error);

	for (const issue of issues) {
		const path = Array.isArray(issue.path) ? issue.path.map(String) : [];

		if (path.includes("limit")) {
			return ingestionLimitError;
		}
		if (path.includes("query")) {
			return "Search query is required.";
		}
		if (path.includes("categoryId")) {
			return "Choose a valid category.";
		}
	}

	const message = error instanceof Error ? error.message : "";
	if (message.includes("Limit must be between")) {
		return ingestionLimitError;
	}
	if (message.includes("Search query is required")) {
		return "Search query is required.";
	}

	return genericIngestionError;
}

function getIngestionResultErrorMessage(message: string) {
	const safeMessagePatterns = [
		/^OpenAlex request failed (?:on|while)/,
		/^Existing-paper checks could not be completed\.$/,
		/^OpenAlex work W\d+ could not be saved\.$/,
		/^OpenAlex ingestion failed unexpectedly\.$/,
	];

	return safeMessagePatterns.some((pattern) => pattern.test(message))
		? message
		: genericIngestionError;
}

function parseIntegerLimit(value: string, min: number, max: number) {
	const normalized = value.trim();

	if (!/^\d+$/.test(normalized)) {
		return null;
	}

	const parsed = Number(normalized);
	return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function AnimatedEllipsis() {
	return (
		<span
			aria-hidden="true"
			className="ingestion-ellipsis inline-flex w-[1.5em] justify-start"
		>
			<span>.</span>
			<span>.</span>
			<span>.</span>
		</span>
	);
}

function Spinner() {
	return (
		<span
			aria-hidden="true"
			className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
		/>
	);
}

export default function PipelineControls() {
	const categories = useQuery(trpc.categories.list.queryOptions());
	const [ingestionCategoryId, setIngestionCategoryId] = useState("");
	const [ingestionQuery, setIngestionQuery] = useState("");
	const [ingestionLimit, setIngestionLimit] = useState(
		String(OPENALEX_INGESTION_DEFAULT_LIMIT),
	);
	const [ingestionResult, setIngestionResult] =
		useState<IngestionControlResult | null>(null);
	const [ingestionError, setIngestionError] = useState<string | null>(null);
	const [classificationCategoryId, setClassificationCategoryId] = useState("");
	const [classificationLimit, setClassificationLimit] = useState("10");
	const [classificationResult, setClassificationResult] =
		useState<ClassificationBatchResult | null>(null);
	const [classificationError, setClassificationError] = useState<string | null>(
		null,
	);
	const invalidateAdminData = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.admin.dashboard.getOverview.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.admin.logs.list.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.admin.papers.list.queryKey(),
			}),
		]);
	};
	const runIngestion = useMutation(
		trpc.admin.ingestion.runOpenAlex.mutationOptions({
			onSuccess: (result) => {
				setIngestionResult(result);
				setIngestionError(null);
				void invalidateAdminData();
			},
			onError: (error) => {
				setIngestionResult(null);
				setIngestionError(getIngestionErrorMessage(error));
			},
		}),
	);
	const runClassificationBatch = useMutation(
		trpc.admin.classification.runBatch.mutationOptions({
			onSuccess: async (result) => {
				setClassificationResult(result);
				setClassificationError(null);
				await invalidateAdminData();
			},
			onError: (error) => {
				setClassificationResult(null);
				setClassificationError(error.message);
			},
		}),
	);

	const handleRunIngestion = () => {
		if (runIngestion.isPending) {
			return;
		}

		const query = ingestionQuery.trim();
		const limit = parseIntegerLimit(
			ingestionLimit,
			OPENALEX_INGESTION_MIN_LIMIT,
			OPENALEX_INGESTION_MAX_LIMIT,
		);

		if (!ingestionCategoryId) {
			setIngestionResult(null);
			setIngestionError("Choose a category before running ingestion.");
			return;
		}
		if (!query) {
			setIngestionResult(null);
			setIngestionError("Search query is required.");
			return;
		}
		if (!limit) {
			setIngestionResult(null);
			setIngestionError(ingestionLimitError);
			return;
		}

		setIngestionResult(null);
		setIngestionError(null);
		runIngestion.mutate({
			categoryId: ingestionCategoryId,
			query,
			limit,
		});
	};

	const handleRunClassificationBatch = () => {
		const limit = parseIntegerLimit(classificationLimit, 1, 50);

		if (!limit) {
			setClassificationResult(null);
			setClassificationError("Limit must be a number between 1 and 50.");
			return;
		}

		setClassificationError(null);
		runClassificationBatch.mutate({
			limit,
			...(classificationCategoryId
				? { categoryId: classificationCategoryId }
				: {}),
		});
	};

	return (
		<main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
			<AdminPageHeader
				description="Manually run OpenAlex ingestion and metadata-only classification. Work runs only when submitted."
				title="Pipeline"
			/>

			<section className="grid gap-5 lg:grid-cols-2">
				<Card className="rounded-lg border-border/80 shadow-sm">
					<CardHeader className="gap-1">
						<CardTitle className="flex items-center gap-2 text-lg">
							<Database className="text-primary" />
							OpenAlex Ingestion
						</CardTitle>
						<p className="text-sm leading-6 text-muted-foreground">
							Fetch, normalize, deduplicate, and save pending papers.
						</p>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid gap-3 md:grid-cols-[1fr_1.4fr_7rem]">
							<label className={adminInputLabelClass}>
								Category
								<select
									className={adminSelectClassName}
									disabled={categories.isLoading || runIngestion.isPending}
									onChange={(event) =>
										setIngestionCategoryId(event.target.value)
									}
									value={ingestionCategoryId}
								>
									<option value="">Select category</option>
									{categories.data?.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>
							</label>
							<label className={adminInputLabelClass}>
								Search query
								<Input
									disabled={runIngestion.isPending}
									onChange={(event) => setIngestionQuery(event.target.value)}
									placeholder="e.g. student learning"
									type="text"
									value={ingestionQuery}
								/>
							</label>
							<label className={adminInputLabelClass}>
								Limit
								<Input
									disabled={runIngestion.isPending}
									max={OPENALEX_INGESTION_MAX_LIMIT}
									min={OPENALEX_INGESTION_MIN_LIMIT}
									onChange={(event) => setIngestionLimit(event.target.value)}
									type="number"
									step={1}
									value={ingestionLimit}
								/>
							</label>
						</div>
						{categories.isError ? (
							<p className="rounded-md bg-destructive/10 p-2 text-xs leading-5 text-destructive">
								Categories could not be loaded. Refresh before running
								ingestion.
							</p>
						) : null}
						{ingestionError ? (
							<p className="rounded-md bg-destructive/10 p-2 text-xs leading-5 text-destructive">
								{ingestionError}
							</p>
						) : null}
						{ingestionResult ? (
							<section className="grid gap-3 border-t pt-4 text-sm">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h3 className="font-medium">Last ingestion result</h3>
									<span
										className={cn(
											"rounded-md px-2.5 py-1 font-medium capitalize",
											getAdminStatusClass(ingestionResult.status),
										)}
									>
										{formatAdminStatus(ingestionResult.status)}
									</span>
								</div>
								<dl className="divide-y divide-border/70 border-y border-border/70">
									{[
										["Fetched", ingestionResult.totalFetched],
										["Saved", ingestionResult.totalSaved],
										["Duplicates", ingestionResult.skipped.duplicates],
										["Invalid", ingestionResult.skipped.invalid],
									].map(([label, value]) => (
										<div className="flex items-center justify-between gap-4 py-2" key={label}>
											<dt className="text-muted-foreground">{label}</dt>
											<dd className="font-medium tabular-nums">{value}</dd>
										</div>
									))}
								</dl>
								{ingestionResult.errors?.length ? (
									<div className="grid gap-1 text-xs leading-5 text-destructive">
										{ingestionResult.errors.map((error) => (
											<span key={error}>{getIngestionResultErrorMessage(error)}</span>
										))}
									</div>
								) : null}
							</section>
						) : null}
						<Button
							aria-busy={runIngestion.isPending}
							aria-live="polite"
							className="min-w-48 disabled:opacity-70"
							disabled={runIngestion.isPending || categories.isLoading}
							onClick={handleRunIngestion}
							type="button"
						>
							{runIngestion.isPending ? (
								<span className="inline-flex items-center gap-1.5">
									<Spinner />
									Running ingestion
									<AnimatedEllipsis />
								</span>
							) : (
								"Run OpenAlex Ingestion"
							)}
						</Button>
						{runIngestion.isPending ? (
							<p
								aria-busy="true"
								aria-live="polite"
								className="text-xs leading-5 text-muted-foreground"
								role="status"
							>
								Fetching and processing OpenAlex papers. Large requests may take a
								moment
								<AnimatedEllipsis />
							</p>
						) : null}
					</CardContent>
				</Card>

				<Card className="rounded-lg border-border/80 shadow-sm">
					<CardHeader className="gap-1">
						<CardTitle className="flex items-center gap-2 text-lg">
							<FileCheck2 className="text-primary" />
							Batch Classification
						</CardTitle>
						<p className="text-sm leading-6 text-muted-foreground">
							Classify pending papers with the existing metadata-only rule-based
							classifier.
						</p>
					</CardHeader>
					<CardContent className="grid gap-4">
						<div className="grid gap-3 md:grid-cols-[1fr_7rem]">
							<label className={adminInputLabelClass}>
								Category filter
								<select
									className={adminSelectClassName}
									disabled={
										categories.isLoading || runClassificationBatch.isPending
									}
									onChange={(event) =>
										setClassificationCategoryId(event.target.value)
									}
									value={classificationCategoryId}
								>
									<option value="">All categories</option>
									{categories.data?.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>
							</label>
							<label className={adminInputLabelClass}>
								Limit
								<Input
									disabled={runClassificationBatch.isPending}
									max={50}
									min={1}
									onChange={(event) =>
										setClassificationLimit(event.target.value)
									}
									type="number"
									value={classificationLimit}
								/>
							</label>
						</div>
						{classificationError ? (
							<p className="rounded-md bg-destructive/10 p-2 text-xs leading-5 text-destructive">
								{classificationError}
							</p>
						) : null}
						{classificationResult ? (
							<div className="grid gap-2 rounded-md border border-border/80 bg-background p-3 text-xs">
								<span className="font-medium">Last classification result</span>
								<div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
									<span>Found {classificationResult.totalFound}</span>
									<span>Classified {classificationResult.totalClassified}</span>
									<span>Published {classificationResult.totalPublished}</span>
									<span>Needs review {classificationResult.totalNeedsReview}</span>
									<span>Rejected {classificationResult.totalRejected}</span>
									<span>Failed {classificationResult.totalFailed}</span>
								</div>
								{classificationResult.errors?.length ? (
									<div className="grid gap-1 text-destructive">
										{classificationResult.errors.slice(0, 3).map((error) => (
											<span key={error}>{error}</span>
										))}
									</div>
								) : null}
							</div>
						) : null}
						<Button
							className="w-fit"
							disabled={runClassificationBatch.isPending}
							onClick={handleRunClassificationBatch}
							type="button"
						>
							{runClassificationBatch.isPending
								? "Classifying..."
								: "Run Batch Classification"}
						</Button>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
