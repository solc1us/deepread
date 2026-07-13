export function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function tokenizeWords(value: string) {
  return value.match(/[a-z0-9]+(?:-[a-z0-9]+)?/gi) ?? [];
}

export function splitSentences(value: string) {
  return value
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function countTermMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const matches = text.match(new RegExp(`\\b${escapedTerm}\\b`, "gi"));
    return count + (matches?.length ?? 0);
  }, 0);
}

export function getDistinctTermMatches(text: string, terms: string[]) {
  return terms.filter((term) => countTermMatches(text, [term]) > 0);
}

export function getNonOverlappingTermMatches(text: string, terms: string[]) {
  const matches = getDistinctTermMatches(text, terms).sort((left, right) => right.length - left.length);

  return matches.filter(
    (term, index) => !matches.some((candidate, candidateIndex) => candidateIndex < index && candidate.includes(term)),
  );
}

export function countAcronyms(text: string) {
  return getAcronymMatches(text).length;
}

export function getAcronymMatches(text: string) {
  const matches = text.match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)?\b/g) ?? [];
  return matches.filter((item) => !["PDF", "DOI", "URL"].includes(item));
}
