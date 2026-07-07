"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  LogOut,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

type ReadingModeProps = {
  paperId: string;
};

function formatDifficulty(value: string | undefined) {
  return value?.replace("_", " ") ?? "Unclassified";
}

function getDifficultyClass(value: string | undefined) {
  switch (value) {
    case "beginner_friendly":
      return "bg-difficulty-beginner text-difficulty-beginner-foreground";
    case "moderate":
      return "bg-difficulty-moderate text-difficulty-moderate-foreground";
    case "difficult":
      return "bg-difficulty-difficult text-difficulty-difficult-foreground";
    case "expert":
      return "bg-difficulty-expert text-difficulty-expert-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatStatus(status: string | undefined) {
  if (!status) {
    return "Starting";
  }

  return status === "not_started" ? "Not started" : status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ReadingMode({ paperId }: ReadingModeProps) {
  const router = useRouter();
  const session = authClient.useSession();
  const isAuthenticated = Boolean(session.data?.user);
  const paper = useQuery(trpc.papers.detail.queryOptions({ id: paperId }));
  const progress = useQuery({
    ...trpc.reading.getForPaper.queryOptions({ paperId }),
    enabled: isAuthenticated,
  });
  const [sliderValue, setSliderValue] = useState(0);
  const initializedProgress = useRef(false);
  const startAttempted = useRef(false);

  const markPaperQueriesStale = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.papers.detail.queryKey({ id: paperId }),
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.papers.list.queryKey(),
        refetchType: "none",
      }),
    ]);
  };

  const startReading = useMutation(
    trpc.reading.start.mutationOptions({
      onSuccess: async (data) => {
        queryClient.setQueryData(trpc.reading.getForPaper.queryKey({ paperId }), data);
        await markPaperQueriesStale();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const saveProgress = useMutation(
    trpc.reading.updateProgress.mutationOptions({
      onSuccess: async (data) => {
        setSliderValue(data.progressPercentage);
        queryClient.setQueryData(trpc.reading.getForPaper.queryKey({ paperId }), data);
        await markPaperQueriesStale();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const completeReading = useMutation(
    trpc.reading.complete.mutationOptions({
      onSuccess: async (data) => {
        setSliderValue(100);
        queryClient.setQueryData(trpc.reading.getForPaper.queryKey({ paperId }), data);
        await markPaperQueriesStale();
        toast.success("Paper marked as completed");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const startReadingMutation = startReading.mutate;

  useEffect(() => {
    if (!session.isPending && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router, session.isPending]);

  useEffect(() => {
    if (!isAuthenticated || !progress.isSuccess || initializedProgress.current) {
      return;
    }

    initializedProgress.current = true;
    setSliderValue(progress.data?.progressPercentage ?? 0);
  }, [isAuthenticated, progress.data?.progressPercentage, progress.isSuccess]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !progress.isSuccess ||
      progress.data?.status === "completed" ||
      startAttempted.current
    ) {
      return;
    }

    startAttempted.current = true;
    startReadingMutation({ paperId });
  }, [isAuthenticated, paperId, progress.data?.status, progress.isSuccess, startReadingMutation]);

  const handleSave = (exitAfterSave: boolean) => {
    saveProgress.mutate(
      { paperId, progressPercentage: sliderValue },
      {
        onSuccess: () => {
          toast.success(exitAfterSave ? "Progress saved" : "Reading progress saved");
          if (exitAfterSave) {
            router.push(`/papers/${paperId}`);
          }
        },
      },
    );
  };

  if (session.isPending || (isAuthenticated && progress.isPending) || paper.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-8">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-3">
            <Skeleton className="h-8 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto grid min-h-[60vh] w-full max-w-xl place-content-center gap-4 px-4 py-8 text-center">
        <BookOpen className="mx-auto text-primary" size={32} />
        <h1 className="text-2xl font-semibold">Sign in to use reading mode</h1>
        <p className="text-sm leading-6 text-muted-foreground">Redirecting you to sign in...</p>
      </main>
    );
  }

  if (paper.isError || !paper.data || progress.isError) {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8">
        <Button
          className="w-fit rounded-md"
          nativeButton={false}
          variant="outline"
          render={<Link href={`/papers/${paperId}`} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to paper detail
        </Button>
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Reading mode is unavailable</div>
              <p className="text-sm leading-6 text-muted-foreground">
                The paper may be unavailable, or your reading progress could not be loaded.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const classification = paper.data.classification;
  const savedProgress = progress.data?.progressPercentage ?? 0;
  const currentStatus = progress.data?.status ?? startReading.data?.status;
  const isBusy = startReading.isPending || saveProgress.isPending || completeReading.isPending;
  const hasUnsavedProgress = sliderValue !== savedProgress;

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          className="rounded-md"
          nativeButton={false}
          variant="outline"
          render={<Link href={`/papers/${paperId}`} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to paper detail
        </Button>
        <span className="text-sm text-muted-foreground">Manual progress only</span>
      </div>

      <article className="grid gap-5">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-md border bg-background px-2.5 py-1">{paper.data.category.name}</span>
              <span className={cn("rounded-md px-2.5 py-1 capitalize", getDifficultyClass(classification?.difficultyLevel))}>
                {formatDifficulty(classification?.difficultyLevel)}
              </span>
              {classification ? (
                <>
                  <span className="rounded-md border bg-background px-2.5 py-1">
                    Score {classification.beginnerScore}/100
                  </span>
                  <span className="rounded-md border bg-background px-2.5 py-1">
                    <Clock className="mr-1 inline size-3.5" />
                    {classification.estimatedReadingTime} min read
                  </span>
                </>
              ) : null}
            </div>
            <div className="grid gap-2">
              <h1 className="text-3xl font-semibold leading-tight tracking-normal md:text-4xl">{paper.data.title}</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {paper.data.authors.join(", ") || "Unknown authors"}
                {paper.data.publicationYear ? ` - ${paper.data.publicationYear}` : ""}
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 border-t pt-5">
            <Button
              className="rounded-md"
              nativeButton={false}
              render={<a href={paper.data.sourceUrl} rel="noreferrer" target="_blank" />}
            >
              <ExternalLink data-icon="inline-start" />
              Open Source
            </Button>
            {paper.data.pdfUrl ? (
              <Button
                className="rounded-md"
                nativeButton={false}
                variant="outline"
                render={<a href={paper.data.pdfUrl} rel="noreferrer" target="_blank" />}
              >
                <FileText data-icon="inline-start" />
                Open PDF
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Reading Progress</CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-md border bg-background px-2.5 py-1 font-medium">
                  {formatStatus(currentStatus)}
                </span>
                {hasUnsavedProgress ? <span className="text-muted-foreground">Unsaved</span> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3">
              <div className="flex items-end justify-between gap-4">
                <label className="text-sm font-medium" htmlFor="reading-progress">
                  Manual progress
                </label>
                <output className="text-2xl font-semibold text-primary" htmlFor="reading-progress">
                  {sliderValue}%
                </output>
              </div>
              <input
                aria-label="Reading progress percentage"
                className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy}
                id="reading-progress"
                max={100}
                min={0}
                onChange={(event) => setSliderValue(Number(event.target.value))}
                step={1}
                type="range"
                value={sliderValue}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Progress is saved only when you choose an action below. Opening the source or PDF does not change it.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-5">
              <Button className="rounded-md" disabled={isBusy} onClick={() => handleSave(false)}>
                <Save data-icon="inline-start" />
                {saveProgress.isPending ? "Saving..." : "Save Progress"}
              </Button>
              <Button className="rounded-md" disabled={isBusy} onClick={() => handleSave(true)} variant="outline">
                <LogOut data-icon="inline-start" />
                Save & Exit
              </Button>
              <Button
                className="rounded-md"
                disabled={isBusy || (currentStatus === "completed" && sliderValue === 100)}
                onClick={() => completeReading.mutate({ paperId })}
                variant="outline"
              >
                <CheckCircle2 data-icon="inline-start" />
                {currentStatus === "completed" && sliderValue === 100 ? "Completed" : "Mark Completed"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen />
              Abstract
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-8 text-muted-foreground">{paper.data.abstract}</p>
          </CardContent>
        </Card>
      </article>
    </main>
  );
}
