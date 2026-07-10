"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { AlertCircle, CheckCircle2, Database, FileCheck2, FileClock, FileText, FileX2, FolderKanban } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, formatAdminDate } from "./admin-ui";

export default function AdminOverview() {
  const overview = useQuery(trpc.admin.dashboard.getOverview.queryOptions());

  if (overview.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8">
        <Skeleton className="h-20 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton className="h-24 rounded-lg" key={index} />
          ))}
        </div>
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

  const { paperStatusSummary, classificationSummary, ingestionOverview, systemHealth } = overview.data;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader
        description="A compact view of paper availability, classification coverage, and the latest ingestion state."
        title="Admin Overview"
      />

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Paper Status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard icon={FileText} label="Total papers" value={paperStatusSummary.totalPapers} />
          <AdminMetricCard icon={FileCheck2} label="Published" value={paperStatusSummary.publishedPapers} />
          <AdminMetricCard icon={FileClock} label="Pending" value={paperStatusSummary.pendingPapers} />
          <AdminMetricCard icon={FileX2} label="Rejected" value={paperStatusSummary.rejectedPapers} />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Classification Snapshot</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard icon={CheckCircle2} label="Classified" value={classificationSummary.classifiedPapers} />
          <AdminMetricCard icon={AlertCircle} label="Unclassified" value={classificationSummary.unclassifiedPapers} />
          <AdminMetricCard icon={CheckCircle2} label="Beginner friendly" value={classificationSummary.beginnerFriendly} />
          <AdminMetricCard icon={CheckCircle2} label="Moderate or harder" value={classificationSummary.moderate + classificationSummary.difficult + classificationSummary.expert} />
        </div>
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
