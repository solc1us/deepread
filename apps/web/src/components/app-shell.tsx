"use client";

import { authClient } from "@/lib/auth-client";

import AppSidebar from "./app-sidebar";
import { SessionCheckMessage } from "./auth-guard";
import PublicNavbar from "./public-navbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, error, isPending, refetch } = authClient.useSession();

  if (isPending) {
    return <SessionCheckMessage />;
  }

  if (error) {
    return (
      <SessionCheckMessage
        error
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-svh grid-rows-[auto_1fr]">
        <PublicNavbar isPending={false} session={null} />
        {children}
      </div>
    );
  }

  return (
    <AppSidebar isAdmin={session.user.role === "admin"} session={session}>
      {children}
    </AppSidebar>
  );
}
