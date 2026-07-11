"use client";

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
	totalRejected: number;
	totalFailed: number;
	errors?: string[];
};

function parseLimit(value: string) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 50
		? parsed
		: null;
}

export default function PipelineControls() {
	const categories = useQuery(trpc.categories.list.queryOptions());
	const queryPresets = useQuery(
		trpc.admin.ingestion.getQueryPresets.queryOptions(),
	);
	const [ingestionCategoryId, setIngestionCategoryId] = useState("");
	const [ingestionPresetQuery, setIngestionPresetQuery] = useState("");
	const [ingestionLimit, setIngestionLimit] = useState("10");
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
	const selectedPreset = queryPresets.data?.presets.find(
		(preset) => preset.query === ingestionPresetQuery,
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
			onSuccess: async (result) => {
				setIngestionResult(result);
				setIngestionError(null);
				await invalidateAdminData();
			},
			onError: (error) => {
				setIngestionResult(null);
				setIngestionError(error.message);
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
		const limit = parseLimit(ingestionLimit);

		if (!ingestionCategoryId) {
			setIngestionResult(null);
			setIngestionError("Choose a category before running ingestion.");
			return;
		}
		if (!selectedPreset) {
			setIngestionResult(null);
			setIngestionError(
				"Choose an OpenAlex query preset before running ingestion.",
			);
			return;
		}
		if (!limit) {
			setIngestionResult(null);
			setIngestionError("Limit must be a number between 1 and 50.");
			return;
		}

		setIngestionError(null);
		runIngestion.mutate({
			categoryId: ingestionCategoryId,
			query: selectedPreset.query,
			limit,
		});
	};

	const handleRunClassificationBatch = () => {
		const limit = parseLimit(classificationLimit);

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
						<div className="grid gap-3 md:grid-cols-[1fr_1fr_7rem]">
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
								Query preset
								<select
									className={adminSelectClassName}
									disabled={queryPresets.isLoading || runIngestion.isPending}
									onChange={(event) =>
										setIngestionPresetQuery(event.target.value)
									}
									value={ingestionPresetQuery}
								>
									<option value="">Select preset</option>
									{queryPresets.data?.presets.map((preset) => (
										<option key={preset.query} value={preset.query}>
											{preset.label}
										</option>
									))}
								</select>
							</label>
							<label className={adminInputLabelClass}>
								Limit
								<Input
									disabled={runIngestion.isPending}
									max={50}
									min={1}
									onChange={(event) => setIngestionLimit(event.target.value)}
									type="number"
									value={ingestionLimit}
								/>
							</label>
						</div>
						{ingestionPresetQuery ? (
							<p className="text-xs leading-5 text-muted-foreground">
								Query: {ingestionPresetQuery}. Recommended category:{" "}
								{selectedPreset?.recommendedCategory ?? "Not available"}.
							</p>
						) : null}
						{categories.isError ? (
							<p className="rounded-md bg-destructive/10 p-2 text-xs leading-5 text-destructive">
								Categories could not be loaded. Refresh before running
								ingestion.
							</p>
						) : null}
						{queryPresets.isError ? (
							<p className="rounded-md bg-destructive/10 p-2 text-xs leading-5 text-destructive">
								Query presets could not be loaded. Refresh before running
								ingestion.
							</p>
						) : null}
						{ingestionError ? (
							<p className="rounded-md bg-destructive/10 p-2 text-xs leading-5 text-destructive">
								{ingestionError}
							</p>
						) : null}
						{ingestionResult ? (
							<div className="grid gap-2 rounded-md border border-border/80 bg-background p-3 text-xs">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="font-medium">Last ingestion result</span>
									<span
										className={cn(
											"rounded-md px-2.5 py-1 font-medium capitalize",
											getAdminStatusClass(ingestionResult.status),
										)}
									>
										{formatAdminStatus(ingestionResult.status)}
									</span>
								</div>
								<div className="grid gap-1 text-muted-foreground sm:grid-cols-3">
									<span>Fetched {ingestionResult.totalFetched}</span>
									<span>Saved {ingestionResult.totalSaved}</span>
									<span>Rejected {ingestionResult.totalRejected}</span>
								</div>
								<div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
									<span>Duplicates {ingestionResult.skipped.duplicates}</span>
									<span>Invalid {ingestionResult.skipped.invalid}</span>
								</div>
								{ingestionResult.errors?.length ? (
									<div className="grid gap-1 text-destructive">
										{ingestionResult.errors.slice(0, 3).map((error) => (
											<span key={error}>{error}</span>
										))}
									</div>
								) : null}
							</div>
						) : null}
						<Button
							className="w-fit"
							disabled={
								runIngestion.isPending ||
								categories.isLoading ||
								queryPresets.isLoading
							}
							onClick={handleRunIngestion}
							type="button"
						>
							{runIngestion.isPending
								? "Running ingestion..."
								: "Run OpenAlex Ingestion"}
						</Button>
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
