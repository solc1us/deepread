"use client";

import { cn } from "@deepread/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/papers", label: "Papers" },
] as const;

type PublicNavbarProps = {
  session: typeof authClient.$Infer.Session | null;
  isPending: boolean;
};

export default function PublicNavbar({ session, isPending }: PublicNavbarProps) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-card/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4">
        <div className="flex items-center gap-4 sm:gap-7">
          <Link className="flex items-center gap-2 text-sm font-semibold text-foreground" href="/">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              DR
            </span>
            <span>DeepRead</span>
          </Link>
          <nav className="hidden min-h-9 gap-1 text-sm sm:flex" aria-label="Public navigation">
            {publicLinks.map(({ to, label }) => {
              const isActive = to === "/" ? pathname === to : pathname.startsWith(to);

              return (
                <Link
                  className={cn(
                    "rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActive && "bg-muted text-foreground",
                  )}
                  key={to}
                  href={to as Route}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu isPending={isPending} session={session} />
        </div>
        <nav className="order-3 flex min-h-9 w-full gap-1 border-t pt-2 text-sm sm:hidden" aria-label="Public navigation">
          {publicLinks.map(({ to, label }) => {
            const isActive = to === "/" ? pathname === to : pathname.startsWith(to);

            return (
              <Link
                className={cn(
                  "rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )}
                key={to}
                href={to as Route}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
