import { createHash } from "node:crypto";

export type DuplicateTitleCandidate = {
  id: string;
  title: string;
  status?: string;
};

export type DuplicateTitleGroup = {
  groupKey: string;
  normalizedTitle: string;
  paperIds: string[];
  groupFingerprint: string;
};

export function normalizeTitleCandidate(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").filter(Boolean);

  return normalized.length >= 20 && words.length >= 4 ? normalized : null;
}

export function createDuplicateGroupFingerprint(groupKey: string, paperIds: string[]) {
  const sortedPaperIds = [...paperIds].sort();
  return createHash("sha256")
    .update(JSON.stringify({ groupKey, paperIds: sortedPaperIds }))
    .digest("hex");
}

export function buildDuplicateTitleGroups(papers: DuplicateTitleCandidate[]) {
  const candidatesByTitle = new Map<string, string[]>();

  for (const paper of papers) {
    if (paper.status === "inactive") {
      continue;
    }

    const normalizedTitle = normalizeTitleCandidate(paper.title);
    if (!normalizedTitle) {
      continue;
    }

    const paperIds = candidatesByTitle.get(normalizedTitle) ?? [];
    paperIds.push(paper.id);
    candidatesByTitle.set(normalizedTitle, paperIds);
  }

  return Array.from(candidatesByTitle.entries())
    .filter(([, paperIds]) => paperIds.length >= 2)
    .map(([groupKey, paperIds]) => {
      const sortedPaperIds = [...paperIds].sort();
      return {
        groupKey,
        normalizedTitle: groupKey,
        paperIds: sortedPaperIds,
        groupFingerprint: createDuplicateGroupFingerprint(groupKey, sortedPaperIds),
      };
    });
}

export function excludeResolvedDuplicateGroups(
  groups: DuplicateTitleGroup[],
  resolvedFingerprints: ReadonlySet<string>,
) {
  return groups.filter((group) => !resolvedFingerprints.has(group.groupFingerprint));
}
