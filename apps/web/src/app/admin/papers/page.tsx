import PaperMonitor from "../_components/paper-monitor";

type DifficultyFilter = "" | "beginner_friendly" | "moderate" | "difficult" | "expert";
type PaperStatusFilter = "" | "pending" | "needs_review" | "published" | "rejected" | "inactive";

const difficultyFilters = new Set<DifficultyFilter>([
  "",
  "beginner_friendly",
  "moderate",
  "difficult",
  "expert",
]);
const paperStatusFilters = new Set<PaperStatusFilter>([
  "",
  "pending",
  "needs_review",
  "published",
  "rejected",
  "inactive",
]);

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPapersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const categorySlug = firstSearchParam(resolvedSearchParams.category)?.trim() ?? "";
  const requestedStatus = firstSearchParam(resolvedSearchParams.status) ?? "";
  const status = paperStatusFilters.has(requestedStatus as PaperStatusFilter)
    ? (requestedStatus as PaperStatusFilter)
    : "";
  const requestedDifficulty = firstSearchParam(resolvedSearchParams.difficulty) ?? "";
  const difficulty = difficultyFilters.has(requestedDifficulty as DifficultyFilter)
    ? (requestedDifficulty as DifficultyFilter)
    : "";
  const requestedPage = Number(firstSearchParam(resolvedSearchParams.page) ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  return <PaperMonitor initialCategorySlug={categorySlug} initialDifficulty={difficulty} initialPage={page} initialStatus={status} />;
}
