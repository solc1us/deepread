"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

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

function formatDifficulty(value: string | null) {
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

export default function PapersList({ initialFilters }: PapersListProps) {
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

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-normal">Papers</h1>
        <p className="text-sm text-muted-foreground">
          Browse published papers with beginner suitability metadata.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_220px_180px_150px_auto]">
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue={initialFilters.q ?? ""}
          name="q"
          placeholder="Search title or abstract"
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
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
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue={difficulty ?? ""}
          name="difficulty"
        >
          {difficulties.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={sort} name="sort">
          {sorts.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">
          Filter
        </button>
      </form>

      {papers.isLoading ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading papers...</div>
      ) : papers.data?.papers.length ? (
        <div className="grid gap-3">
          {papers.data.papers.map((paper) => (
            <Link
              className="grid gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              href={`/papers/${paper.id}`}
              key={paper.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="grid gap-1">
                  <h2 className="text-lg font-semibold tracking-normal">{paper.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {paper.authors.join(", ")} {paper.publicationYear ? `- ${paper.publicationYear}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                  <span className="rounded-md border px-2 py-1">{paper.category.name}</span>
                  <span className="rounded-md border px-2 py-1 capitalize">
                    {formatDifficulty(paper.difficultyLevel)}
                  </span>
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{paper.abstract}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {paper.beginnerScore !== null ? <span>Score {paper.beginnerScore}/100</span> : null}
                {paper.estimatedReadingTime !== null ? (
                  <span>{paper.estimatedReadingTime} min read</span>
                ) : null}
                <span>{paper.sourceName}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">No papers found.</div>
      )}

      {papers.data ? (
        <div className="flex items-center justify-between text-sm">
          <span>
            Page {papers.data.pagination.page} of {Math.max(papers.data.pagination.totalPages, 1)}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className="rounded-md border px-3 py-2" href={buildHref(initialFilters, page - 1)}>
                Previous
              </Link>
            ) : null}
            {page < papers.data.pagination.totalPages ? (
              <Link className="rounded-md border px-3 py-2" href={buildHref(initialFilters, page + 1)}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
