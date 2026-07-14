"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArchiveRestore, ChevronLeft, ChevronRight, CircleOff, FileText, Send } from "lucide-react";
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

type PaperStatusFilter = "" | "pending" | "needs_review" | "published" | "rejected" | "inactive";
type DifficultyFilter = "" | "beginner_friendly" | "moderate" | "difficult" | "expert";

const difficultyOptions: Array<{ value: DifficultyFilter; label: string }> = [
  { value: "", label: "All difficulties" },
  { value: "beginner_friendly", label: "Beginner friendly" },
  { value: "moderate", label: "Moderate" },
  { value: "difficult", label: "Difficult" },
  { value: "expert", label: "Expert" },
];

export default function PaperMonitor() {
  const [status, setStatus] = useState<PaperStatusFilter>("");
  const [categoryId, setCategoryId] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("");
  const [page, setPage] = useState(1);
  const categories = useQuery(trpc.categories.list.queryOptions());
  const papers = useQuery(
    trpc.admin.papers.list.queryOptions({
      page,
      limit: 20,
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(difficulty ? { difficulty } : {}),
    }),
  );

  const invalidatePaperStatusData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.admin.papers.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.admin.dashboard.getOverview.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.papers.list.queryKey(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: trpc.papers.detail.queryKey(), refetchType: "none" }),
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
  const publishPaper = useMutation(
    trpc.admin.papers.publish.mutationOptions({
      onSuccess: async () => {
        toast.success("Paper published");
        await invalidatePaperStatusData();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const statusMutationPending = deactivatePaper.isPending || reactivatePaper.isPending || publishPaper.isPending;

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

  const confirmPublish = (paperId: string) => {
    if (window.confirm("Publish this paper to the public library?")) {
      publishPaper.mutate({ paperId });
    }
  };

  const updateStatus = (value: PaperStatusFilter) => {
    setStatus(value);
    setPage(1);
  };
  const updateCategory = (value: string) => {
    setCategoryId(value);
    setPage(1);
  };
  const updateDifficulty = (value: DifficultyFilter) => {
    setDifficulty(value);
    setPage(1);
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader description="Monitor all paper records, including pending and rejected papers that are not public." title="Papers Monitor" />

      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-lg"><FileText className="text-primary" />Filters</CardTitle><p className="text-sm leading-6 text-muted-foreground">Results are limited to 20 papers per page.</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <label className={adminInputLabelClass}>Status<select className={adminSelectClassName} onChange={(event) => updateStatus(event.target.value as PaperStatusFilter)} value={status}><option value="">All statuses</option><option value="published">Published</option><option value="pending">Pending</option><option value="needs_review">Needs Review</option><option value="rejected">Rejected</option><option value="inactive">Inactive</option></select></label>
          <label className={adminInputLabelClass}>Category<select className={adminSelectClassName} disabled={categories.isLoading} onChange={(event) => updateCategory(event.target.value)} value={categoryId}><option value="">All categories</option>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={adminInputLabelClass}>Difficulty<select className={adminSelectClassName} onChange={(event) => updateDifficulty(event.target.value as DifficultyFilter)} value={difficulty}>{difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </CardContent>
      </Card>

      {papers.isLoading ? (
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
                  {paper.status === "published" ? <Link className="text-sm font-medium leading-6 hover:text-primary" href={`/papers/${paper.id}`}>{paper.title}</Link> : <span className="text-sm font-medium leading-6">{paper.title}</span>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Created {formatAdminDate(paper.createdAt)}</span>
                    <span>Updated {formatAdminDate(paper.updatedAt)}</span>
                  </div>
                  {paper.status === "published" || paper.status === "needs_review" || paper.status === "inactive" ? (
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      {paper.status === "published" ? (
                        <Button disabled={statusMutationPending} onClick={() => confirmDeactivate(paper.id)} size="sm" variant="outline"><CircleOff />Deactivate</Button>
                      ) : null}
                      {paper.status === "needs_review" && paper.hasValidClassification ? (
                        <Button disabled={statusMutationPending} onClick={() => confirmPublish(paper.id)} size="sm"><Send />Publish</Button>
                      ) : null}
                      {paper.status === "needs_review" ? (
                        <Button disabled={statusMutationPending} onClick={() => confirmDeactivate(paper.id)} size="sm" variant="outline"><CircleOff />Deactivate</Button>
                      ) : null}
                      {paper.status === "inactive" ? (
                        <Button disabled={statusMutationPending} onClick={() => confirmReactivate(paper.id)} size="sm" variant="outline"><ArchiveRestore />Reactivate</Button>
                      ) : null}
                      {paper.status === "needs_review" && !paper.hasValidClassification ? (
                        <span className="text-xs text-muted-foreground">A valid classification is required before publication.</span>
                      ) : null}
                    </div>
                  ) : null}
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
