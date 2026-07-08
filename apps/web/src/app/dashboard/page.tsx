import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export default async function DashboardPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/papers");
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:py-10">
      <section className="grid gap-2 border-b pb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldCheck />
          Admin access
        </div>
        <h1 className="text-3xl font-semibold tracking-normal">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as {session.user.name}.</p>
      </section>

      <Card className="max-w-2xl rounded-lg border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Administration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Admin access is active. Ingestion and classification operations remain available through the existing
            protected admin procedures.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
