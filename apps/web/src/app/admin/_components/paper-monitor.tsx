"use client";

import { toCategorySlug } from "@deepread/api/category-slug";
import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArchiveRestore, ChevronLeft, ChevronRight, CircleOff, FileText } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { queryClient, trpc } from "@/utils/trpc";

import {
  AdminPageHeader,
  AdminStatusBadge,
  adminInputLabelClass,
  adminSelectClassName,
  formatAdminDate,
  formatAdminDifficulty,
  getAdminDifficultyClass,
} from "./admin-ui";
import { invalidateAdminRemediationQueries } from "./admin-remediation-cache";
import { PaperMetadataEditor } from "./paper-metadata-editor";
import { PaperRemediationActions } from "./paper-remediation-actions";

type PaperStatusFilter = "" | "pending" | "needs_review" | "published" | "rejected" | "inactive";
type DifficultyFilter = "" | "beginner_friendly" | "moderate" | "difficult" | "expert";

const difficultyOptions: Array<{ value: DifficultyFilter; label: string }> = [
  { value: "", label: "All difficulties" },
  { value: "beginner_friendly", label: "Beginner friendly" },
  { value: "moderate", label: "Moderate" },
  { value: "difficult", label: "Difficult" },
  { value: "expert", label: "Expert" },
];

export default function PaperMonitor({
  initialStatus = "",
  initialCategorySlug = "",
  initialDifficulty = "",
  initialPage = 1,
}: {
  initialStatus?: PaperStatusFilter;
  initialCategorySlug?: string;
  initialDifficulty?: DifficultyFilter;
  initialPage?: number;
}) {
  const [status, setStatus] = useState<PaperStatusFilter>(initialStatus);
  const [categorySlug, setCategorySlug] = useState(initialCategorySlug);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(initialDifficulty);
  const [page, setPage] = useState(initialPage);
  const categories = useQuery(trpc.categories.list.queryOptions());
  const categoryId = categories.data?.find((category) => toCategorySlug(category.name) === categorySlug)?.id;
  const categoryFilterReady = !categorySlug || categories.isSuccess;
  const papers = useQuery({
    ...trpc.admin.papers.list.queryOptions({
      page,
      limit: 20,
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(difficulty ? { difficulty } : {}),
    }),
    enabled: categoryFilterReady,
  });

  const invalidatePaperStatusData = async () => {
    await Promise.all([
      invalidateAdminRemediationQueries(),
      queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.bookmark.list.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.notes.listMineGroupedByPaper.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.profile.getOverview.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.statistics.getMine.queryKey(), refetchType: "none" }),
    ]);
  };
  const deactivatePaper = useMutation(
    trpc.admin.papers.deactivate.mutationOptions({
      onSuccess: async () => {
        toast.success("Paper deactivated");
        await invalidatePaperStatusData();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const reactivatePaper = useMutation(
    trpc.admin.papers.reactivate.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.status === "published" ? "Paper reactivated and published" : "Paper moved to needs review");
        await invalidatePaperStatusData();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const statusMutationPending = deactivatePaper.isPending || reactivatePaper.isPending;

  const confirmDeactivate = (paperId: string) => {
    if (window.confirm("Deactivate this paper? It will no longer be visible in the public library.")) {
      deactivatePaper.mutate({ paperId });
    }
  };

  const confirmReactivate = (paperId: string) => {
    if (window.confirm("Reactivate this paper? Classified papers will be published; otherwise they will need review.")) {
      reactivatePaper.mutate({ paperId });
    }
  };

  const updateStatus = (value: PaperStatusFilter) => {
    setStatus(value);
    setPage(1);
  };
  const updateCategory = (value: string) => {
    setCategorySlug(value);
    setPage(1);
  };
  const updateDifficulty = (value: DifficultyFilter) => {
    setDifficulty(value);
    setPage(1);
  };
  const returnParameters = new URLSearchParams();
  if (status) returnParameters.set("status", status);
  if (categorySlug) returnParameters.set("category", categorySlug);
  if (difficulty) returnParameters.set("difficulty", difficulty);
  if (page > 1) returnParameters.set("page", String(page));
  const returnTo = `/admin/papers${returnParameters.size > 0 ? `?${returnParameters.toString()}` : ""}`;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader description="Monitor all paper records, including pending and rejected papers that are not public." title="Papers Monitor" />

      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-lg"><FileText className="text-primary" />Filters</CardTitle><p className="text-sm leading-6 text-muted-foreground">Results are limited to 20 papers per page.</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <label className={adminInputLabelClass}>Status<select className={adminSelectClassName} onChange={(event) => updateStatus(event.target.value as PaperStatusFilter)} value={status}><option value="">All statuses</option><option value="published">Published</option><option value="pending">Pending</option><option value="needs_review">Needs Review</option><option value="rejected">Rejected</option><option value="inactive">Inactive</option></select></label>
          <label className={adminInputLabelClass}>Category<select className={adminSelectClassName} disabled={categories.isLoading} onChange={(event) => updateCategory(event.target.value)} value={categorySlug}><option value="">All categories</option>{categories.data?.map((category) => <option key={category.id} value={toCategorySlug(category.name)}>{category.name}</option>)}</select></label>
          <label className={adminInputLabelClass}>Difficulty<select className={adminSelectClassName} onChange={(event) => updateDifficulty(event.target.value as DifficultyFilter)} value={difficulty}>{difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </CardContent>
      </Card>

      {!categoryFilterReady || papers.isLoading ? (
        <section className="grid gap-3">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-24 rounded-lg" key={index} />)}</section>
      ) : papers.isError || !papers.data ? (
        <Card className="rounded-lg border-border/80 shadow-sm"><CardContent className="flex items-start gap-3 py-4"><AlertCircle className="mt-0.5 text-destructive" /><div className="grid gap-1"><div className="text-sm font-medium">Paper monitor unavailable</div><p className="text-sm leading-6 text-muted-foreground">Confirm your admin session and server connection.</p></div></CardContent></Card>
      ) : (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Paper Records</h2><span className="text-sm text-muted-foreground">{papers.data.pagination.total} matching papers</span></div>
          {papers.data.papers.length ? (
            <div className="grid gap-3">
              {papers.data.papers.map((paper) => (
                <article className="grid gap-2 rounded-lg border border-border/80 bg-card p-4 shadow-sm" key={paper.id}>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <AdminStatusBadge value={paper.status} />
                    <span className="rounded-md border bg-background px-2.5 py-1">{paper.category.name}</span>
                    <span className={cn("rounded-md px-2.5 py-1 capitalize", getAdminDifficultyClass(paper.difficultyLevel))}>{formatAdminDifficulty(paper.difficultyLevel)}</span>
                    {paper.beginnerScore !== null ? <span className="rounded-md border bg-background px-2.5 py-1">Score {paper.beginnerScore}/100</span> : null}
                  </div>
                  <Link
                    className="text-sm font-medium leading-6 underline-offset-4 hover:text-primary hover:underline"
                    href={`/admin/papers/${paper.id}?returnTo=${encodeURIComponent(returnTo)}` as Route}
                  >
                    {paper.title}
                  </Link>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Created {formatAdminDate(paper.createdAt)}</span>
                    <span>Updated {formatAdminDate(paper.updatedAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {paper.status !== "needs_review" ? (
                      <PaperMetadataEditor disabled={statusMutationPending} paperId={paper.id} paperTitle={paper.title} />
                    ) : null}
                      {paper.status === "published" ? (
                        <Button disabled={statusMutationPending} onClick={() => confirmDeactivate(paper.id)} size="sm" variant="outline"><CircleOff />Deactivate</Button>
                      ) : null}
                      {paper.status === "needs_review" ? (
                        <PaperRemediationActions paperId={paper.id} paperTitle={paper.title} />
                      ) : null}
                      {paper.status === "inactive" ? (
                        <Button disabled={statusMutationPending} onClick={() => confirmReactivate(paper.id)} size="sm" variant="outline"><ArchiveRestore />Reactivate</Button>
                      ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <Card className="rounded-lg border-border/80 shadow-sm"><CardContent className="py-6 text-sm leading-6 text-muted-foreground">No papers match these filters.</CardContent></Card>}
          {papers.data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <Button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} variant="outline"><ChevronLeft data-icon="inline-start" />Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page} of {papers.data.pagination.totalPages}</span>
              <Button disabled={page >= papers.data.pagination.totalPages} onClick={() => setPage((current) => current + 1)} variant="outline">Next<ChevronRight data-icon="inline-end" /></Button>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
