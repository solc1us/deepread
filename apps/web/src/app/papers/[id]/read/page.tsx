import ReadingMode from "./reading-mode";

type ReadingModePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReadingModePage({ params }: ReadingModePageProps) {
  const { id } = await params;

  return <ReadingMode key={id} paperId={id} />;
}
