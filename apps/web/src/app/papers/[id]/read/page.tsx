import AuthGuard from "@/components/auth-guard";

import ReadingMode from "./reading-mode";

type ReadingModePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReadingModePage({ params }: ReadingModePageProps) {
  const { id } = await params;

  return (
    <AuthGuard>
      <ReadingMode key={id} paperId={id} />
    </AuthGuard>
  );
}
