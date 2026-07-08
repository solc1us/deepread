"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  FolderOpen,
  StickyNote,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { trpc } from "@/utils/trpc";

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

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

function formatActivityType(value: string) {
  return value.replace("_", " ");
}

function getBarWidth(count: number, max: number) {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.max(8, Math.round((count / max) * 100))}%`;
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="rounded-lg border-dashed border-border/80 shadow-none">
      <CardContent className="grid gap-3 py-6">
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        <Button className="w-fit" nativeButton={false} render={<Link href="/papers" />} variant="outline">
          Browse Papers
        </Button>
      </CardContent>
    </Card>
  );
}

type ActivityItem = {
  type: string;
  date: string;
  paper: {
    id: string;
    title: string;
  };
};

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <div className="grid gap-1 rounded-md border border-border/80 bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium capitalize">
          {formatActivityType(item.type)}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
      </div>
      <Link className="text-sm font-medium leading-6 hover:text-primary" href={`/papers/${item.paper.id}`}>
        {item.paper.title}
      </Link>
    </div>
  );
}

function ActivityDialog({
  activities,
  isOpen,
  onClose,
}: {
  activities: ActivityItem[];
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="reading-activity-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="grid max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold" id="reading-activity-dialog-title">
              Reading Activity
            </h2>
            <p className="text-sm text-muted-foreground">Recent progress, bookmarks, notes, and completions.</p>
          </div>
          <Button aria-label="Close reading activity" onClick={onClose} size="icon" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {activities.length ? (
            <div className="grid gap-3">
              {activities.map((item) => (
                <ActivityCard item={item} key={`${item.type}-${item.paper.id}-${item.date}`} />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">No reading activity yet.</p>
          )}
        </div>
        <div className="flex justify-end border-t bg-muted/20 px-5 py-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StatisticsOverview() {
  const statistics = useQuery(trpc.statistics.getMine.queryOptions());
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const closeActivityDialog = useCallback(() => {
    setIsActivityDialogOpen(false);
  }, []);

  if (statistics.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-56 rounded-md" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-24 rounded-lg" key={index} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </main>
    );
  }

  if (statistics.isError || !statistics.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Statistics unavailable</div>
              <p className="text-sm leading-6 text-muted-foreground">Your reading statistics could not be loaded.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const {
    summary,
    difficultyDistribution,
    categoryDistribution,
    recentReadingActivity,
    recentCompletedPapers,
  } = statistics.data;
  const hasActivity =
    summary.totalCompleted > 0 ||
    summary.totalReading > 0 ||
    summary.totalBookmarked > 0 ||
    summary.totalNotes > 0;
  const maxDifficultyCount = Math.max(0, ...difficultyDistribution.map((item) => item.count));
  const maxCategoryCount = Math.max(0, ...categoryDistribution.map((item) => item.count));
  const visibleActivity = recentReadingActivity.slice(0, 5);
  const summaryItems = [
    { label: "Completed papers", value: summary.totalCompleted, icon: CheckCircle2 },
    { label: "Currently reading", value: summary.totalReading, icon: BookOpen },
    { label: "Bookmarked papers", value: summary.totalBookmarked, icon: Bookmark },
    { label: "Notes written", value: summary.totalNotes, icon: StickyNote },
    {
      label: "Estimated completed reading time",
      value: `${summary.estimatedCompletedReadingTime} min`,
      icon: Clock,
      detail: "Based on paper difficulty estimates",
    },
    { label: "Average active reading progress", value: `${summary.averageReadingProgress}%`, icon: TrendingUp },
  ] as const;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <section className="grid gap-2 border-b pb-6">
        <p className="text-sm font-medium text-primary">Personal Overview</p>
        <h1 className="text-3xl font-semibold tracking-normal">Reading Statistics</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          A compact overview of your DeepRead activity. Reading time is estimated from paper difficulty data, not
          tracked session duration.
        </p>
      </section>

      <section aria-label="Statistics summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card className="rounded-lg border-border/80 shadow-sm" key={item.label} size="sm">
              <CardContent className="flex min-h-24 items-center justify-between gap-4 py-2">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-2xl font-semibold">{item.value}</span>
                  {"detail" in item ? <span className="text-xs text-muted-foreground">{item.detail}</span> : null}
                </div>
                <Icon aria-hidden="true" className="text-primary" />
              </CardContent>
            </Card>
          );
        })}
      </section>

      {!hasActivity ? (
        <EmptyState message="No reading activity yet. Browse papers, save progress, bookmark a paper, or write a note to start building your statistics." />
      ) : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 aria-hidden="true" className="text-primary" />
              Difficulty Distribution
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Completed papers by classified difficulty.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {difficultyDistribution.some((item) => item.count > 0) ? (
              difficultyDistribution.map((item) => (
                <div className="grid gap-1.5" key={item.difficultyLevel}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                        getDifficultyClass(item.difficultyLevel),
                      )}
                    >
                      {formatDifficulty(item.difficultyLevel)}
                    </span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: getBarWidth(item.count, maxDifficultyCount) }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Complete a paper to see your difficulty distribution.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen aria-hidden="true" className="text-primary" />
              Category Distribution
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Categories from papers you are reading or completed.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {categoryDistribution.length ? (
              categoryDistribution.map((item) => (
                <div className="grid gap-1.5" key={item.categoryId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{item.categoryName}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: getBarWidth(item.count, maxCategoryCount) }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Start or complete a paper to see category activity.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle className="text-lg">Recent Reading Activity</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Latest progress, bookmarks, notes, and completions.
                </p>
              </div>
              <Button
                disabled={!recentReadingActivity.length}
                onClick={() => setIsActivityDialogOpen(true)}
                size="sm"
                variant="outline"
              >
                View all activity
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {visibleActivity.length ? (
              <div className="grid gap-3">
                {visibleActivity.map((item) => (
                  <ActivityCard item={item} key={`${item.type}-${item.paper.id}-${item.date}`} />
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">No recent reading activity yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="text-lg">Recent Completed Papers</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">Papers you most recently marked as completed.</p>
          </CardHeader>
          <CardContent>
            {recentCompletedPapers.length ? (
              <div className="grid gap-3">
                {recentCompletedPapers.map((item) => (
                  <div className="grid gap-2 rounded-md border border-border/80 bg-background p-3" key={item.paper.id}>
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="rounded-md border bg-card px-2.5 py-1">{item.paper.category.name}</span>
                      <span
                        className={cn(
                          "rounded-md px-2.5 py-1 capitalize",
                          getDifficultyClass(item.paper.classification?.difficultyLevel),
                        )}
                      >
                        {formatDifficulty(item.paper.classification?.difficultyLevel)}
                      </span>
                      {item.paper.classification ? (
                        <span className="rounded-md border bg-card px-2.5 py-1">
                          {item.paper.classification.estimatedReadingTime} min estimate
                        </span>
                      ) : null}
                    </div>
                    <Link className="text-sm font-medium leading-6 hover:text-primary" href={`/papers/${item.paper.id}`}>
                      {item.paper.title}
                    </Link>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Completed {item.completedAt ? formatDate(item.completedAt) : "recently"}</span>
                      {item.paper.classification ? (
                        <span>Beginner score {item.paper.classification.beginnerScore}/100</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">No completed papers yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
      <ActivityDialog
        activities={recentReadingActivity}
        isOpen={isActivityDialogOpen}
        onClose={closeActivityDialog}
      />
    </main>
  );
}
