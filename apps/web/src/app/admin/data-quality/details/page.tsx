import { Button } from "@deepread/ui/components/button";
import { Card, CardContent } from "@deepread/ui/components/card";
import Link from "next/link";

import DataQualityDetails, { type DataQualityDetailIssue } from "../../_components/data-quality-details";
import { AdminPageHeader } from "../../_components/admin-ui";

const detailIssues = new Set<DataQualityDetailIssue>([
  "missing-authors",
  "duplicate-title",
  "unpublished-user-relations",
]);

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DataQualityDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedIssue = firstSearchParam(resolvedSearchParams.issue);

  if (!requestedIssue || !detailIssues.has(requestedIssue as DataQualityDetailIssue)) {
    return (
      <main className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-8 md:py-10">
        <AdminPageHeader
          description="The requested data-quality drill-down is missing or unsupported."
          title="Invalid Audit Detail"
        />
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <p className="text-sm text-muted-foreground">Choose a supported audit issue from the Data Quality overview.</p>
            <Button nativeButton={false} render={<Link href="/admin/data-quality" />} variant="outline">
              Back to Data Quality
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <DataQualityDetails issue={requestedIssue as DataQualityDetailIssue} />;
}
