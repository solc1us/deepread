"use client";

import { Button } from "@deepread/ui/components/button";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

type AuthGuardProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

export function SessionCheckMessage({
  error,
  onRetry,
}: {
  error?: boolean;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="flex min-h-48 items-center justify-center px-4" role="alert">
        <div className="grid max-w-md gap-3 text-center">
          <p className="font-medium">We could not verify your session.</p>
          <p className="text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          {onRetry ? (
            <Button className="mx-auto" onClick={onRetry} variant="outline">
              Retry session check
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      Checking your session
    </div>
  );
}

export default function AuthGuard({
  children,
  requireAdmin = false,
}: AuthGuardProps) {
  const { data: session, error, isPending, refetch } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isUnauthenticated = !isPending && !error && !session?.user;
  const isDenied =
    !isPending &&
    !error &&
    Boolean(session?.user) &&
    requireAdmin &&
    session?.user.role !== "admin";

  useEffect(() => {
    if (isUnauthenticated) {
      const returnPath = encodeURIComponent(pathname);
      router.replace(`/login?next=${returnPath}` as Route);
    } else if (isDenied) {
      router.replace("/papers");
    }
  }, [isDenied, isUnauthenticated, pathname, router]);

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

  if (isUnauthenticated || isDenied) {
    return <SessionCheckMessage />;
  }

  return children;
}
