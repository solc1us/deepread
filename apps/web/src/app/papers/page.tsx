import PapersList from "./papers-list";

type PapersPageProps = {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    difficulty?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function PapersPage({ searchParams }: PapersPageProps) {
  const params = await searchParams;

  return (
    <PapersList
      initialFilters={{
        q: params.q,
        categoryId: params.categoryId,
        difficulty: params.difficulty,
        sort: params.sort,
        page: params.page,
      }}
    />
  );
}
