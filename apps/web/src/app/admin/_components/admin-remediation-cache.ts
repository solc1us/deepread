import { queryClient, trpc } from "@/utils/trpc";

export async function invalidateAdminRemediationQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: trpc.admin.dataQuality.getOverview.queryKey() }),
    queryClient.invalidateQueries({ queryKey: trpc.admin.dataQuality.getDetails.queryKey() }),
    queryClient.invalidateQueries({ queryKey: trpc.admin.dashboard.getOverview.queryKey() }),
    queryClient.invalidateQueries({ queryKey: trpc.admin.papers.list.queryKey() }),
    queryClient.invalidateQueries({ queryKey: trpc.admin.papers.detail.queryKey() }),
    queryClient.invalidateQueries({ queryKey: trpc.papers.list.queryKey(), refetchType: "none" }),
    queryClient.invalidateQueries({ queryKey: trpc.papers.detail.queryKey(), refetchType: "none" }),
  ]);
}
