import { fetchOpenAlexWorks, normalizeOpenAlexWork } from "@deepread/api/services/openalex";

const ABSTRACT_PREVIEW_LENGTH = 220;

function previewAbstract(abstract: string) {
  if (abstract.length <= ABSTRACT_PREVIEW_LENGTH) {
    return abstract;
  }

  return `${abstract.slice(0, ABSTRACT_PREVIEW_LENGTH).trim()}...`;
}

const response = await fetchOpenAlexWorks({
  query: "student learning",
  limit: 5,
});

const normalizedResults =
  response.results
    ?.map(normalizeOpenAlexWork)
    .filter((paper): paper is NonNullable<typeof paper> => Boolean(paper))
    .map((paper) => ({
      title: paper.title,
      publicationYear: paper.publicationYear,
      authorsCount: paper.authors.length,
      abstractPreview: previewAbstract(paper.abstract),
      sourceUrl: paper.sourceUrl,
      pdfUrl: paper.pdfUrl,
    })) ?? [];

console.log("DEV ONLY: OpenAlex client manual test. No database writes are performed.");
console.log(JSON.stringify(normalizedResults, null, 2));
