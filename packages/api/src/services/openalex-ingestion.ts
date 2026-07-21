import prisma from "@deepread/db";
import { env } from "@deepread/env/server";

import {
  OPENALEX_INGESTION_CONCURRENCY,
  OPENALEX_INGESTION_DEFAULT_LIMIT,
  OPENALEX_INGESTION_MAX_LIMIT,
  OPENALEX_INGESTION_MIN_LIMIT,
  OPENALEX_REQUEST_MAX_LIMIT,
} from "../openalex-ingestion-limits";
import {
  fetchOpenAlexWorks,
  normalizeOpenAlexWork,
  type NormalizedOpenAlexPaper,
  type OpenAlexWork,
} from "./openalex";
import {
  normalizeDoi,
  normalizeOpenAlexId,
  OPENALEX_PROVIDER,
} from "./openalex-identifiers";
import { BackendProfiler, formatProfileSummary } from "./backend-profiler";

const MAX_ERROR_EXAMPLES = 5;

type JsonInputValue = null | string | number | boolean | JsonInputValue[] | JsonInputObject;
type JsonInputObject = { [key: string]: JsonInputValue };
type SaveResult =
  | { type: "saved" }
  | { type: "duplicate" }
  | { type: "invalid"; error?: string }
  | { type: "failed"; error: string };

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

interface OpenAlexIngestionTestOptions {
  fetcher?: typeof fetch;
  beforeDatabaseWrites?: (papers: NormalizedOpenAlexPaper[]) => Promise<void>;
  beforePaperSave?: (paper: NormalizedOpenAlexPaper) => Promise<void>;
  afterPaperSave?: (paper: NormalizedOpenAlexPaper) => Promise<void>;
}

function normalizeLimit(limit?: number) {
  const rawLimit = limit ?? OPENALEX_INGESTION_DEFAULT_LIMIT;

  if (!Number.isFinite(rawLimit)) {
    return OPENALEX_INGESTION_DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(Math.trunc(rawLimit), OPENALEX_INGESTION_MIN_LIMIT),
    OPENALEX_INGESTION_MAX_LIMIT,
  );
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];

      if (item !== undefined) {
        results[currentIndex] = await worker(item);
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}

function isValidNormalizedPaper(paper: NormalizedOpenAlexPaper) {
  return Boolean(paper.openAlexId && paper.title && paper.abstract && paper.sourceUrl);
}

function normalizeTitleKey(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
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

function deduplicateNormalizedPapers(normalizedPapers: Array<NormalizedOpenAlexPaper | null>) {
  const papers: NormalizedOpenAlexPaper[] = [];
  const seenDois = new Set<string>();
  const seenExternalIds = new Set<string>();
  const seenTitles = new Set<string>();
  let duplicates = 0;
  let invalid = 0;

  for (const paper of normalizedPapers) {
    if (!paper || !isValidNormalizedPaper(paper)) {
      invalid += 1;
      continue;
    }

    const titleKey = normalizeTitleKey(paper.title);
    const isDuplicate =
      seenExternalIds.has(paper.openAlexId) ||
      Boolean(paper.doi && seenDois.has(paper.doi)) ||
      (!paper.doi && seenTitles.has(titleKey));

    if (isDuplicate) {
      duplicates += 1;
      continue;
    }

    seenExternalIds.add(paper.openAlexId);
    if (paper.doi) {
      seenDois.add(paper.doi);
    }
    seenTitles.add(titleKey);
    papers.push(paper);
  }

  return { papers, duplicates, invalid };
}

function deduplicateFetchedWorks(works: OpenAlexWork[], profiler?: BackendProfiler) {
  const normalizeWorks = () => works.map(normalizeOpenAlexWork);
  const normalizedPapers = profiler
    ? profiler.measureSync("normalization", normalizeWorks)
    : normalizeWorks();
  const deduplicatePapers = () => deduplicateNormalizedPapers(normalizedPapers);

  return profiler
    ? profiler.measureSync("in_memory_deduplication", deduplicatePapers)
    : deduplicatePapers();
}

function buildDoiLookupValues(dois: string[]) {
  return Array.from(
    new Set(
      dois.flatMap((doi) => [
        doi,
        `https://doi.org/${doi}`,
        `http://doi.org/${doi}`,
        `http://dx.doi.org/${doi}`,
        `doi:${doi}`,
      ]),
    ),
  );
}

function buildExternalIdLookupValues(externalIds: string[]) {
  return Array.from(
    new Set(
      externalIds.flatMap((externalId) => [externalId, `https://openalex.org/${externalId}`]),
    ),
  );
}

async function findExistingDuplicateKeys(papers: NormalizedOpenAlexPaper[]) {
  const dois = papers.flatMap((paper) => (paper.doi ? [paper.doi] : []));
  const externalIds = papers.map((paper) => paper.openAlexId);
  const titleFallbacks = papers.filter((paper) => !paper.doi).map((paper) => paper.title);
  const doiLookupValues = buildDoiLookupValues(dois);
  const externalIdLookupValues = buildExternalIdLookupValues(externalIds);

  const [existingSources, existingDoiPapers, existingTitlePapers] = await Promise.all([
    externalIdLookupValues.length > 0
      ? prisma.paperSource.findMany({
          where: {
            provider: OPENALEX_PROVIDER,
            externalId: {
              in: externalIdLookupValues,
              mode: "insensitive",
            },
          },
          select: { externalId: true },
        })
      : Promise.resolve([]),
    doiLookupValues.length > 0
      ? prisma.paper.findMany({
          where: {
            doi: {
              in: doiLookupValues,
              mode: "insensitive",
            },
          },
          select: { doi: true },
        })
      : Promise.resolve([]),
    titleFallbacks.length > 0
      ? prisma.paper.findMany({
          where: {
            title: {
              in: titleFallbacks,
              mode: "insensitive",
            },
          },
          select: { title: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    dois: new Set(
      existingDoiPapers.flatMap((paper) => {
        const doi = normalizeDoi(paper.doi);
        return doi ? [doi] : [];
      }),
    ),
    externalIds: new Set(
      existingSources.flatMap((source) => {
        const externalId = normalizeOpenAlexId(source.externalId);
        return externalId ? [externalId] : [];
      }),
    ),
    titles: new Set(existingTitlePapers.map((paper) => normalizeTitleKey(paper.title))),
  };
}

function isExistingDuplicate(
  paper: NormalizedOpenAlexPaper,
  existing: Awaited<ReturnType<typeof findExistingDuplicateKeys>>,
) {
  return (
    existing.externalIds.has(paper.openAlexId) ||
    Boolean(paper.doi && existing.dois.has(paper.doi)) ||
    (!paper.doi && existing.titles.has(normalizeTitleKey(paper.title)))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIdentifierUniqueConflict(error: unknown) {
  if (!isRecord(error) || error.code !== "P2002") {
    return false;
  }

  const target = isRecord(error.meta) ? error.meta.target : undefined;
  const targetText = [
    ...(Array.isArray(target) ? target.map(String) : target ? [String(target)] : []),
    typeof error.message === "string" ? error.message : "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    targetText.includes("doi") ||
    (targetText.includes("provider") &&
      (targetText.includes("externalid") || targetText.includes("external_id")))
  );
}

function getOpenAlexRequestErrorMessage(error: unknown, page: number) {
  const message = error instanceof Error ? error.message : "";
  const status = message.match(/status\s+(\d{3})/i)?.[1];

  return status
    ? `OpenAlex request failed on page ${page} with status ${status}.`
    : `OpenAlex request failed while fetching page ${page}.`;
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

async function runOpenAlexIngestionInternal(
  input: RunOpenAlexIngestionInput,
  testOptions?: OpenAlexIngestionTestOptions,
): Promise<OpenAlexIngestionResult> {
  const profiler = env.OPENALEX_INGESTION_PROFILING ? new BackendProfiler() : undefined;
  const startedAt = new Date();
  const errors: string[] = [];
  const limit = normalizeLimit(input.limit);
  const query = input.query.trim();
  let totalFetched = 0;
  let totalSaved = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let failedCount = 0;
  let pagesFetched = 0;
  let profileStatus: OpenAlexIngestionResult["status"] = "failed";

  const addError = (message: string) => {
    if (errors.length < MAX_ERROR_EXAMPLES && !errors.includes(message)) {
      errors.push(message);
    }
  };

  const finish = async (status: OpenAlexIngestionResult["status"]) => {
    profileStatus = status;
    const unaccounted = totalFetched - totalSaved - duplicateCount - invalidCount;
    if (unaccounted > 0) {
      invalidCount += unaccounted;
    }

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
      failedCount += 1;
      addError("The selected category was not found.");
      return await finish("failed");
    }

    if (!query) {
      failedCount += 1;
      addError("OpenAlex search query is required.");
      return await finish("failed");
    }

    let page = 1;
    let fetchFailed = false;
    const fetchedWorks: OpenAlexWork[] = [];

    while (totalFetched < limit) {
      const pageLimit = Math.min(OPENALEX_REQUEST_MAX_LIMIT, limit - totalFetched);

      try {
        const fetchPage = () =>
          fetchOpenAlexWorks({
            query,
            limit: pageLimit,
            page,
            ...(testOptions?.fetcher ? { fetcher: testOptions.fetcher } : {}),
          });
        const response = profiler
          ? await profiler.measure("openalex_fetch", fetchPage)
          : await fetchPage();
        const works = (response.results ?? []).slice(0, pageLimit);
        pagesFetched += 1;

        if (works.length === 0) {
          break;
        }

        fetchedWorks.push(...works);
        totalFetched += works.length;

        if (works.length < pageLimit) {
          break;
        }
      } catch (error) {
        fetchFailed = true;
        failedCount += 1;
        addError(getOpenAlexRequestErrorMessage(error, page));
        break;
      }

      page += 1;
    }

    if (totalFetched === 0 && fetchFailed) {
      return await finish("failed");
    }

    const batch = deduplicateFetchedWorks(fetchedWorks, profiler);
    duplicateCount += batch.duplicates;
    invalidCount += batch.invalid;

    let existing: Awaited<ReturnType<typeof findExistingDuplicateKeys>>;
    try {
      const findDuplicates = () => findExistingDuplicateKeys(batch.papers);
      existing = profiler
        ? await profiler.measure("database_duplicate_lookup", findDuplicates)
        : await findDuplicates();
    } catch {
      failedCount += 1;
      invalidCount += batch.papers.length;
      addError("Existing-paper checks could not be completed.");
      return await finish("failed");
    }

    const fetchedAt = new Date();
    const papersToSave: NormalizedOpenAlexPaper[] = [];

    for (const paper of batch.papers) {
      if (isExistingDuplicate(paper, existing)) {
        duplicateCount += 1;
        continue;
      }

      papersToSave.push(paper);
    }

    await testOptions?.beforeDatabaseWrites?.(papersToSave);

    const saveResults = await mapWithConcurrency(
      papersToSave,
      OPENALEX_INGESTION_CONCURRENCY,
      async (paper): Promise<SaveResult> => {
        await testOptions?.beforePaperSave?.(paper);
        try {
          const savePaper = () => saveOpenAlexPaper(paper, input.categoryId, fetchedAt);
          if (profiler) {
            await profiler.measure("database_write_per_paper", savePaper);
          } else {
            await savePaper();
          }

          return { type: "saved" };
        } catch (error) {
          if (isIdentifierUniqueConflict(error)) {
            return { type: "duplicate" };
          }

          return {
            type: "failed",
            error: `OpenAlex work ${paper.openAlexId} could not be saved.`,
          };
        } finally {
          await testOptions?.afterPaperSave?.(paper);
        }
      },
    );

    for (const result of saveResults) {
      if (result.type === "saved") {
        totalSaved += 1;
      } else if (result.type === "duplicate") {
        duplicateCount += 1;
      } else if (result.type === "invalid") {
        invalidCount += 1;
        if (result.error) {
          addError(result.error);
        }
      } else {
        invalidCount += 1;
        failedCount += 1;
        addError(result.error);
      }
    }

    const hasGenuineIssues = fetchFailed || invalidCount > 0 || errors.length > 0;
    if (!hasGenuineIssues) {
      return await finish("success");
    }

    return await finish(totalSaved > 0 ? "partial" : "failed");
  } catch {
    failedCount += 1;
    addError("OpenAlex ingestion failed unexpectedly.");
    return await finish(totalSaved > 0 ? "partial" : "failed");
  } finally {
    if (profiler) {
      console.info(
        formatProfileSummary({
          title: "OpenAlex Ingestion Profile",
          metadata: {
            status: profileStatus,
            requested_limit: limit,
            pages_fetched: pagesFetched,
            total_fetched: totalFetched,
            saved: totalSaved,
            duplicates: duplicateCount,
            invalid: invalidCount,
            failed: failedCount,
            concurrency: OPENALEX_INGESTION_CONCURRENCY,
          },
          snapshot: profiler.finish(),
          metrics: [
            { name: "openalex_fetch", label: "openalex_fetch_latency_ms", kind: "latency" },
            { name: "normalization", label: "normalization_ms", kind: "duration" },
            {
              name: "in_memory_deduplication",
              label: "in_memory_deduplication_ms",
              kind: "duration",
            },
            {
              name: "database_duplicate_lookup",
              label: "database_duplicate_lookup_ms",
              kind: "duration",
            },
            {
              name: "database_write_per_paper",
              label: "database_write_latency_ms",
              kind: "latency",
            },
          ],
        }),
      );
    }
  }
}

export async function runOpenAlexIngestion(
  input: RunOpenAlexIngestionInput,
): Promise<OpenAlexIngestionResult> {
  return await runOpenAlexIngestionInternal(input);
}

export async function runOpenAlexIngestionForTest(
  input: RunOpenAlexIngestionInput,
  options: OpenAlexIngestionTestOptions,
): Promise<OpenAlexIngestionResult> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The OpenAlex ingestion test entry point is available only in test mode.");
  }

  return await runOpenAlexIngestionInternal(input, options);
}
