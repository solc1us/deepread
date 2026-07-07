import { Button } from "@deepread/ui/components/button";
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

import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

type UserMenuProps = {
  session: typeof authClient.$Infer.Session | null;
  isPending: boolean;
};

export default function UserMenu({ session, isPending }: UserMenuProps) {
  const router = useRouter();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button nativeButton={false} variant="outline" render={<Link href="/login" />}>
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {session.user.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {session.user.name} - {session.user.role === "admin" ? "Admin" : "Reader"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/profile" as Route)}>Profile</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    queryClient.clear();
                    router.replace("/");
                    router.refresh();
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
