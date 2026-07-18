"use client";

import type { AppRouter } from "@deepread/api/routers/index";
import { buildOpenAlexWorkUrl, normalizeOpenAlexId, OPENALEX_PROVIDER } from "@deepread/api/services/openalex-identifiers";
import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertCircle, ArrowLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

import { AdminPageHeader, AdminStatusBadge } from "./admin-ui";
import {
  DuplicateResolutionNotice,
  DuplicateTitleResolutionActions,
  type ResolveDuplicateResult,
} from "./duplicate-title-resolution";
import { PaperMetadataEditor } from "./paper-metadata-editor";

export type DataQualityDetailIssue =
  | "missing-authors"
  | "duplicate-title"
  | "unpublished-user-relations";

type DataQualityDetailsData = inferRouterOutputs<AppRouter>["admin"]["dataQuality"]["getDetails"];
type MissingAuthorPaper = {
  paperId: string;
  title: string;
  publicationYear: number | null;
  categoryName: string;
  status: string;
  doi: string | null;
  provider: string | null;
  externalId: string | null;
  sourceUrl: string | null;
  currentAuthors: unknown;
};
type DuplicateTitlePaper = {
  paperId: string;
  title: string;
  authors: string[];
  publicationYear: number | null;
  categoryName: string;
  status: string;
  doi: string | null;
  provider: string | null;
  externalId: string | null;
  sourceUrl: string | null;
  abstractPreview: string | null;
  bookmarkCount: number;
  noteCount: number;
  readingProgressCount: number;
};
type DuplicateTitleGroup = {
  groupKey: string;
  normalizedTitle: string;
  papers: DuplicateTitlePaper[];
};
type UnpublishedRelationsPaper = {
  paperId: string;
  title: string;
  status: string;
  categoryName: string;
  bookmarkCount: number;
  noteCount: number;
  readingProgressCount: number;
  totalUserRelations: number;
};

const issueContent: Record<DataQualityDetailIssue, { title: string; description: string; empty: string }> = {
  "missing-authors": {
    title: "Missing Authors",
    description: "Published papers whose author metadata has no usable names.",
    empty: "No published papers with missing authors were found.",
  },
  "duplicate-title": {
    title: "Probable Duplicate Titles",
    description: "Conservative normalized-title matches for explicit administrative review and resolution.",
    empty: "No probable duplicate-title groups were found.",
  },
  "unpublished-user-relations": {
    title: "User Relations on Unpublished Papers",
    description: "Retained bookmarks, notes, and reading progress associated with papers that are not public.",
    empty: "No user relations are attached to unpublished papers.",
  },
};

function openAlexUrl(provider: string | null, externalId: string | null) {
  if (provider?.trim().toLowerCase() !== OPENALEX_PROVIDER) {
    return null;
  }

  const normalizedId = normalizeOpenAlexId(externalId);
  return normalizedId ? buildOpenAlexWorkUrl(normalizedId) : null;
}

function displayAuthors(value: unknown) {
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : JSON.stringify(value);
  }

  if (value === null || value === undefined) {
    return "Not available";
  }

  return typeof value === "string" ? value || '""' : JSON.stringify(value) ?? "Unusable value";
}

function providerId(provider: string | null, externalId: string | null) {
  return provider && externalId ? `${provider}: ${externalId}` : "Not available";
}

function PaperDestination({ paperId, status }: { paperId: string; status: string }) {
  return status === "published" ? (
    <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/papers/${paperId}`}>
      View paper
    </Link>
  ) : (
    <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/admin/papers?status=${status}` as Route}>
      Open papers monitor
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export default function DataQualityDetails({ issue }: { issue: DataQualityDetailIssue }) {
  const content = issueContent[issue];
  const details = useQuery(trpc.admin.dataQuality.getDetails.queryOptions({ issue }));

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <div className="grid gap-4">
        <Link className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" href="/admin/data-quality">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Data Quality
        </Link>
        <AdminPageHeader description={content.description} title={content.title} />
      </div>

      {details.isLoading ? <LoadingState /> : null}

      {details.isError ? (
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
            <div className="flex items-start gap-3">
              <AlertCircle aria-hidden="true" className="mt-0.5 text-destructive" />
              <div className="grid gap-1">
                <div className="text-sm font-medium">Audit details unavailable</div>
                <p className="text-sm leading-6 text-muted-foreground">The selected audit details could not be loaded. Retry the request or confirm the server connection.</p>
              </div>
            </div>
            <Button onClick={() => void details.refetch()} variant="outline">
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {details.data ? <DetailsContent data={details.data} emptyMessage={content.empty} /> : null}
    </main>
  );
}

function DetailsContent({ data, emptyMessage }: { data: DataQualityDetailsData; emptyMessage: string }) {
  if (data.issue === "missing-authors") {
    return data.papers.length > 0 ? <MissingAuthorsTable papers={data.papers} /> : <EmptyState message={emptyMessage} />;
  }

  if (data.issue === "duplicate-title") {
    return data.groups.length > 0 ? <DuplicateTitleGroups groups={data.groups} /> : <EmptyState message={emptyMessage} />;
  }

  return data.papers.length > 0 ? <UnpublishedRelationsTable papers={data.papers} /> : <EmptyState message={emptyMessage} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="rounded-lg border-border/80 shadow-sm">
      <CardContent className="py-6 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function MissingAuthorsTable({
  papers,
}: {
  papers: MissingAuthorPaper[];
}) {
  return (
    <Card className="overflow-hidden rounded-lg border-border/80 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[70rem] text-left text-sm">
          <caption className="sr-only">Published papers with missing author metadata</caption>
          <thead className="bg-muted/35 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">Title</th>
              <th className="px-3 py-3 font-medium" scope="col">Year</th>
              <th className="px-3 py-3 font-medium" scope="col">Category</th>
              <th className="px-3 py-3 font-medium" scope="col">Current author value</th>
              <th className="px-3 py-3 font-medium" scope="col">DOI</th>
              <th className="px-3 py-3 font-medium" scope="col">Provider ID</th>
              <th className="px-3 py-3 font-medium" scope="col">Source</th>
              <th className="px-3 py-3 font-medium" scope="col">Status</th>
              <th className="px-4 py-3 text-right font-medium" scope="col">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {papers.map((paper) => {
              const providerUrl = openAlexUrl(paper.provider, paper.externalId);

              return (
                <tr key={paper.paperId}>
                  <th className="max-w-72 px-4 py-3 font-medium" scope="row">
                    <Link className="hover:text-primary" href={`/papers/${paper.paperId}`}>{paper.title}</Link>
                  </th>
                  <td className="px-3 py-3 tabular-nums">{paper.publicationYear ?? "Unknown"}</td>
                  <td className="px-3 py-3">{paper.categoryName}</td>
                  <td className="max-w-64 px-3 py-3"><code className="break-all text-xs">{displayAuthors(paper.currentAuthors)}</code></td>
                  <td className="max-w-52 break-all px-3 py-3 text-xs">{paper.doi ?? "Not available"}</td>
                  <td className="max-w-52 break-all px-3 py-3 text-xs">
                    {providerUrl ? <a className="text-primary underline-offset-4 hover:underline" href={providerUrl} rel="noreferrer" target="_blank">{providerId(paper.provider, paper.externalId)}</a> : providerId(paper.provider, paper.externalId)}
                  </td>
                  <td className="px-3 py-3">
                    {paper.sourceUrl ? <a className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" href={paper.sourceUrl} rel="noreferrer" target="_blank">Open source<ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : "Not available"}
                  </td>
                  <td className="px-3 py-3"><AdminStatusBadge value={paper.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <PaperMetadataEditor
                      initialValues={{
                        authors: paper.currentAuthors,
                        publicationYear: paper.publicationYear,
                        sourceUrl: paper.sourceUrl,
                      }}
                      paperId={paper.paperId}
                      paperTitle={paper.title}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DuplicateTitleGroups({
  groups,
}: {
  groups: DuplicateTitleGroup[];
}) {
  const [resolvedGroupIdentities, setResolvedGroupIdentities] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastResolution, setLastResolution] = useState<{
    groupTitle: string;
    result: ResolveDuplicateResult;
  } | null>(null);
  const visibleGroups = groups.filter(
    (group) => !resolvedGroupIdentities.has(duplicateGroupIdentity(group)),
  );

  return (
    <section className="grid gap-4">
      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardContent className="py-4 text-sm leading-6 text-muted-foreground">
          Matching normalized titles are review candidates and are not automatically confirmed duplicates.
        </CardContent>
      </Card>

      {lastResolution ? (
        <DuplicateResolutionNotice
          groupTitle={lastResolution.groupTitle}
          onDismiss={() => setLastResolution(null)}
          result={lastResolution.result}
        />
      ) : null}

      {visibleGroups.map((group, index) => {
        const identity = duplicateGroupIdentity(group);

        return (
          <details className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm" key={identity} open={index === 0}>
          <summary className="cursor-pointer px-4 py-3 font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            Candidate group {index + 1} <span className="text-sm font-normal text-muted-foreground">({group.papers.length} papers)</span>
          </summary>
          <div className="border-t border-border/80">
            <div className="bg-muted/25 px-4 py-2 text-xs text-muted-foreground">Normalized title: {group.normalizedTitle}</div>
            <div className="divide-y divide-border/70">
              {group.papers.map((paper) => {
                const providerUrl = openAlexUrl(paper.provider, paper.externalId);

                return (
                  <article className="grid gap-3 p-4" key={paper.paperId}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid min-w-0 gap-1">
                        <h3 className="font-medium leading-6">{paper.title}</h3>
                        <p className="text-xs text-muted-foreground">{paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors"}</p>
                      </div>
                      <AdminStatusBadge value={paper.status} />
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-xs text-muted-foreground">Year</dt><dd>{paper.publicationYear ?? "Unknown"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Category</dt><dd>{paper.categoryName}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">DOI</dt><dd className="break-all text-xs">{paper.doi ?? "Not available"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Provider ID</dt><dd className="break-all text-xs">{providerUrl ? <a className="text-primary underline-offset-4 hover:underline" href={providerUrl} rel="noreferrer" target="_blank">{providerId(paper.provider, paper.externalId)}</a> : providerId(paper.provider, paper.externalId)}</dd></div>
                    </dl>
                    <p className="text-sm leading-6 text-muted-foreground">{paper.abstractPreview ?? "No abstract preview available."}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        <span>{paper.bookmarkCount} bookmarks</span>
                        <span>{paper.noteCount} notes</span>
                        <span>{paper.readingProgressCount} reading progress</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <PaperDestination paperId={paper.paperId} status={paper.status} />
                        {paper.sourceUrl ? <a className="font-medium text-primary underline-offset-4 hover:underline" href={paper.sourceUrl} rel="noreferrer" target="_blank">Open source</a> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <DuplicateTitleResolutionActions
              group={group}
              onResolved={(result) => {
                setResolvedGroupIdentities((current) => new Set(current).add(identity));
                setLastResolution({
                  groupTitle: group.papers[0]?.title ?? group.normalizedTitle,
                  result,
                });
              }}
            />
          </div>
          </details>
        );
      })}

      {visibleGroups.length === 0 ? (
        <EmptyState message="No unresolved probable duplicate-title groups remain in this view." />
      ) : null}
    </section>
  );
}

function duplicateGroupIdentity(group: DuplicateTitleGroup) {
  return `${group.groupKey}\u0000${group.papers
    .map((paper) => paper.paperId)
    .sort()
    .join(",")}`;
}

function UnpublishedRelationsTable({
  papers,
}: {
  papers: UnpublishedRelationsPaper[];
}) {
  const totalRelations = papers.reduce((total, paper) => total + paper.totalUserRelations, 0);

  return (
    <section className="grid gap-4">
      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardContent className="py-4 text-sm leading-6 text-muted-foreground">
          Retained user relations are not necessarily corruption and must not be deleted automatically. This view contains {totalRelations} relations across {papers.length} unpublished papers.
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-lg border-border/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <caption className="sr-only">User relation counts on unpublished papers</caption>
            <thead className="bg-muted/35 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium" scope="col">Title</th>
                <th className="px-3 py-3 font-medium" scope="col">Status</th>
                <th className="px-3 py-3 font-medium" scope="col">Category</th>
                <th className="px-3 py-3 text-right font-medium" scope="col">Bookmarks</th>
                <th className="px-3 py-3 text-right font-medium" scope="col">Notes</th>
                <th className="px-3 py-3 text-right font-medium" scope="col">Reading progress</th>
                <th className="px-3 py-3 text-right font-medium" scope="col">Total</th>
                <th className="px-4 py-3 text-right font-medium" scope="col">Paper</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {papers.map((paper) => (
                <tr key={paper.paperId}>
                  <th className="max-w-80 px-4 py-3 font-medium" scope="row">{paper.title}</th>
                  <td className="px-3 py-3"><AdminStatusBadge value={paper.status} /></td>
                  <td className="px-3 py-3">{paper.categoryName}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{paper.bookmarkCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{paper.noteCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{paper.readingProgressCount}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{paper.totalUserRelations}</td>
                  <td className="px-4 py-3 text-right"><PaperDestination paperId={paper.paperId} status={paper.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
