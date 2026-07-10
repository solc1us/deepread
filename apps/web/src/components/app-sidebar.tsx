"use client";

import { Button } from "@deepread/ui/components/button";
import { cn } from "@deepread/ui/lib/utils";
import { BarChart3, BookOpen, FileCheck2, FileText, LayoutDashboard, ListRestart, LogOut, Menu, NotebookPen, UserRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

import { ModeToggle } from "./mode-toggle";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof BookOpen;
};

const userNavigation: NavigationItem[] = [
  { href: "/papers", label: "Papers", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
];

const adminNavigation: NavigationItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/pipeline", label: "Pipeline", icon: ListRestart },
  { href: "/admin/logs", label: "Logs", icon: FileText },
  { href: "/admin/classification", label: "Classification", icon: FileCheck2 },
  { href: "/admin/papers", label: "Papers Monitor", icon: BookOpen },
];

const adminUserNavigation: NavigationItem[] = [
  { href: "/papers", label: "Papers", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
];

type AppSidebarProps = {
  children: React.ReactNode;
  isAdmin: boolean;
  session: typeof authClient.$Infer.Session;
};

function isActiveRoute(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar({ children, isAdmin, session }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const workspaceName = isAdmin ? "Admin workspace" : "Reading workspace";

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          queryClient.clear();
          router.replace("/");
          router.refresh();
        },
      },
    });
  };

  const renderNavigationLinks = (items: NavigationItem[]) =>
    items.map(({ href, icon: Icon, label }) => (
      <Link
        aria-current={isActiveRoute(pathname, href) ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          isActiveRoute(pathname, href) && "bg-muted font-medium text-foreground",
        )}
        href={href as Route}
        key={href}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </Link>
    ));

  const navigationContent = isAdmin ? (
    <>
      <div className="grid gap-1">
        <p className="px-3 text-xs font-medium text-muted-foreground">Admin</p>
        <nav className="grid gap-1" aria-label={workspaceName}>
          {renderNavigationLinks(adminNavigation)}
        </nav>
      </div>
      <div className="grid gap-1">
        <p className="px-3 text-xs font-medium text-muted-foreground">User App</p>
        <nav className="grid gap-1" aria-label="User application navigation">
          {renderNavigationLinks(adminUserNavigation)}
        </nav>
      </div>
      <div className="mt-auto grid gap-3 border-t pt-4">
        <div className="grid gap-0.5 px-3">
          <span className="truncate text-sm font-medium">{session.user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
        </div>
        <Button className="justify-start" onClick={handleSignOut} variant="outline">
          <LogOut data-icon="inline-start" />
          Logout
        </Button>
      </div>
    </>
  ) : (
    <>
      <div className="grid gap-1">
        <p className="px-3 text-xs font-medium text-muted-foreground">{workspaceName}</p>
        <nav className="grid gap-1" aria-label={workspaceName}>
          {renderNavigationLinks(userNavigation)}
        </nav>
      </div>
      <div className="mt-auto grid gap-3 border-t pt-4">
        <div className="grid gap-0.5 px-3">
          <span className="truncate text-sm font-medium">{session.user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
        </div>
        <Button className="justify-start" onClick={handleSignOut} variant="outline">
          <LogOut data-icon="inline-start" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-svh bg-background md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh border-r bg-card px-3 py-5 md:flex md:flex-col md:gap-6">
        <Link className="flex items-center gap-2 px-2 text-sm font-semibold text-foreground" href="/">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            DR
          </span>
          DeepRead
        </Link>
        {navigationContent}
        <div className="absolute right-3 top-5">
          <ModeToggle />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/95 px-4 py-3 md:hidden">
          <Link className="flex items-center gap-2 text-sm font-semibold text-foreground" href="/">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              DR
            </span>
            DeepRead
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle workspace navigation"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              size="icon"
              variant="outline"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </header>
        {isMobileMenuOpen ? <aside className="grid gap-6 border-b bg-card p-4 md:hidden">{navigationContent}</aside> : null}
        {children}
      </div>
    </div>
  );
}
