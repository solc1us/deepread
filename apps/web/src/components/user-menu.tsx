import { Button, buttonVariants } from "@deepread/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deepread/ui/components/dropdown-menu";
import { Skeleton } from "@deepread/ui/components/skeleton";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSignOut } from "@/hooks/use-sign-out";
import { authClient } from "@/lib/auth-client";

import SignOutPending, { SignOutLabel } from "./sign-out-pending";

type UserMenuProps = {
  session: typeof authClient.$Infer.Session | null;
  isPending: boolean;
};

export default function UserMenu({ session, isPending }: UserMenuProps) {
  const router = useRouter();
  const { isSigningOut, signOut } = useSignOut();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link className={buttonVariants({ variant: "outline" })} href="/login">
        Sign In
      </Link>
    );
  }

  return (
    <>
      <SignOutPending isPending={isSigningOut} />
      <DropdownMenu>
        <DropdownMenuTrigger disabled={isSigningOut} render={<Button variant="outline" />}>
          {session.user.name}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-card">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {session.user.name} - {session.user.role === "admin" ? "Admin" : "Reader"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/profile" as Route)}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              aria-busy={isSigningOut}
              disabled={isSigningOut}
              onClick={signOut}
              variant="destructive"
            >
              <SignOutLabel idleLabel="Sign Out" isPending={isSigningOut} />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
