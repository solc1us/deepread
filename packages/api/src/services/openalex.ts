import { env } from "@deepread/env/server";

import {
  OPENALEX_INGESTION_DEFAULT_LIMIT,
  OPENALEX_INGESTION_MIN_LIMIT,
  OPENALEX_REQUEST_MAX_LIMIT,
} from "../openalex-ingestion-limits";
import {
  buildOpenAlexWorkUrl,
  normalizeDoi,
  normalizeOpenAlexId,
} from "./openalex-identifiers";

export interface OpenAlexAuthor {
  id?: string;
  display_name?: string | null;
}

export interface OpenAlexAuthorship {
  author?: OpenAlexAuthor | null;
}

export interface OpenAlexSource {
  display_name?: string | null;
}

export interface OpenAlexLocation {
  landing_page_url?: string | null;
  pdf_url?: string | null;
  source?: OpenAlexSource | null;
}

export interface OpenAlexTopic {
  display_name?: string | null;
}

export interface OpenAlexConcept {
  display_name?: string | null;
}

export interface OpenAlexWork {
  id?: string | null;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: OpenAlexAuthorship[] | null;
  primary_location?: OpenAlexLocation | null;
  best_oa_location?: OpenAlexLocation | null;
  locations?: OpenAlexLocation[] | null;
  open_access?: {
    oa_url?: string | null;
  } | null;
  topics?: OpenAlexTopic[] | null;
  concepts?: OpenAlexConcept[] | null;
  [key: string]: unknown;
}

export interface OpenAlexWorksResponse {
  meta?: {
    count?: number;
    db_response_time_ms?: number;
    page?: number;
    per_page?: number;
  };
  results?: OpenAlexWork[];
}

export interface BuildOpenAlexWorksUrlOptions {
  query?: string;
  search?: string;
  limit?: number;
  perPage?: number;
  page?: number;
  openAccessOnly?: boolean;
  hasAbstractOnly?: boolean;
  articleOnly?: boolean;
  baseUrl?: string;
  apiKey?: string;
}

export interface FetchOpenAlexWorksOptions extends BuildOpenAlexWorksUrlOptions {
  fetcher?: typeof fetch;
}

export interface NormalizedOpenAlexPaper {
  openAlexId: string;
  title: string;
  abstract: string;
  authors: string[];
  publicationYear: number | null;
  doi: string | null;
  sourceName: string | null;
  sourceUrl: string;
  pdfUrl: string | null;
  keywords: string[];
  rawMetadata: OpenAlexWork;
}

function normalizeLimit(limit?: number) {
  const rawLimit = limit ?? OPENALEX_INGESTION_DEFAULT_LIMIT;

  if (!Number.isFinite(rawLimit)) {
    return OPENALEX_INGESTION_DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(Math.trunc(rawLimit), OPENALEX_INGESTION_MIN_LIMIT),
    OPENALEX_REQUEST_MAX_LIMIT,
  );
}

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(cleanString).filter((value): value is string => Boolean(value))));
}

function decodeHtmlEntities(value: string) {
  const entityMap: Record<string, string> = {
    amp: "&",
    quot: "\"",
    "#39": "'",
    lt: "<",
    gt: ">",
  };

  return value.replace(/&(#\d+|amp|quot|#39|lt|gt);/g, (entity, key: string) => {
    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return entityMap[key] ?? entity;
  });
}

function cleanAbstractText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\\[rn]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDoiUrl(doi: string | null | undefined) {
  const cleanedDoi = normalizeDoi(doi);

  if (!cleanedDoi) {
    return null;
  }

  return `https://doi.org/${cleanedDoi}`;
}

export function buildOpenAlexWorksUrl(options: BuildOpenAlexWorksUrlOptions = {}) {
  const baseUrl = cleanString(options.baseUrl) ?? env.OPENALEX_BASE_URL;
  const url = new URL("/works", baseUrl);
  const filters: string[] = [];

  url.searchParams.set("per-page", String(normalizeLimit(options.limit ?? options.perPage)));

  if (options.page && Number.isInteger(options.page) && options.page > 0) {
    url.searchParams.set("page", String(options.page));
  }

  const query = cleanString(options.query) ?? cleanString(options.search);
  if (query) {
    url.searchParams.set("search", query);
  }

  if (options.openAccessOnly ?? true) {
    filters.push("is_oa:true");
  }

  if (options.hasAbstractOnly ?? true) {
    filters.push("has_abstract:true");
  }

  if (options.articleOnly ?? true) {
    filters.push("type:article");
  }

  if (filters.length > 0) {
    url.searchParams.set("filter", filters.join(","));
  }

  const apiKey = cleanString(options.apiKey) ?? cleanString(env.OPENALEX_API_KEY);
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  return url;
}

export async function fetchOpenAlexWorks(options: FetchOpenAlexWorksOptions = {}) {
  const { fetcher = fetch, ...urlOptions } = options;
  const url = buildOpenAlexWorksUrl(urlOptions);
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`OpenAlex works request failed with status ${response.status}`);
  }

  return (await response.json()) as OpenAlexWorksResponse;
}

export function reconstructOpenAlexAbstract(invertedIndex: OpenAlexWork["abstract_inverted_index"]) {
  if (!invertedIndex) {
    return null;
  }

  const wordsByPosition: string[] = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      wordsByPosition[position] = word;
    }
  }

  const abstract = wordsByPosition.filter(Boolean).join(" ").trim();
  return cleanAbstractText(abstract) || null;
}

export function normalizeOpenAlexWork(work: OpenAlexWork): NormalizedOpenAlexPaper | null {
  const openAlexId = normalizeOpenAlexId(work.id);
  const title = cleanString(work.display_name) ?? cleanString(work.title);
  const abstract = reconstructOpenAlexAbstract(work.abstract_inverted_index);

  if (!openAlexId || !title || !abstract) {
    return null;
  }

  const primaryLocation = work.primary_location;
  const bestOaLocation = work.best_oa_location;
  const sourceUrl =
    normalizeDoiUrl(work.doi) ??
    cleanString(primaryLocation?.landing_page_url) ??
    cleanString(bestOaLocation?.landing_page_url) ??
    cleanString(work.locations?.find((location) => cleanString(location.landing_page_url))?.landing_page_url) ??
    buildOpenAlexWorkUrl(openAlexId);
  const pdfUrl =
    cleanString(bestOaLocation?.pdf_url) ??
    cleanString(primaryLocation?.pdf_url) ??
    cleanString(work.locations?.find((location) => cleanString(location.pdf_url))?.pdf_url);

  return {
    openAlexId,
    title,
    abstract,
    authors: uniqueStrings(work.authorships?.map((authorship) => authorship.author?.display_name) ?? []),
    publicationYear: work.publication_year ?? null,
    doi: normalizeDoi(work.doi),
    sourceName: cleanString(primaryLocation?.source?.display_name) ?? cleanString(bestOaLocation?.source?.display_name),
    sourceUrl,
    pdfUrl,
    keywords: uniqueStrings([
      ...(work.topics?.map((topic) => topic.display_name) ?? []),
      ...(work.concepts?.map((concept) => concept.display_name) ?? []),
    ]),
    rawMetadata: work,
  };
}
