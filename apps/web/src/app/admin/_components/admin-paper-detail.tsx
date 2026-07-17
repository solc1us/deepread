"use client";

import type { AppRouter } from "@deepread/api/routers/index";
import { buildOpenAlexWorkUrl, normalizeOpenAlexId, OPENALEX_PROVIDER } from "@deepread/api/services/openalex-identifiers";
import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertCircle, ArrowLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

import {
  AdminPageHeader,
  AdminStatusBadge,
  formatAdminClassificationProvenance,
  formatAdminDate,
  formatAdminDifficulty,
  getAdminDifficultyClass,
} from "./admin-ui";
import { PaperMetadataEditor } from "./paper-metadata-editor";
import { PaperRemediationActions } from "./paper-remediation-actions";

type AdminPaperDetailData = inferRouterOutputs<AppRouter>["admin"]["papers"]["detail"];

function openAlexUrl(provider: string | null, externalId: string | null) {
  if (provider?.trim().toLowerCase() !== OPENALEX_PROVIDER) {
    return null;
  }

  const normalizedId = normalizeOpenAlexId(externalId);
  return normalizedId ? buildOpenAlexWorkUrl(normalizedId) : null;
}

function DetailSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:py-10">
      <Skeleton className="h-6 w-40 rounded-md" />
      <Skeleton className="h-28 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </main>
  );
}

export default function AdminPaperDetail({ paperId, returnTo }: { paperId: string; returnTo: string }) {
  const detail = useQuery(trpc.admin.papers.detail.queryOptions({ paperId }));
  const backHref = returnTo as Route;

  if (detail.isLoading) {
    return <DetailSkeleton />;
  }

  if (detail.isError || !detail.data) {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8 md:py-10">
        <Link className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline" href={backHref}>
          <ArrowLeft aria-hidden="true" className="size-4" />Back to Papers Monitor
        </Link>
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
            <div className="flex items-start gap-3">
              <AlertCircle aria-hidden="true" className="mt-0.5 text-destructive" />
              <div className="grid gap-1">
                <div className="text-sm font-medium">Admin paper detail unavailable</div>
                <p className="text-sm leading-6 text-muted-foreground">The paper may no longer exist, or the detail request could not be completed.</p>
              </div>
            </div>
            <Button onClick={() => void detail.refetch()} variant="outline"><RefreshCw aria-hidden="true" />Retry</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <PaperDetailContent data={detail.data} returnTo={backHref} />;
}

function PaperDetailContent({ data, returnTo }: { data: AdminPaperDetailData; returnTo: Route }) {
  const providerUrl = openAlexUrl(data.provider, data.externalId);
  const classificationVersion = data.classification?.classificationVersion ?? data.reviewClassificationVersion;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8 md:py-10">
      <Link className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" href={returnTo}>
        <ArrowLeft aria-hidden="true" className="size-4" />Back to Papers Monitor
      </Link>

      <AdminPageHeader
        description="Inspect complete administrative metadata and take status-appropriate remediation actions."
        eyebrow="Paper administration"
        title={data.title}
      />

      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge value={data.status} />
        <span className="rounded-md border bg-card px-2.5 py-1 text-xs font-medium">{data.category.name}</span>
        <span className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", getAdminDifficultyClass(data.classification?.difficultyLevel))}>
          {formatAdminDifficulty(data.classification?.difficultyLevel)}
        </span>
        <span className="rounded-md border bg-card px-2.5 py-1 text-xs font-medium">
          {formatAdminClassificationProvenance(classificationVersion)}
        </span>
      </div>

      {data.status === "needs_review" ? (
        <Card className="rounded-lg border-difficulty-difficult-foreground/25 bg-difficulty-difficult/55 shadow-sm">
          <CardHeader className="gap-1"><CardTitle className="text-base">Review reasons</CardTitle><p className="text-sm text-difficulty-difficult-foreground">Current v2.1.4 quality-gate assessment.</p></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-difficulty-difficult-foreground">
              {data.reviewReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="grid gap-5">
          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Abstract</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{data.abstract || "No abstract available."}</p></CardContent>
          </Card>

          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Classification</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              {data.classification ? (
                <>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <DetailValue label="Difficulty" value={formatAdminDifficulty(data.classification.difficultyLevel)} />
                    <DetailValue label="Beginner score" value={data.classification.beginnerScore === null ? "Not applicable" : `${data.classification.beginnerScore}/100`} />
                    <DetailValue label="Estimated reading time" value={data.classification.estimatedReadingTime === null ? "Not applicable" : `${data.classification.estimatedReadingTime} minutes`} />
                  </dl>
                  <div className="grid gap-1"><h3 className="text-xs font-medium">Classification reason</h3><p className="text-sm leading-6 text-muted-foreground">{data.classification.classificationReason}</p></div>
                  {data.classification.readingWarning ? <div className="grid gap-1"><h3 className="text-xs font-medium">Reading warning</h3><p className="text-sm leading-6 text-muted-foreground">{data.classification.readingWarning}</p></div> : null}
                  {data.classification.recommendedReader ? <div className="grid gap-1"><h3 className="text-xs font-medium">Recommended reader</h3><p className="text-sm leading-6 text-muted-foreground">{data.classification.recommendedReader}</p></div> : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No stored classification is available.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="grid content-start gap-5">
          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Metadata</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <dl className="grid gap-3">
                <DetailValue label="Authors" value={data.authors.length > 0 ? data.authors.join(", ") : "Not available"} />
                <DetailValue label="Publication year" value={data.publicationYear?.toString() ?? "Not available"} />
                <DetailValue label="DOI" value={data.doi ?? "Not available"} />
                <DetailValue label="Provider ID" value={data.provider && data.externalId ? `${data.provider}: ${data.externalId}` : "Not available"} />
                <DetailValue label="Source URL" value={data.sourceUrl.trim() || "Not available"} />
                <DetailValue label="PDF URL" value={data.pdfUrl?.trim() || "Not available"} />
                <DetailValue label="Language" value={data.language ?? "Not available"} />
                <DetailValue label="Updated" value={formatAdminDate(data.updatedAt)} />
              </dl>
              <div className="flex flex-wrap gap-3 border-t pt-3">
                {data.sourceUrl.trim() ? <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={data.sourceUrl} rel="noreferrer" target="_blank">Source<ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : null}
                {data.pdfUrl ? <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={data.pdfUrl} rel="noreferrer" target="_blank">PDF<ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : null}
                {providerUrl ? <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={providerUrl} rel="noreferrer" target="_blank">OpenAlex<ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Actions</CardTitle></CardHeader>
            <CardContent>
              {data.status === "needs_review" || data.status === "pending" ? (
                <PaperRemediationActions
                  metadataInitialValues={{
                    authors: data.authors,
                    abstract: data.abstract,
                    publicationYear: data.publicationYear,
                    sourceUrl: data.sourceUrl,
                    pdfUrl: data.pdfUrl,
                  }}
                  paperId={data.paperId}
                  paperTitle={data.title}
                  status={data.status}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <PaperMetadataEditor
                    initialValues={{
                      authors: data.authors,
                      abstract: data.abstract,
                      publicationYear: data.publicationYear,
                      sourceUrl: data.sourceUrl,
                      pdfUrl: data.pdfUrl,
                    }}
                    paperId={data.paperId}
                    paperTitle={data.title}
                  />
                  {data.status === "published" ? <Button nativeButton={false} render={<Link href={`/papers/${data.paperId}`} />}>View public paper</Button> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="grid min-w-0 gap-1"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>;
}
