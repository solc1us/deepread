"use client";
import { cn } from "@deepread/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const pathname = usePathname();
  const links = [
    { to: "/", label: "Home" },
    { to: "/papers", label: "Papers" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <header className="border-b bg-card/95">
      <div className="mx-auto flex max-w-6xl flex-row items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-7">
          <Link className="flex items-center gap-2 text-sm font-semibold tracking-normal text-foreground" href="/">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              DR
            </span>
            <span>DeepRead</span>
          </Link>
          <nav className="flex gap-1 text-sm">
          {links.map(({ to, label }) => {
            const isActive = to === "/" ? pathname === to : pathname.startsWith(to);

            return (
              <Link
                className={cn(
                  "rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )}
                key={to}
                href={to}
              >
                {label}
              </Link>
            );
          })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
