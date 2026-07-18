import prisma from "@deepread/db";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import { QUALITY_GATE_MIN_ABSTRACT_WORDS } from "../../services/difficulty-classifier/quality-gate";
import { tokenizeWords } from "../../services/difficulty-classifier/text-utils";
import {
  buildDuplicateTitleGroups,
  excludeResolvedDuplicateGroups,
} from "../../services/duplicate-title-groups";
import { resolveDuplicateGroup } from "../../services/duplicate-paper-resolution";
import { normalizeDoi, normalizeOpenAlexId, OPENALEX_PROVIDER } from "../../services/openalex-identifiers";
import { CLASSIFICATION_VERSION } from "../../services/paper-classification";

type AuditSection = "classification" | "metadata" | "duplicates" | "workflow" | "integrity";
type AuditSeverity = "info" | "warning" | "critical";

type IntegrityAuditRow = {
  orphanClassifications: bigint | number;
  orphanSources: bigint | number;
  orphanBookmarks: bigint | number;
  orphanNotes: bigint | number;
  orphanReadingProgress: bigint | number;
  userRelationsOnUnpublishedPapers: bigint | number;
};

type AuditIssue = {
  key: string;
  section: AuditSection;
  label: string;
  count: number;
  severity: AuditSeverity;
  description: string;
  targetUrl?: string;
};

const dataQualityIssueSchema = z.enum([
  "missing-authors",
  "duplicate-title",
  "unpublished-user-relations",
]);
const duplicateResolutionReasonSchema = z
  .string()
  .trim()
  .min(20, "Reason must be at least 20 characters")
  .max(2000);
const resolveDuplicateGroupInputSchema = z
  .discriminatedUnion("resolution", [
    z.object({
      resolution: z.literal("keep_both"),
      groupKey: z.string().trim().min(1),
      paperIds: z.array(z.string().uuid()).min(2).max(100),
      reason: duplicateResolutionReasonSchema,
    }),
    z.object({
      resolution: z.literal("merge"),
      groupKey: z.string().trim().min(1),
      canonicalPaperId: z.string().uuid(),
      duplicatePaperIds: z.array(z.string().uuid()).min(1).max(99),
      reason: duplicateResolutionReasonSchema,
    }),
  ])
  .superRefine((input, context) => {
    const paperIds =
      input.resolution === "keep_both"
        ? input.paperIds
        : [input.canonicalPaperId, ...input.duplicatePaperIds];

    if (new Set(paperIds).size !== paperIds.length) {
      context.addIssue({
        code: "custom",
        message: "Paper IDs must be unique",
        path: [input.resolution === "keep_both" ? "paperIds" : "duplicatePaperIds"],
      });
    }
  });

function countDuplicateValues(values: Array<string | null>) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  let groups = 0;
  let papers = 0;

  for (const count of counts.values()) {
    if (count > 1) {
      groups += 1;
      papers += count;
    }
  }

  return { groups, papers };
}

function countDuplicateSourceIdentifiers(
  sources: Array<{ paperId: string; provider: string; externalId: string }>,
) {
  const groupedSources = new Map<string, { occurrences: number; paperIds: Set<string> }>();

  for (const source of sources) {
    const identifier = normalizeSourceIdentifier(source.provider, source.externalId);
    if (!identifier) {
      continue;
    }

    const group = groupedSources.get(identifier) ?? { occurrences: 0, paperIds: new Set<string>() };
    group.occurrences += 1;
    group.paperIds.add(source.paperId);
    groupedSources.set(identifier, group);
  }

  let groups = 0;
  const paperIds = new Set<string>();

  for (const group of groupedSources.values()) {
    if (group.occurrences > 1) {
      groups += 1;
      for (const paperId of group.paperIds) {
        paperIds.add(paperId);
      }
    }
  }

  return { groups, papers: paperIds.size };
}

function normalizeSourceIdentifier(providerValue: string, externalIdValue: string) {
  const provider = providerValue.trim().toLowerCase();
  const externalId =
    provider === OPENALEX_PROVIDER ? normalizeOpenAlexId(externalIdValue) : externalIdValue.trim();

  return provider && externalId ? `${provider}\u0000${externalId}` : null;
}

function getUsableAuthors(authors: unknown) {
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

function hasMissingAuthors(authors: unknown) {
  return getUsableAuthors(authors).length === 0;
}

function abstractPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const maximumLength = 280;
  return normalized.length <= maximumLength ? normalized : `${normalized.slice(0, maximumLength - 3).trimEnd()}...`;
}

function issue(
  key: string,
  section: AuditSection,
  label: string,
  count: number,
  severity: AuditSeverity,
  description: string,
  targetUrl?: string,
): AuditIssue {
  return {
    key,
    section,
    label,
    count,
    severity,
    description,
    ...(targetUrl ? { targetUrl } : {}),
  };
}

export const adminDataQualityRouter = router({
  getOverview: adminProcedure.query(async () => {
    const generatedAt = new Date();
    const pendingCutoff = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      publishedClassificationGroups,
      publishedMetadata,
      paperIdentifiers,
      sourceIdentifiers,
      workflowGroups,
      pendingOlderThanSevenDays,
      integrityRows,
      resolvedDuplicateGroups,
    ] = await Promise.all([
      prisma.paperClassification.groupBy({
        by: ["classificationVersion"],
        where: {
          paper: {
            status: "published",
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.paper.findMany({
        where: {
          status: "published",
        },
        select: {
          abstract: true,
          authors: true,
          publicationYear: true,
          sourceUrl: true,
          pdfUrl: true,
        },
      }),
      prisma.paper.findMany({
        select: {
          id: true,
          doi: true,
          title: true,
          status: true,
        },
      }),
      prisma.paperSource.findMany({
        select: {
          paperId: true,
          provider: true,
          externalId: true,
        },
      }),
      prisma.paper.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      prisma.paper.count({
        where: {
          status: "pending",
          createdAt: {
            lt: pendingCutoff,
          },
        },
      }),
      prisma.$queryRaw<IntegrityAuditRow[]>`
        SELECT
          (SELECT COUNT(*) FROM paper_classifications pc WHERE NOT EXISTS (SELECT 1 FROM papers p WHERE p.id = pc.paper_id)) AS "orphanClassifications",
          (SELECT COUNT(*) FROM paper_sources ps WHERE NOT EXISTS (SELECT 1 FROM papers p WHERE p.id = ps.paper_id)) AS "orphanSources",
          (SELECT COUNT(*) FROM bookmarks b WHERE NOT EXISTS (SELECT 1 FROM papers p WHERE p.id = b.paper_id) OR NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = b.user_id)) AS "orphanBookmarks",
          (SELECT COUNT(*) FROM reading_notes rn WHERE NOT EXISTS (SELECT 1 FROM papers p WHERE p.id = rn.paper_id) OR NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = rn.user_id)) AS "orphanNotes",
          (SELECT COUNT(*) FROM reading_progress rp WHERE NOT EXISTS (SELECT 1 FROM papers p WHERE p.id = rp.paper_id) OR NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = rp.user_id)) AS "orphanReadingProgress",
          (
            (SELECT COUNT(*) FROM bookmarks b JOIN papers p ON p.id = b.paper_id WHERE p.status <> 'published') +
            (SELECT COUNT(*) FROM reading_notes rn JOIN papers p ON p.id = rn.paper_id WHERE p.status <> 'published') +
            (SELECT COUNT(*) FROM reading_progress rp JOIN papers p ON p.id = rp.paper_id WHERE p.status <> 'published')
          ) AS "userRelationsOnUnpublishedPapers"
      `,
      prisma.duplicateGroupResolution.findMany({
        where: { resolution: "keep_both" },
        select: { groupFingerprint: true },
      }),
    ]);

    const workflowCounts = new Map(workflowGroups.map((group) => [group.status, group._count._all]));
    const publishedTotal = workflowCounts.get("published") ?? 0;
    const publishedWithCurrentVersion =
      publishedClassificationGroups.find((group) => group.classificationVersion === CLASSIFICATION_VERSION)?._count
        ._all ?? 0;
    const publishedWithLegacyVersion = publishedClassificationGroups.reduce(
      (total, group) =>
        group.classificationVersion === CLASSIFICATION_VERSION ? total : total + group._count._all,
      0,
    );
    const publishedWithoutClassification = Math.max(
      0,
      publishedTotal - publishedWithCurrentVersion - publishedWithLegacyVersion,
    );

    const metadata = publishedMetadata.reduce(
      (counts, paper) => {
        const abstract = paper.abstract.trim();

        if (!abstract) {
          counts.missingAbstract += 1;
        } else if (tokenizeWords(abstract).length < QUALITY_GATE_MIN_ABSTRACT_WORDS) {
          counts.shortAbstract += 1;
        }
        if (hasMissingAuthors(paper.authors)) {
          counts.missingAuthors += 1;
        }
        if (paper.publicationYear === null) {
          counts.missingPublicationYear += 1;
        }
        if (!paper.sourceUrl.trim()) {
          counts.missingSourceUrl += 1;
        }
        if (!paper.pdfUrl?.trim()) {
          counts.missingPdfUrl += 1;
        }

        return counts;
      },
      {
        missingAbstract: 0,
        shortAbstract: 0,
        missingAuthors: 0,
        missingPublicationYear: 0,
        missingSourceUrl: 0,
        missingPdfUrl: 0,
      },
    );

    const doiDuplicates = countDuplicateValues(paperIdentifiers.map((paper) => normalizeDoi(paper.doi)));
    const externalIdDuplicates = countDuplicateSourceIdentifiers(sourceIdentifiers);
    const titleDuplicates = excludeResolvedDuplicateGroups(
      buildDuplicateTitleGroups(paperIdentifiers),
      new Set(resolvedDuplicateGroups.map((resolution) => resolution.groupFingerprint)),
    );
    const duplicates = {
      duplicateDoiGroups: doiDuplicates.groups,
      duplicateDoiPapers: doiDuplicates.papers,
      duplicateExternalIdGroups: externalIdDuplicates.groups,
      duplicateExternalIdPapers: externalIdDuplicates.papers,
      duplicateTitleCandidateGroups: titleDuplicates.length,
    };

    const workflow = {
      pending: workflowCounts.get("pending") ?? 0,
      pendingOlderThanSevenDays,
      needsReview: workflowCounts.get("needs_review") ?? 0,
      rejected: workflowCounts.get("rejected") ?? 0,
      inactive: workflowCounts.get("inactive") ?? 0,
    };
    const rawIntegrity = integrityRows[0];
    const integrity = {
      orphanClassifications: Number(rawIntegrity?.orphanClassifications ?? 0),
      orphanSources: Number(rawIntegrity?.orphanSources ?? 0),
      orphanBookmarks: Number(rawIntegrity?.orphanBookmarks ?? 0),
      orphanNotes: Number(rawIntegrity?.orphanNotes ?? 0),
      orphanReadingProgress: Number(rawIntegrity?.orphanReadingProgress ?? 0),
      userRelationsOnUnpublishedPapers: Number(rawIntegrity?.userRelationsOnUnpublishedPapers ?? 0),
    };

    const issues: AuditIssue[] = [
      issue(
        "classification-current",
        "classification",
        "Published with current classification",
        publishedWithCurrentVersion,
        "info",
        `Published papers classified with ${CLASSIFICATION_VERSION}.`,
        "/admin/papers?status=published",
      ),
      issue(
        "classification-legacy",
        "classification",
        "Legacy classification version",
        publishedWithLegacyVersion,
        "warning",
        "Published papers classified with an older rule version.",
      ),
      issue(
        "classification-missing",
        "classification",
        "Published without classification",
        publishedWithoutClassification,
        "critical",
        "Published papers must have a complete classification record.",
      ),
      issue("metadata-abstract-missing", "metadata", "Missing abstract", metadata.missingAbstract, "critical", "Published papers with a blank abstract cannot be assessed reliably."),
      issue("metadata-abstract-short", "metadata", "Short abstract", metadata.shortAbstract, "warning", `Published papers with fewer than ${QUALITY_GATE_MIN_ABSTRACT_WORDS} abstract words.`),
      issue("metadata-authors-missing", "metadata", "Missing authors", metadata.missingAuthors, "warning", "Published papers without at least one usable author name.", "/admin/data-quality/details?issue=missing-authors"),
      issue("metadata-year-missing", "metadata", "Missing publication year", metadata.missingPublicationYear, "warning", "Published papers without a publication year."),
      issue("metadata-source-missing", "metadata", "Missing source URL", metadata.missingSourceUrl, "critical", "Published papers without a usable source-page link."),
      issue("metadata-pdf-missing", "metadata", "Missing PDF URL", metadata.missingPdfUrl, "info", "A direct PDF is optional when a source page remains available."),
      issue("duplicates-doi", "duplicates", "Duplicate normalized DOI groups", duplicates.duplicateDoiGroups, "warning", `${duplicates.duplicateDoiPapers} papers belong to repeated normalized DOI groups.`),
      issue("duplicates-external-id", "duplicates", "Duplicate provider ID groups", duplicates.duplicateExternalIdGroups, "warning", `${duplicates.duplicateExternalIdPapers} papers belong to repeated canonical provider ID groups.`),
      issue("duplicates-title", "duplicates", "Probable duplicate title groups", duplicates.duplicateTitleCandidateGroups, "warning", "Conservative normalized-title matches that require manual review.", "/admin/data-quality/details?issue=duplicate-title"),
      issue("workflow-pending", "workflow", "Pending papers", workflow.pending, "info", "Papers waiting for classification processing.", "/admin/papers?status=pending"),
      issue("workflow-pending-old", "workflow", "Pending older than 7 days", workflow.pendingOlderThanSevenDays, "warning", "Pending papers created more than seven days ago.", "/admin/papers?status=pending"),
      issue("workflow-review", "workflow", "Needs review", workflow.needsReview, "warning", "Papers held for manual quality review.", "/admin/papers?status=needs_review"),
      issue("workflow-rejected", "workflow", "Rejected papers", workflow.rejected, "info", "Papers rejected by the current workflow.", "/admin/papers?status=rejected"),
      issue("workflow-inactive", "workflow", "Inactive papers", workflow.inactive, "info", "Papers intentionally hidden from publication.", "/admin/papers?status=inactive"),
      issue("integrity-classifications", "integrity", "Orphan classifications", integrity.orphanClassifications, "critical", "Classification rows without a related paper."),
      issue("integrity-sources", "integrity", "Orphan paper sources", integrity.orphanSources, "critical", "Paper-source rows without a related paper."),
      issue("integrity-bookmarks", "integrity", "Orphan bookmarks", integrity.orphanBookmarks, "critical", "Bookmark rows without their related paper or user."),
      issue("integrity-notes", "integrity", "Orphan notes", integrity.orphanNotes, "critical", "Reading-note rows without their related paper or user."),
      issue("integrity-progress", "integrity", "Orphan reading progress", integrity.orphanReadingProgress, "critical", "Reading-progress rows without their related paper or user."),
      issue("integrity-unpublished-relations", "integrity", "User relations on unpublished papers", integrity.userRelationsOnUnpublishedPapers, "info", "Bookmarks, notes, or progress retained for papers that are not currently published.", "/admin/data-quality/details?issue=unpublished-user-relations"),
    ];

    return {
      generatedAt,
      classification: {
        publishedTotal,
        publishedWithCurrentVersion,
        publishedWithLegacyVersion,
        publishedWithoutClassification,
        currentVersion: CLASSIFICATION_VERSION,
      },
      metadata,
      duplicates,
      workflow,
      integrity,
      issues,
    };
  }),
  getDetails: adminProcedure
    .input(
      z.object({
        issue: dataQualityIssueSchema,
      }),
    )
    .query(async ({ input }) => {
      if (input.issue === "missing-authors") {
        const authorCandidates = await prisma.paper.findMany({
          where: {
            status: "published",
          },
          select: {
            id: true,
            authors: true,
          },
        });
        const paperIds = authorCandidates
          .filter((paper) => hasMissingAuthors(paper.authors))
          .map((paper) => paper.id);

        if (paperIds.length === 0) {
          return {
            issue: input.issue,
            papers: [],
          };
        }

        const papers = await prisma.paper.findMany({
          where: {
            id: {
              in: paperIds,
            },
          },
          orderBy: {
            title: "asc",
          },
          select: {
            id: true,
            title: true,
            authors: true,
            publicationYear: true,
            status: true,
            doi: true,
            sourceUrl: true,
            category: {
              select: {
                name: true,
              },
            },
            sources: {
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
              select: {
                provider: true,
                externalId: true,
              },
            },
          },
        });

        return {
          issue: input.issue,
          papers: papers.map((paper) => ({
            paperId: paper.id,
            title: paper.title,
            publicationYear: paper.publicationYear,
            categoryName: paper.category.name,
            status: paper.status,
            doi: normalizeDoi(paper.doi),
            provider: paper.sources[0]?.provider.trim() || null,
            externalId: paper.sources[0]?.externalId.trim() || null,
            sourceUrl: paper.sourceUrl.trim() || null,
            currentAuthors: paper.authors,
          })),
        };
      }

      if (input.issue === "duplicate-title") {
        const [titleCandidates, resolvedGroups] = await Promise.all([
          prisma.paper.findMany({
            where: { status: { not: "inactive" } },
            select: {
              id: true,
              title: true,
              status: true,
            },
          }),
          prisma.duplicateGroupResolution.findMany({
            where: { resolution: "keep_both" },
            select: { groupFingerprint: true },
          }),
        ]);
        const duplicateGroups = excludeResolvedDuplicateGroups(
          buildDuplicateTitleGroups(titleCandidates),
          new Set(resolvedGroups.map((resolution) => resolution.groupFingerprint)),
        );
        const duplicatePaperIds = duplicateGroups.flatMap((group) => group.paperIds);

        if (duplicatePaperIds.length === 0) {
          return {
            issue: input.issue,
            groups: [],
          };
        }

        const papers = await prisma.paper.findMany({
          where: {
            id: {
              in: duplicatePaperIds,
            },
          },
          select: {
            id: true,
            title: true,
            abstract: true,
            authors: true,
            publicationYear: true,
            status: true,
            doi: true,
            sourceUrl: true,
            category: {
              select: {
                name: true,
              },
            },
            sources: {
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
              select: {
                provider: true,
                externalId: true,
              },
            },
            _count: {
              select: {
                bookmarks: true,
                readingNotes: true,
                readingProgress: true,
              },
            },
          },
        });
        const paperById = new Map(papers.map((paper) => [paper.id, paper]));
        const groups = duplicateGroups
          .map((group) => ({
            groupKey: group.groupKey,
            normalizedTitle: group.normalizedTitle,
            papers: group.paperIds.flatMap((paperId) => {
              const paper = paperById.get(paperId);
              if (!paper) {
                return [];
              }

              return [
                {
                  paperId: paper.id,
                  title: paper.title,
                  authors: getUsableAuthors(paper.authors),
                  publicationYear: paper.publicationYear,
                  categoryName: paper.category.name,
                  status: paper.status,
                  doi: normalizeDoi(paper.doi),
                  provider: paper.sources[0]?.provider.trim() || null,
                  externalId: paper.sources[0]?.externalId.trim() || null,
                  sourceUrl: paper.sourceUrl.trim() || null,
                  abstractPreview: abstractPreview(paper.abstract),
                  bookmarkCount: paper._count.bookmarks,
                  noteCount: paper._count.readingNotes,
                  readingProgressCount: paper._count.readingProgress,
                },
              ];
            }),
          }))
          .sort(
            (left, right) =>
              right.papers.length - left.papers.length ||
              left.normalizedTitle.localeCompare(right.normalizedTitle),
          );

        return {
          issue: input.issue,
          groups,
        };
      }

      const papers = await prisma.paper.findMany({
        where: {
          status: {
            not: "published",
          },
          OR: [
            { bookmarks: { some: {} } },
            { readingNotes: { some: {} } },
            { readingProgress: { some: {} } },
          ],
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          title: true,
          status: true,
          category: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              bookmarks: true,
              readingNotes: true,
              readingProgress: true,
            },
          },
        },
      });

      return {
        issue: input.issue,
        papers: papers.map((paper) => ({
          paperId: paper.id,
          title: paper.title,
          status: paper.status,
          categoryName: paper.category.name,
          bookmarkCount: paper._count.bookmarks,
          noteCount: paper._count.readingNotes,
          readingProgressCount: paper._count.readingProgress,
          totalUserRelations:
            paper._count.bookmarks + paper._count.readingNotes + paper._count.readingProgress,
        })),
      };
    }),
  resolveDuplicateGroup: adminProcedure
    .input(resolveDuplicateGroupInputSchema)
    .mutation(async ({ ctx, input }) => resolveDuplicateGroup(ctx.adminUser.id, input)),
});
