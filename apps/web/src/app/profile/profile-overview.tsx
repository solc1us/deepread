"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bookmark, BookOpen, CheckCircle2, Clock, FileText, StickyNote } from "lucide-react";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

type PaperSummary = {
  id: string;
  title: string;
  category: {
    id: string;
    name: string;
  };
  classification: {
    difficultyLevel: "beginner_friendly" | "moderate" | "difficult" | "expert";
    beginnerScore: number;
    estimatedReadingTime: number;
  } | null;
};

type ProfilePaperCardProps = {
  paper: PaperSummary;
  detail?: string;
  primaryHref: `/papers/${string}` | `/papers/${string}/read`;
  primaryLabel: string;
  showDetailAction?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

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

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return dateFormatter.format(new Date(value));
}

function ProfilePaperCard({
  paper,
  detail,
  primaryHref,
  primaryLabel,
  showDetailAction = true,
}: ProfilePaperCardProps) {
  return (
    <Card className="rounded-lg border-border/80 shadow-sm" size="sm">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-md border bg-background px-2.5 py-1">{paper.category.name}</span>
          <span
            className={cn(
              "rounded-md px-2.5 py-1 capitalize",
              getDifficultyClass(paper.classification?.difficultyLevel),
            )}
          >
            {formatDifficulty(paper.classification?.difficultyLevel)}
          </span>
        </div>
        <CardTitle className="text-base leading-6">
          <Link className="hover:text-primary" href={`/papers/${paper.id}`}>
            {paper.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {paper.classification ? (
          <>
            <span>Beginner score {paper.classification.beginnerScore}/100</span>
            <span className="flex items-center gap-1">
              <Clock />
              {paper.classification.estimatedReadingTime} min read
            </span>
          </>
        ) : null}
        {detail ? <span>{detail}</span> : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button nativeButton={false} render={<Link href={primaryHref} />}>
          <BookOpen data-icon="inline-start" />
          {primaryLabel}
        </Button>
        {showDetailAction ? (
          <Button nativeButton={false} render={<Link href={`/papers/${paper.id}`} />} variant="outline">
            <FileText data-icon="inline-start" />
            Paper Detail
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <Card className="rounded-lg border-dashed border-border/80 shadow-none" size="sm">
      <CardContent className="py-3 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

export default function ProfileOverview() {
  const overview = useQuery(trpc.profile.getOverview.queryOptions());

  if (overview.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-24 rounded-lg" key={index} />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
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
              <div className="text-sm font-medium">Profile unavailable</div>
              <p className="text-sm leading-6 text-muted-foreground">Your reading activity could not be loaded.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { user, summary, bookmarkedPapers, readingPapers, completedPapers } = overview.data;
  const summaryItems = [
    { label: "Bookmarked", value: summary.totalBookmarked, icon: Bookmark },
    { label: "Currently reading", value: summary.totalReading, icon: BookOpen },
    { label: "Completed", value: summary.totalCompleted, icon: CheckCircle2 },
    { label: "Notes", value: summary.totalNotes, icon: StickyNote },
  ] as const;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-primary">Reader Profile</p>
          <h1 className="text-3xl font-semibold tracking-normal">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <span className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium capitalize">{user.role}</span>
      </section>

      <section aria-labelledby="reading-summary-heading" className="grid gap-4">
        <h2 className="text-lg font-semibold" id="reading-summary-heading">
          Reading Summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <Card className="rounded-lg border-border/80 shadow-sm" key={item.label} size="sm">
                <CardContent className="flex items-center justify-between gap-4 py-2">
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-2xl font-semibold">{item.value}</span>
                  </div>
                  <Icon className="text-primary" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="currently-reading-heading" className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold" id="currently-reading-heading">
            Currently Reading
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Continue from your manually saved progress.</p>
        </div>
        {readingPapers.length ? (
          <div className="grid gap-3">
            {readingPapers.map((item) => (
              <ProfilePaperCard
                detail={`${item.progressPercentage}% progress${item.lastReadAt ? ` - Last read ${formatDate(item.lastReadAt)}` : ""}`}
                key={item.paper.id}
                paper={item.paper}
                primaryHref={`/papers/${item.paper.id}/read`}
                primaryLabel="Continue Reading"
              />
            ))}
          </div>
        ) : (
          <EmptySection message="No active reading progress yet." />
        )}
      </section>

      <section aria-labelledby="bookmarked-heading" className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold" id="bookmarked-heading">
            Bookmarked Papers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Papers saved for later reading.</p>
        </div>
        {bookmarkedPapers.length ? (
          <div className="grid gap-3">
            {bookmarkedPapers.map((item) => (
              <ProfilePaperCard
                detail={`Bookmarked ${formatDate(item.bookmarkedAt)}`}
                key={item.bookmarkId}
                paper={item.paper}
                primaryHref={`/papers/${item.paper.id}`}
                primaryLabel="View Paper"
                showDetailAction={false}
              />
            ))}
          </div>
        ) : (
          <EmptySection message="No bookmarks yet." />
        )}
      </section>

      <section aria-labelledby="completed-heading" className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold" id="completed-heading">
            Completed Papers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Papers you have marked as completed.</p>
        </div>
        {completedPapers.length ? (
          <div className="grid gap-3">
            {completedPapers.map((item) => (
              <ProfilePaperCard
                detail={item.completedAt ? `Completed ${formatDate(item.completedAt)}` : "Completed"}
                key={item.paper.id}
                paper={item.paper}
                primaryHref={`/papers/${item.paper.id}/read`}
                primaryLabel="View Reading"
              />
            ))}
          </div>
        ) : (
          <EmptySection message="No completed papers yet." />
        )}
      </section>
    </main>
  );
}
