"use client";

import { authClient } from "@/lib/auth-client";

import AppSidebar from "./app-sidebar";
import PublicNavbar from "./public-navbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  // Wait for Better Auth to resolve before choosing a public or authenticated shell.
  if (isPending) {
    return <div className="min-h-svh">{children}</div>;
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
