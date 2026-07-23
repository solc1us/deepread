import AuthGuard from "@/components/auth-guard";

import StatisticsOverview from "./statistics-overview";

export default function StatisticsPage() {
  return (
    <AuthGuard>
      <StatisticsOverview />
    </AuthGuard>
  );
}
