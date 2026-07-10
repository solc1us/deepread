"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BarChart3, CheckCircle2, FileClock } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

import { AdminMetricCard, AdminPageHeader, formatAdminDifficulty, getAdminBarWidth, getAdminDifficultyClass } from "./admin-ui";

export default function ClassificationMonitor() {
  const overview = useQuery(trpc.admin.dashboard.getOverview.queryOptions());

  if (overview.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8">
        <Skeleton className="h-20 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-24 rounded-lg" key={index} />)}</div>
        <Skeleton className="h-72 rounded-lg" />
      </main>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card className="rounded-lg border-border/80 shadow-sm"><CardContent className="flex items-start gap-3 py-4"><AlertCircle className="mt-0.5 text-destructive" /><div className="grid gap-1"><div className="text-sm font-medium">Classification monitoring unavailable</div><p className="text-sm leading-6 text-muted-foreground">Confirm your admin session and server connection.</p></div></CardContent></Card>
      </main>
    );
  }

  const { classificationSummary, difficultyDistribution, paperStatusSummary } = overview.data;
  const maxDifficultyCount = Math.max(0, ...difficultyDistribution.map((item) => item.count));

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader description="Monitor coverage and difficulty levels for metadata-only paper classifications." title="Classification" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-lg font-semibold">Classification Coverage</h2><Button nativeButton={false} render={<Link href={"/admin/pipeline" as Route} />} variant="outline">Run Batch Classification</Button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard icon={CheckCircle2} label="Classified papers" value={classificationSummary.classifiedPapers} />
          <AdminMetricCard icon={AlertCircle} label="Unclassified papers" value={classificationSummary.unclassifiedPapers} />
          <AdminMetricCard icon={FileClock} label="Pending papers" value={paperStatusSummary.pendingPapers} />
          <AdminMetricCard icon={BarChart3} label="Beginner friendly" value={classificationSummary.beginnerFriendly} />
        </div>
      </section>

      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="text-primary" />Difficulty Distribution</CardTitle><p className="text-sm leading-6 text-muted-foreground">All classified papers, grouped by estimated reader difficulty.</p></CardHeader>
        <CardContent className="grid gap-4">
          {difficultyDistribution.some((item) => item.count > 0) ? difficultyDistribution.map((item) => (
            <div className="grid gap-1.5" key={item.difficultyLevel}>
              <div className="flex items-center justify-between gap-3 text-sm"><span className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", getAdminDifficultyClass(item.difficultyLevel))}>{formatAdminDifficulty(item.difficultyLevel)}</span><span className="text-muted-foreground">{item.count}</span></div>
              <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: getAdminBarWidth(item.count, maxDifficultyCount) }} /></div>
            </div>
          )) : <p className="text-sm leading-6 text-muted-foreground">No classified papers yet.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
