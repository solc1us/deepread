import { Loader2, LogOut } from "lucide-react";

import { DeepReadMark } from "./deepread-brand";

export function SignOutLabel({
  idleLabel,
  isPending,
}: {
  idleLabel: string;
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <>
        <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
        Signing out...
      </>
    );
  }

  return (
    <>
      <LogOut aria-hidden="true" data-icon="inline-start" />
      {idleLabel}
    </>
  );
}

export default function SignOutPending({ isPending }: { isPending: boolean }) {
  if (!isPending) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4"
      role="status"
    >
      <div className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 shadow-lg">
        <DeepReadMark className="size-11" priority />
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
            Signing out...
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Closing your DeepRead session</p>
        </div>
      </div>
    </div>
  );
}
