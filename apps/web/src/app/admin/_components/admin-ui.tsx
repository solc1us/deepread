import { Card, CardContent } from "@deepread/ui/components/card";
import { cn } from "@deepread/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

export const adminInputLabelClass = "grid gap-1.5 text-xs font-medium text-foreground";
export const adminSelectClassName =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAdminDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return dateFormatter.format(new Date(value));
}

export function formatAdminStatus(value: string | null | undefined) {
  return value?.replace("_", " ") ?? "None";
}

export function formatAdminDifficulty(value: string | null | undefined) {
  return value?.replace("_", " ") ?? "Unclassified";
}

export function getAdminStatusClass(value: string | null | undefined) {
  switch (value) {
    case "published":
    case "success":
    case "connected":
      return "bg-difficulty-beginner text-difficulty-beginner-foreground";
    case "pending":
    case "partial":
      return "bg-difficulty-difficult text-difficulty-difficult-foreground";
    case "rejected":
    case "failed":
    case "disconnected":
      return "bg-difficulty-expert text-difficulty-expert-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getAdminDifficultyClass(value: string | null | undefined) {
  switch (value) {
    case "beginner_friendly":
      return "bg-difficulty-beginner text-difficulty-beginner-foreground";
    case "moderate":
      return "bg-difficulty-moderate text-difficulty-moderate-foreground";
    case "difficult":
      return "bg-difficulty-difficult text-difficulty-difficult-foreground";
    case "expert":
      return "bg-difficulty-expert text-difficulty-expert-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getAdminBarWidth(count: number, max: number) {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.max(8, Math.round((count / max) * 100))}%`;
}

export function AdminPageHeader({
  eyebrow = "Admin access",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <section className="grid gap-2 border-b pb-6">
      <span className="text-sm font-medium text-primary">{eyebrow}</span>
      <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </section>
  );
}

export function AdminMetricCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  detail?: string;
}) {
  return (
    <Card className="rounded-lg border-border/80 shadow-sm" size="sm">
      <CardContent className="flex min-h-24 items-center justify-between gap-4 py-2">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold">{value}</span>
          {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
        </div>
        <Icon aria-hidden="true" className="text-primary" />
      </CardContent>
    </Card>
  );
}

export function AdminStatusBadge({ value, difficulty = false }: { value: string | null | undefined; difficulty?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
        difficulty ? getAdminDifficultyClass(value) : getAdminStatusClass(value),
      )}
    >
      {difficulty ? formatAdminDifficulty(value) : formatAdminStatus(value)}
    </span>
  );
}
