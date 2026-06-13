"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

type PaperDetailProps = {
  id: string;
};

function formatDifficulty(value: string | undefined) {
  return value?.replace("_", " ") ?? "Unclassified";
}

export default function PaperDetail({ id }: PaperDetailProps) {
  const paper = useQuery(trpc.papers.detail.queryOptions({ id }));

  if (paper.isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading paper...</div>
      </main>
    );
  }

  if (!paper.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Paper not found.</div>
      </main>
    );
  }

  const classification = paper.data.classification;

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
      <Link className="text-sm text-muted-foreground hover:text-foreground" href="/papers">
        Back to papers
      </Link>

      <article className="grid gap-6">
        <header className="grid gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border px-2 py-1">{paper.data.category.name}</span>
            <span className="rounded-md border px-2 py-1 capitalize">
              {formatDifficulty(classification?.difficultyLevel)}
            </span>
            {classification ? (
              <span className="rounded-md border px-2 py-1">Score {classification.beginnerScore}/100</span>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-normal">{paper.data.title}</h1>
          <p className="text-sm text-muted-foreground">
            {paper.data.authors.join(", ")} {paper.data.publicationYear ? `- ${paper.data.publicationYear}` : ""}
          </p>
        </header>

        <section className="grid gap-2">
          <h2 className="text-lg font-semibold tracking-normal">Abstract</h2>
          <p className="leading-7 text-muted-foreground">{paper.data.abstract}</p>
        </section>

        {classification ? (
          <section className="grid gap-3 rounded-lg border p-4">
            <h2 className="text-lg font-semibold tracking-normal">Reading Fit</h2>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Difficulty</div>
                <div className="font-medium capitalize">{formatDifficulty(classification.difficultyLevel)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Beginner score</div>
                <div className="font-medium">{classification.beginnerScore}/100</div>
              </div>
              <div>
                <div className="text-muted-foreground">Reading time</div>
                <div className="font-medium">{classification.estimatedReadingTime} minutes</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{classification.classificationReason}</p>
            <p className="text-sm text-muted-foreground">{classification.readingWarning}</p>
            <p className="text-sm text-muted-foreground">{classification.recommendedReader}</p>
          </section>
        ) : null}

        <section className="grid gap-3 rounded-lg border p-4 text-sm">
          <h2 className="text-lg font-semibold tracking-normal">Source</h2>
          <div className="grid gap-2">
            <div>
              <span className="text-muted-foreground">Provider: </span>
              {paper.data.sourceName}
            </div>
            {paper.data.doi ? (
              <div>
                <span className="text-muted-foreground">DOI: </span>
                {paper.data.doi}
              </div>
            ) : null}
            {paper.data.keywords.length ? (
              <div>
                <span className="text-muted-foreground">Keywords: </span>
                {paper.data.keywords.join(", ")}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
              href={paper.data.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open source
            </a>
            {paper.data.pdfUrl ? (
              <a className="rounded-md border px-3 py-2" href={paper.data.pdfUrl} rel="noreferrer" target="_blank">
                Open PDF
              </a>
            ) : null}
          </div>
        </section>
      </article>
    </main>
  );
}
