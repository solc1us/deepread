"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

export function useSignOut() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const finishRequest = useCallback(() => {
    inFlight.current = false;
    setIsSigningOut(false);
  }, []);

  const signOut = useCallback(() => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsSigningOut(true);

    void authClient
      .signOut({
        fetchOptions: {
          onSuccess: () => {
            finishRequest();
            queryClient.clear();
            router.replace("/");
            router.refresh();
          },
          onError: finishRequest,
        },
      })
      .catch(finishRequest);
  }, [finishRequest, router]);

  return {
    isSigningOut,
    signOut,
  };
}
