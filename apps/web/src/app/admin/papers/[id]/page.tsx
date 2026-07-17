import AdminPaperDetail from "../../_components/admin-paper-detail";

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeReturnTo(value: string | undefined) {
  if (!value || (value !== "/admin/papers" && !value.startsWith("/admin/papers?"))) {
    return "/admin/papers";
  }

  return value;
}

export default async function AdminPaperDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const returnTo = safeReturnTo(firstSearchParam(resolvedSearchParams.returnTo));

  return <AdminPaperDetail paperId={id} returnTo={returnTo} />;
}
