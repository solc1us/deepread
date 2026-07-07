"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { AlertCircle, ArrowLeft, BookOpen, Clock, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import PaperActions from "./paper-actions";
import PaperNotes from "./paper-notes";

type PaperDetailProps = {
  id: string;
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

export default function PaperDetail({ id }: PaperDetailProps) {
  const session = authClient.useSession();
  const paper = useQuery(trpc.papers.detail.queryOptions({ id }));

  if (paper.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader>
            <Skeleton className="h-8 w-5/6 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-11/12 rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (paper.isError || !paper.data) {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8">
        <Button className="w-fit rounded-md" nativeButton={false} variant="outline" render={<Link href="/papers" />}>
          <ArrowLeft data-icon="inline-start" />
          Back to papers
        </Button>
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Paper not found</div>
              <p className="text-sm leading-6 text-muted-foreground">
                This paper may not exist, may not be published, or the API server may be unavailable.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const classification = paper.data.classification;

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-8">
      <Button className="w-fit rounded-md" nativeButton={false} variant="outline" render={<Link href="/papers" />}>
        <ArrowLeft data-icon="inline-start" />
        Back to papers
      </Button>

      <article className="grid gap-5">
        <Card className="rounded-xl border-border/80 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-md border bg-background px-2.5 py-1 text-foreground">
                {paper.data.category.name}
              </span>
              <span className={cn("rounded-md px-2.5 py-1 capitalize", getDifficultyClass(classification?.difficultyLevel))}>
                {formatDifficulty(classification?.difficultyLevel)}
              </span>
              {classification ? (
                <>
                  <span className="rounded-md border bg-background px-2.5 py-1 text-foreground">
                    Score {classification.beginnerScore}/100
                  </span>
                  <span className="rounded-md border bg-background px-2.5 py-1 text-foreground">
                    {classification.estimatedReadingTime} min read
                  </span>
                </>
              ) : null}
            </div>
            <div className="grid gap-3">
              <h1 className="text-3xl font-semibold leading-tight tracking-normal md:text-4xl">
                {paper.data.title}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {paper.data.authors.join(", ")} {paper.data.publicationYear ? `- ${paper.data.publicationYear}` : ""}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 border-t pt-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen />
              Abstract
            </div>
            <p className="text-base leading-8 text-muted-foreground">{paper.data.abstract}</p>
          </CardContent>
        </Card>

        <PaperActions
          isAuthenticated={Boolean(session.data?.user)}
          isAuthPending={session.isPending}
          isBookmarked={paper.data.isBookmarked}
          paperId={paper.data.id}
          userProgress={paper.data.userProgress}
        />

        {classification ? (
          <Card className="rounded-lg border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Reading Fit</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-md border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">Difficulty</div>
                  <div className="mt-1 font-medium capitalize">{formatDifficulty(classification.difficultyLevel)}</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">Beginner score</div>
                  <div className="mt-1 font-medium">{classification.beginnerScore}/100</div>
                </div>
                <div className="rounded-md border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">Estimated time</div>
                  <div className="mt-1 font-medium">{classification.estimatedReadingTime} minutes</div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-md border bg-background p-3">
                  <div className="mb-1 text-sm font-medium">Why this fit</div>
                  <p className="text-sm leading-6 text-muted-foreground">{classification.classificationReason}</p>
                </div>
                <div className="rounded-md border bg-accent p-3">
                  <div className="mb-1 text-sm font-medium text-accent-foreground">Reading warning</div>
                  <p className="text-sm leading-6 text-muted-foreground">{classification.readingWarning}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <div className="mb-1 text-sm font-medium">Recommended reader</div>
                  <p className="text-sm leading-6 text-muted-foreground">{classification.recommendedReader}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Source and Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-md border bg-background px-3 py-3">
                <div className="text-xs text-muted-foreground">Provider</div>
                <div className="mt-1 font-medium">{paper.data.sourceName}</div>
              </div>
              {paper.data.doi ? (
                <div className="rounded-md border bg-background px-3 py-3">
                  <div className="text-xs text-muted-foreground">DOI</div>
                  <div className="mt-1 break-words font-medium">{paper.data.doi}</div>
                </div>
              ) : null}
            </div>

            {paper.data.keywords.length ? (
              <div className="flex flex-wrap gap-2">
                {paper.data.keywords.map((keyword) => (
                  <span className="rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-md"
                nativeButton={false}
                render={<a href={paper.data.sourceUrl} rel="noreferrer" target="_blank" />}
              >
                <ExternalLink data-icon="inline-start" />
                Open source
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
            </div>
          </CardContent>
        </Card>

        <PaperNotes
          isAuthenticated={Boolean(session.data?.user)}
          isAuthPending={session.isPending}
          paperId={paper.data.id}
        />
      </article>
    </main>
  );
}
