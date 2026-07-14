export const OPENALEX_PROVIDER = "openalex";

const DOI_PREFIX_PATTERN = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i;
const OPENALEX_ID_PREFIX_PATTERN = /^https?:\/\/(?:www\.)?openalex\.org\//i;

export function normalizeDoi(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .replace(DOI_PREFIX_PATTERN, "")
    .trim()
    .replace(/\/+$/, "")
    .trim()
    .toLowerCase();

  return normalized || null;
}

export function normalizeOpenAlexId(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .replace(OPENALEX_ID_PREFIX_PATTERN, "")
    .split(/[?#]/, 1)[0]
    ?.replace(/\/+$/, "")
    .trim()
    .toUpperCase();

  return normalized && /^W\d+$/.test(normalized) ? normalized : null;
}

export function buildOpenAlexWorkUrl(externalId: string) {
  return `https://openalex.org/${externalId}`;
}
