"use client";

import { Button } from "@deepread/ui/components/button";
import { cn } from "@deepread/ui/lib/utils";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type ValidationIssue = {
  message?: unknown;
  path?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toValidationIssues(value: unknown): ValidationIssue[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value) && Array.isArray(value.issues)) {
    return value.issues.filter(isRecord);
  }

  return [];
}

export function getAdminMutationError(error: unknown, fallback: string) {
  if (isRecord(error) && isRecord(error.data) && isRecord(error.data.zodError)) {
    const issue = toValidationIssues(error.data.zodError)[0];
    if (typeof issue?.message === "string") {
      return {
        message: issue.message,
        field: Array.isArray(issue.path) ? String(issue.path[0] ?? "") : "",
      };
    }
  }

  const message = error instanceof Error ? error.message.trim() : "";

  try {
    const issue = toValidationIssues(JSON.parse(message))[0];
    if (typeof issue?.message === "string") {
      return {
        message: issue.message,
        field: Array.isArray(issue.path) ? String(issue.path[0] ?? "") : "",
      };
    }
  } catch {
    // Non-JSON messages are handled below.
  }

  if (
    message &&
    message.length <= 240 &&
    !message.includes("prisma.") &&
    !message.includes("Invalid `") &&
    !message.includes(" at ") &&
    !message.includes("\n")
  ) {
    return { message, field: "" };
  }

  return { message: fallback, field: "" };
}

export function AdminSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export function AnimatedEllipsis() {
  return (
    <span aria-hidden="true" className="ingestion-ellipsis inline-flex w-[1.5em] justify-start">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

export function AdminDialog({
  open,
  onClose,
  title,
  description,
  children,
  busy = false,
  maxWidthClassName = "max-w-2xl",
  contentClassName = "overflow-y-auto",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  busy?: boolean;
  maxWidthClassName?: string;
  contentClassName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      contentRef.current?.querySelector<HTMLElement>("[data-autofocus], button, input, textarea, select")?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div
        className={cn(
          "grid max-h-[calc(100dvh-2rem)] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl sm:max-h-[90vh]",
          maxWidthClassName,
        )}
        onClick={(event) => event.stopPropagation()}
        ref={contentRef}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold" id={titleId}>{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground" id={descriptionId}>{description}</p>
          </div>
          <Button aria-label={`Close ${title}`} disabled={busy} onClick={onClose} size="icon" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className={cn("min-h-0", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
