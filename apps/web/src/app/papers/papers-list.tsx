"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Input } from "@deepread/ui/components/input";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { AlertCircle, Bookmark, BookmarkCheck, Clock, Search } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { markProfileOverviewStale, queryClient, trpc } from "@/utils/trpc";

const difficulties = [
  { value: "", label: "All difficulties" },
  { value: "beginner_friendly", label: "Beginner friendly" },
  { value: "moderate", label: "Moderate" },
  { value: "difficult", label: "Difficult" },
  { value: "expert", label: "Expert" },
] as const;

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "beginner_score", label: "Beginner score" },
  { value: "title", label: "Title" },
] as const;

type Difficulty = Exclude<(typeof difficulties)[number]["value"], "">;
type Sort = (typeof sorts)[number]["value"];

type PapersListProps = {
  initialFilters: {
    q?: string;
    categoryId?: string;
    difficulty?: string;
    sort?: string;
    page?: string;
  };
};

function getPage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatDifficulty(value: string | null | undefined) {
  return value?.replace("_", " ") ?? "Unclassified";
}

function getDifficulty(value: string | undefined): Difficulty | undefined {
  switch (value) {
    case "beginner_friendly":
    case "moderate":
    case "difficult":
    case "expert":
      return value;
    default:
      return undefined;
  }
}

function getSort(value: string | undefined): Sort {
  return sorts.find((item) => item.value === value)?.value ?? "newest";
}

function getDifficultyClass(value: string | null | undefined) {
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

function buildHref(filters: PapersListProps["initialFilters"], page: number) {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries({ ...filters, page: String(page) })) {
    if (value) {
      query[key] = value;
    }
  }

  return {
    pathname: "/papers",
    query,
  };
}

function PaperListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card className="rounded-lg border-border/80 shadow-sm" key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PapersList({ initialFilters }: PapersListProps) {
  const router = useRouter();
  const session = authClient.useSession();
  const isAuthenticated = Boolean(session.data?.user);
  const page = getPage(initialFilters.page);
  const difficulty = getDifficulty(initialFilters.difficulty);
  const sort = getSort(initialFilters.sort);

  const categories = useQuery(trpc.categories.list.queryOptions());
  const papers = useQuery(
    trpc.papers.list.queryOptions({
      q: initialFilters.q || undefined,
      categoryId: initialFilters.categoryId || undefined,
      difficulty: difficulty || undefined,
      sort,
      page,
      limit: 10,
    }),
  );
  const refreshPapers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.papers.list.queryKey() }),
      markProfileOverviewStale(),
    ]);
  };
  const addBookmark = useMutation(
    trpc.bookmark.add.mutationOptions({
      onSuccess: async () => {
        await refreshPapers();
        toast.success("Paper bookmarked");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const removeBookmark = useMutation(
    trpc.bookmark.remove.mutationOptions({
      onSuccess: async () => {
        await refreshPapers();
        toast.success("Bookmark removed");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const toggleBookmark = (paperId: string, isBookmarked: boolean) => {
    if (!isAuthenticated) {
      toast.info("Sign in to bookmark papers");
      router.push("/login");
      return;
    }

    if (isBookmarked) {
      removeBookmark.mutate({ paperId });
    } else {
      addBookmark.mutate({ paperId });
    }
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8">
      <section className="grid gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent-foreground">
          Paper Library
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">Find approachable papers</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Search the seeded library and compare category, difficulty, beginner score, and reading time before
              opening a paper.
            </p>
          </div>
          {papers.data ? (
            <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
              {papers.data.pagination.total} published papers
            </div>
          ) : null}
        </div>
      </section>

      <form className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-[1fr_220px_180px_150px_auto]">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Search
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-md bg-background pl-8 text-sm"
              defaultValue={initialFilters.q ?? ""}
              name="q"
              placeholder="Title, abstract, or source"
            />
          </div>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Category
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            defaultValue={initialFilters.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">All categories</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Difficulty
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            defaultValue={difficulty ?? ""}
            name="difficulty"
          >
            {difficulties.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Sort
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            defaultValue={sort}
            name="sort"
          >
            {sorts.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button className="h-10 w-full rounded-md" type="submit">
            Filter
          </Button>
        </div>
      </form>

      {papers.isLoading ? (
        <PaperListSkeleton />
      ) : papers.isError ? (
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Unable to load papers</div>
              <p className="text-sm text-muted-foreground">Check that the API server is running and try again.</p>
            </div>
          </CardContent>
        </Card>
      ) : papers.data?.papers.length ? (
        <div className="grid gap-3">
          {papers.data.papers.map((paper) => (
            <Card className="rounded-lg border-border/80 shadow-sm transition-colors hover:border-primary/30" key={paper.id}>
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="grid gap-2">
                    <CardTitle className="text-lg leading-7 tracking-normal md:text-xl">{paper.title}</CardTitle>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {paper.authors.join(", ")} {paper.publicationYear ? `- ${paper.publicationYear}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md border bg-background px-2.5 py-1 text-foreground">
                      {paper.category.name}
                    </span>
                    <span className={cn("rounded-md px-2.5 py-1 capitalize", getDifficultyClass(paper.difficultyLevel))}>
                      {formatDifficulty(paper.difficultyLevel)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{paper.abstract}</p>
                <div className={cn("grid gap-2 text-sm sm:grid-cols-3", isAuthenticated && "lg:grid-cols-4")}>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs text-muted-foreground">Beginner score</div>
                    <div className="font-medium">{paper.beginnerScore !== null ? `${paper.beginnerScore}/100` : "Pending"}</div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs text-muted-foreground">Estimated time</div>
                    <div className="font-medium">
                      {paper.estimatedReadingTime !== null ? `${paper.estimatedReadingTime} minutes` : "Pending"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs text-muted-foreground">Source</div>
                    <div className="truncate font-medium">{paper.sourceName}</div>
                  </div>
                  {isAuthenticated ? (
                    <div className="rounded-md border bg-background px-3 py-2">
                      <div className="text-xs text-muted-foreground">Your reading</div>
                      <div className="font-medium capitalize">
                        {paper.userProgress?.status.replace("_", " ") ?? "Not started"}
                      </div>
                      {paper.userProgress ? (
                        <div className="text-xs text-muted-foreground">{paper.userProgress.progressPercentage}% progress</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="justify-between gap-3 bg-muted/35">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock />
                  <span>Review fit before reading</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label={paper.isBookmarked ? "Remove bookmark" : "Bookmark paper"}
                    disabled={
                      session.isPending ||
                      (addBookmark.isPending && addBookmark.variables?.paperId === paper.id) ||
                      (removeBookmark.isPending && removeBookmark.variables?.paperId === paper.id)
                    }
                    onClick={() => toggleBookmark(paper.id, paper.isBookmarked)}
                    size="icon"
                    title={paper.isBookmarked ? "Remove bookmark" : "Bookmark paper"}
                    variant="outline"
                  >
                    {paper.isBookmarked ? <BookmarkCheck /> : <Bookmark />}
                  </Button>
                  <Button className="rounded-md" nativeButton={false} render={<Link href={`/papers/${paper.id}`} />}>
                    View details
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="grid gap-2 py-8 text-center">
            <div className="text-sm font-medium">No papers found</div>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
              Try a broader search or run the database seed to add development papers.
            </p>
          </CardContent>
        </Card>
      )}

      {papers.data ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Page {papers.data.pagination.page} of {Math.max(papers.data.pagination.totalPages, 1)}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button
                className="rounded-md"
                nativeButton={false}
                variant="outline"
                render={<Link href={buildHref(initialFilters, page - 1)} />}
              >
                Previous
              </Button>
            ) : null}
            {page < papers.data.pagination.totalPages ? (
              <Button
                className="rounded-md"
                nativeButton={false}
                variant="outline"
                render={<Link href={buildHref(initialFilters, page + 1)} />}
              >
                Next
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
