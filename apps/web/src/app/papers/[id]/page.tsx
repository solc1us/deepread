import PaperDetail from "./paper-detail";

type PaperDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const { id } = await params;

  return <PaperDetail id={id} />;
}
