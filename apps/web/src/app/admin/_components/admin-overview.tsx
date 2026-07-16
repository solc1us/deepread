"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@deepread/ui/components/tooltip";
import { AlertCircle, ArrowDown, ArrowUp, CircleOff, Database, FileCheck2, FileClock, FileSearch2, FileText, FileX2, FolderKanban } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, formatAdminDate } from "./admin-ui";

const datasetDifficulties = [
  {
    key: "beginnerFriendly",
    query: "beginner_friendly",
    label: "Beginner friendly",
    shortLabel: "Beginner",
    colorClass: "bg-emerald-600 dark:bg-emerald-500",
  },
  {
    key: "moderate",
    query: "moderate",
    label: "Moderate",
    shortLabel: "Moderate",
    colorClass: "bg-blue-600 dark:bg-blue-500",
  },
  {
    key: "difficult",
    query: "difficult",
    label: "Difficult",
    shortLabel: "Difficult",
    colorClass: "bg-amber-500 dark:bg-amber-400",
  },
  {
    key: "expert",
    query: "expert",
    label: "Expert",
    shortLabel: "Expert",
    colorClass: "bg-rose-600 dark:bg-rose-500",
  },
] as const;

type DatasetSortKey = "categoryName" | "beginnerFriendly" | "moderate" | "difficult" | "expert" | "total";
type SortDirection = "ascending" | "descending";

function SortIndicator({ direction }: { direction: SortDirection }) {
  return direction === "ascending" ? (
    <ArrowUp aria-hidden="true" className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden="true" className="size-3.5" />
  );
}

function DatasetBarSegment({
  categoryName,
  colorClass,
  count,
  difficultyLabel,
  total,
}: {
  categoryName: string;
  colorClass: string;
  count: number;
  difficultyLabel: string;
  total: number;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const percentageLabel = total > 0 ? `${percentage.toFixed(1)}%` : "0%";
  const accessiblePercentage = total > 0 ? percentage.toFixed(1) : "0";

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`${categoryName}, ${difficultyLabel}, ${count} papers, ${accessiblePercentage} percent`}
        className={`${colorClass} block h-full min-w-0 border-0 p-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset`}
        style={{ width: `${percentage}%` }}
        type="button"
      />
      <TooltipContent>
        <div className="grid min-w-40 gap-1">
          <div className="font-medium">{categoryName}</div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span aria-hidden="true" className={`size-2.5 rounded-sm ${colorClass}`} />
            <span>{difficultyLabel}</span>
          </div>
          <div className="tabular-nums text-popover-foreground">
            {count} papers <span aria-hidden="true">&middot;</span> {percentageLabel}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function paperMonitorHref(categorySlug?: string, difficulty?: string) {
  const searchParams = new URLSearchParams();

  if (categorySlug) {
    searchParams.set("category", categorySlug);
  }
  if (difficulty) {
    searchParams.set("difficulty", difficulty);
  }

  const query = searchParams.toString();
  return `/admin/papers${query ? `?${query}` : ""}` as Route;
}

const countLinkClass = "font-medium tabular-nums text-primary underline-offset-4 hover:underline";

export default function AdminOverview() {
  const [datasetSort, setDatasetSort] = useState<{ key: DatasetSortKey; direction: SortDirection }>({
    key: "total",
    direction: "descending",
  });
  const overview = useQuery(trpc.admin.dashboard.getOverview.queryOptions());

  const updateDatasetSort = (key: DatasetSortKey) => {
    setDatasetSort((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === "ascending"
            ? "descending"
            : "ascending"
          : key === "categoryName"
            ? "ascending"
            : "descending",
    }));
  };

  if (overview.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8">
        <Skeleton className="h-20 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton className="h-24 rounded-lg" key={index} />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </main>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Admin overview unavailable</div>
              <p className="text-sm leading-6 text-muted-foreground">Confirm your admin session and server connection.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { paperStatusSummary, datasetOverview, ingestionOverview, systemHealth } = overview.data;
  const datasetTotals = datasetOverview.categories.reduce(
    (totals, category) => ({
      beginnerFriendly: totals.beginnerFriendly + category.beginnerFriendly,
      moderate: totals.moderate + category.moderate,
      difficult: totals.difficult + category.difficult,
      expert: totals.expert + category.expert,
      total: totals.total + category.total,
    }),
    { beginnerFriendly: 0, moderate: 0, difficult: 0, expert: 0, total: 0 },
  );
  const sortedDatasetCategories = [...datasetOverview.categories].sort((left, right) => {
    if (datasetSort.key === "categoryName") {
      const comparison = left.categoryName.localeCompare(right.categoryName);
      return datasetSort.direction === "ascending" ? comparison : -comparison;
    }

    const comparison = left[datasetSort.key] - right[datasetSort.key];
    if (comparison === 0) {
      return left.categoryName.localeCompare(right.categoryName);
    }

    return datasetSort.direction === "ascending" ? comparison : -comparison;
  });

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader
        description="A compact view of paper availability, classification coverage, and the latest ingestion state."
        title="Admin Overview"
      />

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Paper Status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminMetricCard icon={FileText} label="Total papers" value={paperStatusSummary.totalPapers} />
          <AdminMetricCard icon={FileCheck2} label="Published" value={paperStatusSummary.publishedPapers} />
          <AdminMetricCard icon={FileClock} label="Pending" value={paperStatusSummary.pendingPapers} />
          <AdminMetricCard icon={FileSearch2} label="Needs review" value={paperStatusSummary.needsReviewPapers} />
          <AdminMetricCard icon={FileX2} label="Rejected" value={paperStatusSummary.rejectedPapers} />
          <AdminMetricCard icon={CircleOff} label="Inactive" value={paperStatusSummary.inactivePapers} />
        </div>
      </section>

      <section aria-labelledby="dataset-overview-heading" className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold" id="dataset-overview-heading">Dataset Overview</h2>
          <p className="text-sm leading-6 text-muted-foreground">Distribution of published papers across categories and difficulty levels.</p>
        </div>

        {datasetOverview.totalPublished === 0 ? (
          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardContent className="py-6 text-sm leading-6 text-muted-foreground">
              No published papers are available for dataset analysis yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-lg border-border/80 shadow-sm">
            <CardContent className="grid gap-5 py-5">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Difficulty legend">
                {datasetDifficulties.map((difficulty) => (
                  <span className="inline-flex items-center gap-2" key={difficulty.key}>
                    <span aria-hidden="true" className={`size-2.5 rounded-sm ${difficulty.colorClass}`} />
                    {difficulty.label}
                  </span>
                ))}
              </div>

              <TooltipProvider>
                <div className="grid gap-4">
                  {datasetOverview.categories.map((category) => (
                    <div className="grid gap-2" key={category.categoryId}>
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="min-w-0 truncate font-medium" title={category.categoryName}>{category.categoryName}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{category.total}</span>
                      </div>
                      <div
                        aria-label={`${category.categoryName}: ${category.total} published papers`}
                        className="flex h-3 w-full overflow-hidden rounded-md bg-muted"
                        role="group"
                      >
                        {category.total > 0
                          ? datasetDifficulties.map((difficulty) => {
                              const count = category[difficulty.key];
                              return count > 0 ? (
                                <DatasetBarSegment
                                  categoryName={category.categoryName}
                                  colorClass={difficulty.colorClass}
                                  count={count}
                                  difficultyLabel={difficulty.label}
                                  key={difficulty.key}
                                  total={category.total}
                                />
                              ) : null;
                            })
                          : null}
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            </CardContent>

            <div className="overflow-x-auto border-t border-border/80">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <caption className="sr-only">Exact published-paper distribution by category and difficulty</caption>
                <thead className="bg-muted/35 text-xs text-muted-foreground">
                  <tr>
                    <th
                      aria-sort={datasetSort.key === "categoryName" ? datasetSort.direction : undefined}
                      className="px-4 py-3 font-medium"
                      scope="col"
                    >
                      <button
                        className="inline-flex items-center gap-1.5 rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => updateDatasetSort("categoryName")}
                        type="button"
                      >
                        Category
                        {datasetSort.key === "categoryName" ? <SortIndicator direction={datasetSort.direction} /> : null}
                      </button>
                    </th>
                    {datasetDifficulties.map((difficulty) => (
                      <th
                        aria-sort={datasetSort.key === difficulty.key ? datasetSort.direction : undefined}
                        className="px-3 py-3 text-right font-medium"
                        key={difficulty.key}
                        scope="col"
                      >
                        <button
                          className="ml-auto inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => updateDatasetSort(difficulty.key)}
                          type="button"
                        >
                          {difficulty.shortLabel}
                          {datasetSort.key === difficulty.key ? <SortIndicator direction={datasetSort.direction} /> : null}
                        </button>
                      </th>
                    ))}
                    <th
                      aria-sort={datasetSort.key === "total" ? datasetSort.direction : undefined}
                      className="px-4 py-3 text-right font-medium"
                      scope="col"
                    >
                      <button
                        className="ml-auto inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => updateDatasetSort("total")}
                        type="button"
                      >
                        Total
                        {datasetSort.key === "total" ? <SortIndicator direction={datasetSort.direction} /> : null}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {sortedDatasetCategories.map((category) => (
                    <tr key={category.categoryId}>
                      <th className="px-4 py-3 font-medium" scope="row">{category.categoryName}</th>
                      {datasetDifficulties.map((difficulty) => (
                        <td className="px-3 py-3 text-right" key={difficulty.key}>
                          <Link className={countLinkClass} href={paperMonitorHref(category.categorySlug, difficulty.query)}>
                            {category[difficulty.key]}
                          </Link>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <Link className={countLinkClass} href={paperMonitorHref(category.categorySlug)}>{category.total}</Link>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/25">
                    <th className="px-4 py-3 font-semibold" scope="row">All categories</th>
                    {datasetDifficulties.map((difficulty) => (
                      <td className="px-3 py-3 text-right" key={difficulty.key}>
                        <Link className={countLinkClass} href={paperMonitorHref(undefined, difficulty.query)}>
                          {datasetTotals[difficulty.key]}
                        </Link>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <Link className={countLinkClass} href={paperMonitorHref()}>{datasetTotals.total}</Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.1fr)]">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Database className="text-primary" />System Health</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Database connectivity for the admin pipeline.</p>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <span className="text-muted-foreground">Database</span>
              <AdminStatusBadge value={systemHealth.database.status} />
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Checked {formatAdminDate(systemHealth.database.checkedAt)}</span>
              {systemHealth.database.message ? <span className="text-xs leading-5 text-destructive">{systemHealth.database.message}</span> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="text-lg">Ingestion Overview</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Latest OpenAlex ingestion run status.</p>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <span className="text-muted-foreground">Last status</span>
              <AdminStatusBadge value={ingestionOverview.lastIngestionStatus} />
            </div>
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <span className="text-muted-foreground">Last ingestion</span>
              <span className="text-right">{formatAdminDate(ingestionOverview.lastIngestionAt)}</span>
            </div>
            <div className="grid gap-2 rounded-md bg-muted/35 p-3">
              <div className="flex justify-between gap-3"><span>Total runs</span><span className="font-medium">{ingestionOverview.totalIngestionRuns}</span></div>
              <div className="flex justify-between gap-3"><span>Successful</span><span className="font-medium">{ingestionOverview.successfulRuns}</span></div>
              <div className="flex justify-between gap-3"><span>Partial</span><span className="font-medium">{ingestionOverview.partialRuns}</span></div>
              <div className="flex justify-between gap-3"><span>Failed</span><span className="font-medium">{ingestionOverview.failedRuns}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-lg"><FolderKanban className="text-primary" />Admin Tasks</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Open the focused page for each operational task.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href={"/admin/pipeline" as Route} />}>Pipeline</Button>
            <Button nativeButton={false} render={<Link href={"/admin/logs" as Route} />} variant="outline">Ingestion Logs</Button>
            <Button nativeButton={false} render={<Link href={"/admin/classification" as Route} />} variant="outline">Classification</Button>
            <Button nativeButton={false} render={<Link href={"/admin/papers" as Route} />} variant="outline">Papers Monitor</Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
