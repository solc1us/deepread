"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Input } from "@deepread/ui/components/input";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

import { AdminPageHeader, AdminStatusBadge, adminInputLabelClass, adminSelectClassName, formatAdminDate } from "./admin-ui";

type LogStatusFilter = "" | "success" | "failed" | "partial";

export default function IngestionLogs() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LogStatusFilter>("");
  const [provider, setProvider] = useState("");
  const logs = useQuery(
    trpc.admin.logs.list.queryOptions({
      page,
      limit: 20,
      ...(status ? { status } : {}),
      ...(provider.trim() ? { provider: provider.trim() } : {}),
    }),
  );

  const updateStatus = (value: LogStatusFilter) => {
    setStatus(value);
    setPage(1);
  };
  const updateProvider = (value: string) => {
    setProvider(value);
    setPage(1);
  };

  if (logs.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </main>
    );
  }

  if (logs.isError || !logs.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Ingestion logs unavailable</div>
              <p className="text-sm leading-6 text-muted-foreground">Confirm your admin session and server connection.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const totalPages = Math.max(logs.data.pagination.totalPages, 1);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-10">
      <AdminPageHeader description="Paginated manual ingestion runs. Error messages are limited to operational details only." title="Ingestion Logs" />

      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-lg"><Database className="text-primary" />Filters</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">Results are limited to 20 logs per page.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className={adminInputLabelClass}>
            Status
            <select className={adminSelectClassName} onChange={(event) => updateStatus(event.target.value as LogStatusFilter)} value={status}>
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className={adminInputLabelClass}>
            Provider
            <Input onChange={(event) => updateProvider(event.target.value)} placeholder="openalex" value={provider} />
          </label>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader className="gap-1">
          <CardTitle className="text-lg">Recent Runs</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{logs.data.pagination.total} matching ingestion runs.</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {logs.data.logs.length ? (
            <div className="overflow-x-auto rounded-md border border-border/80">
              <table className="min-w-[58rem] w-full table-fixed text-left text-sm">
                <thead className="border-b bg-muted/35 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Provider</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Fetched</th>
                    <th className="px-3 py-3 text-right font-medium">Saved</th>
                    <th className="px-3 py-3 text-right font-medium">Rejected</th>
                    <th className="px-3 py-3 font-medium">Started</th>
                    <th className="px-3 py-3 font-medium">Finished</th>
                    <th className="w-72 px-3 py-3 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80">
                  {logs.data.logs.map((log) => (
                    <tr className="align-top" key={log.id}>
                      <td className="px-3 py-3 font-medium">{log.provider}</td>
                      <td className="px-3 py-3"><AdminStatusBadge value={log.status} /></td>
                      <td className="px-3 py-3 text-right">{log.totalFetched}</td>
                      <td className="px-3 py-3 text-right">{log.totalSaved}</td>
                      <td className="px-3 py-3 text-right">{log.totalRejected}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{formatAdminDate(log.startedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{formatAdminDate(log.finishedAt)}</td>
                      <td className="w-72 break-words px-3 py-3 text-xs leading-5 text-destructive">{log.errorMessage ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm leading-6 text-muted-foreground">No ingestion logs match these filters.</p>}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} variant="outline"><ChevronLeft data-icon="inline-start" />Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} variant="outline">Next<ChevronRight data-icon="inline-end" /></Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
