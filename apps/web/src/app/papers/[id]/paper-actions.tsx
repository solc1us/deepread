"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Bookmark, BookmarkCheck, BookOpen, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markProfileOverviewStale, queryClient, trpc } from "@/utils/trpc";

type PaperActionsProps = {
  paperId: string;
  isAuthenticated: boolean;
  isAuthPending: boolean;
  isBookmarked: boolean;
  userProgress: {
    status: "not_started" | "reading" | "completed";
    progressPercentage: number;
  } | null;
};

function formatStatus(progress: PaperActionsProps["userProgress"]) {
  if (!progress) {
    return "Not started";
  }

  return progress.status === "not_started"
    ? "Not started"
    : progress.status.charAt(0).toUpperCase() + progress.status.slice(1);
}

export default function PaperActions({
  paperId,
  isAuthenticated,
  isAuthPending,
  isBookmarked,
  userProgress,
}: PaperActionsProps) {
  const router = useRouter();

  const refreshPaperState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.papers.detail.queryKey({ id: paperId }) }),
      queryClient.invalidateQueries({ queryKey: trpc.papers.list.queryKey() }),
      markProfileOverviewStale(),
    ]);
  };

  const completeReading = useMutation(
    trpc.reading.complete.mutationOptions({
      onSuccess: async () => {
        await refreshPaperState();
        toast.success("Paper marked as completed");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const addBookmark = useMutation(
    trpc.bookmark.add.mutationOptions({
      onSuccess: async () => {
        await refreshPaperState();
        toast.success("Paper bookmarked");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const removeBookmark = useMutation(
    trpc.bookmark.remove.mutationOptions({
      onSuccess: async () => {
        await refreshPaperState();
        toast.success("Bookmark removed");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const requireLogin = () => {
    if (isAuthenticated) {
      return true;
    }

    toast.info("Sign in to track reading and bookmarks");
    router.push("/login");
    return false;
  };

  const isBusy =
    isAuthPending ||
    completeReading.isPending ||
    addBookmark.isPending ||
    removeBookmark.isPending;
  const isCompleted = userProgress?.status === "completed";
  const readingLabel = isCompleted
    ? "View Reading"
    : userProgress?.status === "reading"
      ? "Continue Reading"
      : "Start Reading";

  return (
    <Card className="rounded-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Reading Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md border bg-background px-2.5 py-1 font-medium">
            {formatStatus(userProgress)}
          </span>
          {userProgress ? (
            <span className="text-muted-foreground">{userProgress.progressPercentage}% progress</span>
          ) : null}
          {isAuthPending ? (
            <span className="text-muted-foreground">Checking your activity...</span>
          ) : !isAuthenticated ? (
            <span className="text-muted-foreground">Sign in to save your activity.</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-md"
            disabled={isBusy}
            onClick={() => {
              if (requireLogin()) {
                router.push(`/papers/${paperId}/read` as Route);
              }
            }}
          >
            <BookOpen data-icon="inline-start" />
            {readingLabel}
          </Button>
          <Button
            className="rounded-md"
            disabled={isBusy || (isAuthenticated && isCompleted)}
            onClick={() => {
              if (requireLogin()) {
                completeReading.mutate({ paperId });
              }
            }}
            variant="outline"
          >
            <CheckCircle2 data-icon="inline-start" />
            {isCompleted ? "Completed" : "Mark as Completed"}
          </Button>
          <Button
            className="rounded-md"
            disabled={isBusy}
            onClick={() => {
              if (!requireLogin()) {
                return;
              }

              if (isBookmarked) {
                removeBookmark.mutate({ paperId });
              } else {
                addBookmark.mutate({ paperId });
              }
            }}
            variant="outline"
          >
            {isBookmarked ? <BookmarkCheck data-icon="inline-start" /> : <Bookmark data-icon="inline-start" />}
            {isBookmarked ? "Remove Bookmark" : "Bookmark"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
