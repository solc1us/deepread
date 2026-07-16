import PaperMonitor from "../_components/paper-monitor";

type DifficultyFilter = "" | "beginner_friendly" | "moderate" | "difficult" | "expert";

const difficultyFilters = new Set<DifficultyFilter>([
  "",
  "beginner_friendly",
  "moderate",
  "difficult",
  "expert",
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
  const requestedDifficulty = firstSearchParam(resolvedSearchParams.difficulty) ?? "";
  const difficulty = difficultyFilters.has(requestedDifficulty as DifficultyFilter)
    ? (requestedDifficulty as DifficultyFilter)
    : "";

  return <PaperMonitor initialCategorySlug={categorySlug} initialDifficulty={difficulty} />;
}
