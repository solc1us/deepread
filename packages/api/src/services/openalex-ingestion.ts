import prisma from "@deepread/db";

import { fetchOpenAlexWorks, normalizeOpenAlexWork, type NormalizedOpenAlexPaper } from "./openalex";

const OPENALEX_PROVIDER = "openalex";
const DEFAULT_INGESTION_LIMIT = 10;
const MAX_INGESTION_LIMIT = 50;

type JsonInputValue = null | string | number | boolean | JsonInputValue[] | JsonInputObject;
type JsonInputObject = { [key: string]: JsonInputValue };

export interface RunOpenAlexIngestionInput {
  categoryId: string;
  query: string;
  limit?: number;
}

export interface OpenAlexIngestionResult {
  provider: typeof OPENALEX_PROVIDER;
  status: "success" | "failed" | "partial";
  totalFetched: number;
  totalSaved: number;
  totalRejected: number;
  skipped: {
    duplicates: number;
    invalid: number;
  };
  errors?: string[];
}

function normalizeLimit(limit?: number) {
  const rawLimit = limit ?? DEFAULT_INGESTION_LIMIT;

  if (!Number.isFinite(rawLimit)) {
    return DEFAULT_INGESTION_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_INGESTION_LIMIT);
}

function isValidNormalizedPaper(paper: NormalizedOpenAlexPaper) {
  return Boolean(paper.openAlexId && paper.title && paper.abstract && paper.sourceUrl);
}

function buildErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const sensitiveValues = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.OPENALEX_API_KEY,
  ].filter((value): value is string => Boolean(value));

  return sensitiveValues.reduce((sanitized, value) => sanitized.replaceAll(value, "[redacted]"), message);
}

function toJsonValue(value: unknown): JsonInputValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toJsonValue(item)]),
    );
  }

  return null;
}

function toJsonObject(value: Record<string, unknown>): JsonInputObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, toJsonValue(item)]),
  );
}

async function isDuplicatePaper(paper: NormalizedOpenAlexPaper) {
  const existingSource = await prisma.paperSource.findUnique({
    where: {
      provider_externalId: {
        provider: OPENALEX_PROVIDER,
        externalId: paper.openAlexId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingSource) {
    return true;
  }

  if (paper.doi) {
    const existingPaperByDoi = await prisma.paper.findUnique({
      where: {
        doi: paper.doi,
      },
      select: {
        id: true,
      },
    });

    if (existingPaperByDoi) {
      return true;
    }
  }

  if (!paper.doi) {
    const existingPaperByTitle = await prisma.paper.findFirst({
      where: {
        title: {
          equals: paper.title,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPaperByTitle) {
      return true;
    }
  }

  return false;
}

async function saveOpenAlexPaper(paper: NormalizedOpenAlexPaper, categoryId: string, fetchedAt: Date) {
  await prisma.paper.create({
    data: {
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
          rawMetadata: toJsonObject(paper.rawMetadata),
          fetchedAt,
        },
      },
    },
  });
}

async function createIngestionLog(result: OpenAlexIngestionResult, startedAt: Date, finishedAt: Date) {
  await prisma.ingestionLog.create({
    data: {
      provider: result.provider,
      status: result.status,
      totalFetched: result.totalFetched,
      totalSaved: result.totalSaved,
      totalRejected: result.totalRejected,
      errorMessage: result.errors?.join("\n") ?? null,
      startedAt,
      finishedAt,
    },
  });
}

export async function runOpenAlexIngestion(input: RunOpenAlexIngestionInput): Promise<OpenAlexIngestionResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  const limit = normalizeLimit(input.limit);
  let totalFetched = 0;
  let totalSaved = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  const finish = async (status: OpenAlexIngestionResult["status"]) => {
    const result: OpenAlexIngestionResult = {
      provider: OPENALEX_PROVIDER,
      status,
      totalFetched,
      totalSaved,
      totalRejected: duplicateCount + invalidCount,
      skipped: {
        duplicates: duplicateCount,
        invalid: invalidCount,
      },
      ...(errors.length > 0 ? { errors } : {}),
    };

    await createIngestionLog(result, startedAt, new Date());
    return result;
  };

  try {
    const category = await prisma.category.findUnique({
      where: {
        id: input.categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      errors.push(`Category not found: ${input.categoryId}`);
      return await finish("failed");
    }

    const response = await fetchOpenAlexWorks({
      query: input.query,
      limit,
    });

    const works = response.results ?? [];
    totalFetched = works.length;

    for (const work of works) {
      const paper = normalizeOpenAlexWork(work);

      if (!paper || !isValidNormalizedPaper(paper)) {
        invalidCount += 1;
        continue;
      }

      try {
        if (await isDuplicatePaper(paper)) {
          duplicateCount += 1;
          continue;
        }

        await saveOpenAlexPaper(paper, input.categoryId, new Date());
        totalSaved += 1;
      } catch (error) {
        invalidCount += 1;
        errors.push(`Failed to save OpenAlex work ${paper.openAlexId}: ${buildErrorMessage(error)}`);
      }
    }

    return await finish(errors.length > 0 ? "partial" : "success");
  } catch (error) {
    errors.push(buildErrorMessage(error));
    return await finish("failed");
  }
}
