const UNKNOWN_AUTHORS_LABEL = "Unknown authors";

function getAuthorNames(authors: unknown) {
  if (!Array.isArray(authors)) {
    return [];
  }

  return authors.flatMap((author) => {
    if (typeof author !== "string") {
      return [];
    }

    const name = author.trim();
    return name ? [name] : [];
  });
}

export function formatCompactAuthors(authors: unknown) {
  const names = getAuthorNames(authors);

  if (names.length === 0) {
    return UNKNOWN_AUTHORS_LABEL;
  }

  const visibleNames = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${visibleNames}, et al.` : visibleNames;
}
