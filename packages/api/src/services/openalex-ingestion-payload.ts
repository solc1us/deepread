import type { Prisma } from "@deepread/db";

import type { NormalizedOpenAlexPaper } from "./openalex";
import { OPENALEX_PROVIDER } from "./openalex-identifiers";
import { toPrismaJsonObject } from "./openalex-json";

export function buildOpenAlexPaperCreateData(
  paper: NormalizedOpenAlexPaper,
  categoryId: string,
  fetchedAt: Date,
): Prisma.PaperUncheckedCreateInput {
  return {
    title: paper.title,
    abstract: paper.abstract,
    authors: paper.authors,
    publicationYear: paper.publicationYear,
    doi: paper.doi,
    sourceName: paper.sourceName ?? "OpenAlex",
    sourceUrl: paper.sourceUrl,
    pdfUrl: paper.pdfUrl,
    categoryId,
    keywords: paper.keywords,
    status: "pending",
    sources: {
      create: {
        provider: OPENALEX_PROVIDER,
        externalId: paper.openAlexId,
        rawMetadata: toPrismaJsonObject(paper.rawMetadata),
        fetchedAt,
      },
    },
  };
}
