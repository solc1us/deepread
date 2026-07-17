"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@deepread/api/routers/index";
import { AlertCircle, ArrowUpRight, CheckCircle2, RefreshCw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

import { AdminPageHeader, formatAdminDate } from "./admin-ui";

const auditSections = [
  {
    key: "classification",
    title: "Classification consistency",
    description: "Published-paper coverage against the current production classifier.",
  },
  {
    key: "metadata",
    title: "Metadata completeness",
    description: "Required and optional metadata fields on published papers.",
  },
  {
    key: "duplicates",
    title: "Duplicate detection",
    description: "Canonical identifier matches and conservative title-review candidates.",
  },
  {
    key: "workflow",
    title: "Workflow backlog",
    description: "Papers waiting for processing, review, or administrative action.",
  },
  {
    key: "integrity",
    title: "Relational integrity",
    description: "Relationship consistency and retained user data on unpublished papers.",
  },
] as const;

type AuditSection = (typeof auditSections)[number]["key"];
type AuditSeverity = "info" | "warning" | "critical";
type DataQualityData = inferRouterOutputs<AppRouter>["admin"]["dataQuality"]["getOverview"];
type DataQualityIssue = DataQualityData["issues"][number];

const severityClasses: Record<AuditSeverity, string> = {
  info: "bg-difficulty-moderate text-difficulty-moderate-foreground",
  warning: "bg-difficulty-difficult text-difficulty-difficult-foreground",
  critical: "bg-difficulty-expert text-difficulty-expert-foreground",
};

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  return (
    <span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-medium capitalize", severityClasses[severity])}>
      {severity}
    </span>
  );
}

function issueActionLabel(key: string) {
  return key === "duplicates-title" ? "Review groups" : key.startsWith("metadata-") || key.startsWith("integrity-") ? "Review papers" : "View papers";
}

function DataQualitySkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-16 rounded-lg" />
      {auditSections.map((section) => (
        <Skeleton className="h-48 rounded-lg" key={section.key} />
      ))}
    </div>
  );
}

export default function DataQualityOverview() {
  const overview = useQuery(trpc.admin.dataQuality.getOverview.queryOptions());

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader
        description="Audit classification consistency, metadata completeness, duplicates, workflow backlog, and relational integrity."
        title="Data Quality"
      />

      {overview.isLoading ? <DataQualitySkeleton /> : null}

      {overview.isError ? (
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
            <div className="flex items-start gap-3">
              <AlertCircle aria-hidden="true" className="mt-0.5 text-destructive" />
              <div className="grid gap-1">
                <div className="text-sm font-medium">Data-quality audit unavailable</div>
                <p className="text-sm leading-6 text-muted-foreground">The audit could not be generated. Retry the request or confirm the server connection.</p>
              </div>
            </div>
            <Button onClick={() => void overview.refetch()} variant="outline">
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {overview.data ? <DataQualityResults data={overview.data} isRefreshing={overview.isFetching} onRefresh={() => void overview.refetch()} /> : null}
    </main>
  );
}

function DataQualityResults({
  data,
  isRefreshing,
  onRefresh,
}: {
  data: DataQualityData;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const hasCritical = data.issues.some((auditIssue) => auditIssue.severity === "critical" && auditIssue.count > 0);
  const hasWarning = data.issues.some((auditIssue) => auditIssue.severity === "warning" && auditIssue.count > 0);
  const overallStatus = hasCritical ? "Critical issues" : hasWarning ? "Needs attention" : "Healthy";
  const overallStatusClass = hasCritical
    ? severityClasses.critical
    : hasWarning
      ? severityClasses.warning
      : "bg-difficulty-beginner text-difficulty-beginner-foreground";
  const issuesBySection = new Map<AuditSection, DataQualityIssue[]>();

  for (const section of auditSections) {
    issuesBySection.set(section.key, []);
  }
  for (const auditIssue of data.issues) {
    issuesBySection.get(auditIssue.section)?.push(auditIssue);
  }

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/80 bg-card p-4 shadow-sm">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-medium", overallStatusClass)}>{overallStatus}</span>
            <span className="text-xs text-muted-foreground">Generated {formatAdminDate(data.generatedAt)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.classification.publishedTotal} published papers audited against {data.classification.currentVersion}.
          </p>
        </div>
        <Button aria-busy={isRefreshing} disabled={isRefreshing} onClick={onRefresh} variant="outline">
          <RefreshCw className={cn(isRefreshing && "animate-spin")} data-icon="inline-start" />
          {isRefreshing ? "Refreshing" : "Refresh audit"}
        </Button>
      </section>

      {!hasCritical && !hasWarning ? (
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <CheckCircle2 aria-hidden="true" className="text-difficulty-beginner-foreground" />
            No actionable data-quality issues were detected.
          </CardContent>
        </Card>
      ) : null}

      {auditSections.map((section) => {
        const sectionIssues = issuesBySection.get(section.key) ?? [];

        return (
          <Card className="overflow-hidden rounded-lg border-border/80 shadow-sm" key={section.key}>
            <CardHeader className="gap-1 border-b border-border/80">
              <CardTitle className="text-lg">{section.title}</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">{section.description}</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <caption className="sr-only">{section.title} audit results</caption>
                <thead className="bg-muted/35 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium" scope="col">Check</th>
                    <th className="px-3 py-3 text-right font-medium" scope="col">Count</th>
                    <th className="px-3 py-3 font-medium" scope="col">Severity</th>
                    <th className="px-3 py-3 font-medium" scope="col">Explanation</th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {sectionIssues.map((auditIssue) => (
                    <tr className={cn(auditIssue.count === 0 && "text-muted-foreground")} key={auditIssue.key}>
                      <th className="px-4 py-3 font-medium text-foreground" scope="row">{auditIssue.label}</th>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{auditIssue.count}</td>
                      <td className="px-3 py-3"><SeverityBadge severity={auditIssue.severity} /></td>
                      <td className="max-w-md px-3 py-3 leading-5">{auditIssue.description}</td>
                      <td className="px-4 py-3 text-right">
                        {auditIssue.targetUrl && auditIssue.count > 0 ? (
                          <Link className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline" href={auditIssue.targetUrl as Route}>
                            {issueActionLabel(auditIssue.key)}
                            <ArrowUpRight aria-hidden="true" className="size-3.5" />
                          </Link>
                        ) : (
                          <span aria-hidden="true">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </>
  );
}
