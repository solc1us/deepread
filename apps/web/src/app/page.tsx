"use client";

import { buttonVariants } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { BookOpen, Library, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

const highlights = [
  {
    title: "Beginner fit first",
    description: "Difficulty level, beginner score, and reading time are surfaced before you open a paper.",
    icon: ShieldCheck,
  },
  {
    title: "Text-heavy by design",
    description: "Paper cards use list layouts and clear hierarchy so abstracts stay readable.",
    icon: Library,
  },
  {
    title: "Focused discovery",
    description: "Search, category, and difficulty filters help narrow the library without extra noise.",
    icon: Search,
  },
] as const;

export default function Home() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());
  const isConnected = Boolean(healthCheck.data);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:py-12">
      <section className="grid gap-8 rounded-xl border bg-card px-5 py-8 shadow-sm md:grid-cols-[1fr_320px] md:px-8 md:py-10">
        <div className="flex flex-col gap-6">
          <div className="flex w-fit items-center gap-2 rounded-full border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <BookOpen data-icon="inline-start" />
            Academic reading desk
          </div>
          <div className="grid gap-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground md:text-5xl">
              Find papers that match your reading readiness.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              DeepRead helps students start with approachable open-access papers, clear difficulty
              signals, and a low-distraction reading flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants({ className: "rounded-md" })} href="/papers">
              Browse papers
            </Link>
          </div>
        </div>

        <Card className="rounded-lg border-border/80 shadow-sm" size="sm">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`size-2.5 rounded-full ${
                  healthCheck.isLoading ? "bg-accent-foreground" : isConnected ? "bg-primary" : "bg-destructive"
                }`}
              />
              <div className="grid gap-1">
                <div className="text-sm font-medium">
                  {healthCheck.isLoading ? "Checking API" : isConnected ? "API connected" : "API unavailable"}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  The reading library uses the backend API and seeded paper metadata.
                </p>
              </div>
            </div>
            <div className="rounded-md border bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
              Seed data is required to see development papers in the library.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;

          return (
            <Card className="rounded-lg border-border/80 shadow-sm" key={item.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-muted text-primary">
                  <Icon />
                </div>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
