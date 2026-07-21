import prisma, { type Prisma } from "@deepread/db";
import { TRPCError } from "@trpc/server";

import {
  buildDuplicateTitleGroups,
  type DuplicateTitleGroup,
} from "./duplicate-title-groups";
import { mergeReadingProgressValues } from "./duplicate-paper-merge-policy";
import { normalizeOpenAlexId, OPENALEX_PROVIDER } from "./openalex-identifiers";
import { hasValidClassification } from "./paper-classification-validity";

type KeepBothInput = {
  resolution: "keep_both";
  groupKey: string;
  paperIds: string[];
  reason: string;
};

type MergeInput = {
  resolution: "merge";
  groupKey: string;
  canonicalPaperId: string;
  duplicatePaperIds: string[];
  reason: string;
};

export type DuplicateGroupResolutionInput = KeepBothInput | MergeInput;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasErrorCode(error: unknown, code: string) {
  return isRecord(error) && error.code === code;
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function sourceKey(source: { provider: string; externalId: string }) {
  const provider = source.provider.trim().toLowerCase();
  const externalId =
    provider === OPENALEX_PROVIDER
      ? normalizeOpenAlexId(source.externalId)
      : source.externalId.trim();

  return provider && externalId ? `${provider}\u0000${externalId}` : null;
}

async function validateCurrentGroup(
  transaction: Prisma.TransactionClient,
  input: DuplicateGroupResolutionInput,
) {
  const suppliedPaperIds = (
    input.resolution === "keep_both"
      ? input.paperIds
      : [input.canonicalPaperId, ...input.duplicatePaperIds]
  ).slice().sort();
  const suppliedPapers = await transaction.paper.findMany({
    where: {
      id: { in: suppliedPaperIds },
    },
    select: {
      id: true,
      title: true,
      status: true,
      classification: {
        select: {
          difficultyLevel: true,
          beginnerScore: true,
          classificationVersion: true,
          classificationReason: true,
        },
      },
    },
  });

  if (suppliedPapers.length !== suppliedPaperIds.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "One or more papers were not found",
    });
  }

  const activeCandidates = await transaction.paper.findMany({
    where: {
      status: { not: "inactive" },
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });
  const currentGroup = buildDuplicateTitleGroups(activeCandidates).find(
    (group) => group.groupKey === input.groupKey,
  );

  if (!currentGroup || !sameIds(currentGroup.paperIds, suppliedPaperIds)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Duplicate group membership changed. Refresh the audit and try again.",
    });
  }

  const existingResolution = await transaction.duplicateGroupResolution.findUnique({
    where: {
      groupFingerprint: currentGroup.groupFingerprint,
    },
    select: { id: true },
  });

  if (existingResolution) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This exact duplicate group has already been resolved",
    });
  }

  return {
    currentGroup,
    suppliedPapers,
  };
}

async function moveSources(
  transaction: Prisma.TransactionClient,
  canonicalPaperId: string,
  duplicatePaperIds: string[],
) {
  const sources = await transaction.paperSource.findMany({
    where: {
      paperId: { in: [canonicalPaperId, ...duplicatePaperIds] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      paperId: true,
      provider: true,
      externalId: true,
      updatedAt: true,
    },
  });
  const retainedKeys = new Set(
    sources
      .filter((source) => source.paperId === canonicalPaperId)
      .flatMap((source) => {
        const key = sourceKey(source);
        return key ? [key] : [];
      }),
  );
  let moved = 0;
  let deduplicated = 0;

  for (const source of sources) {
    if (source.paperId === canonicalPaperId) {
      continue;
    }

    const key = sourceKey(source);
    if (key && retainedKeys.has(key)) {
      await transaction.paperSource.delete({ where: { id: source.id } });
      deduplicated += 1;
      continue;
    }

    await transaction.paperSource.update({
      where: { id: source.id },
      data: {
        paperId: canonicalPaperId,
        updatedAt: source.updatedAt,
      },
    });
    if (key) {
      retainedKeys.add(key);
    }
    moved += 1;
  }

  return { moved, deduplicated };
}

async function moveNotes(
  transaction: Prisma.TransactionClient,
  canonicalPaperId: string,
  duplicatePaperIds: string[],
) {
  const notes = await transaction.readingNote.findMany({
    where: { paperId: { in: duplicatePaperIds } },
    select: {
      id: true,
      updatedAt: true,
    },
  });

  for (const note of notes) {
    await transaction.readingNote.update({
      where: { id: note.id },
      data: {
        paperId: canonicalPaperId,
        updatedAt: note.updatedAt,
      },
    });
  }

  return notes.length;
}

async function moveBookmarks(
  transaction: Prisma.TransactionClient,
  canonicalPaperId: string,
  duplicatePaperIds: string[],
) {
  const bookmarks = await transaction.bookmark.findMany({
    where: {
      paperId: { in: [canonicalPaperId, ...duplicatePaperIds] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      paperId: true,
      createdAt: true,
    },
  });
  const byUser = new Map<string, typeof bookmarks>();

  for (const bookmark of bookmarks) {
    const records = byUser.get(bookmark.userId) ?? [];
    records.push(bookmark);
    byUser.set(bookmark.userId, records);
  }

  let moved = 0;
  let deduplicated = 0;
  for (const records of byUser.values()) {
    const duplicateRecords = records.filter((record) => record.paperId !== canonicalPaperId);
    if (duplicateRecords.length === 0) {
      continue;
    }

    const canonicalRecord = records.find((record) => record.paperId === canonicalPaperId);
    const earliestCreatedAt = records[0]?.createdAt;

    if (canonicalRecord) {
      await transaction.bookmark.deleteMany({
        where: { id: { in: duplicateRecords.map((record) => record.id) } },
      });
      if (earliestCreatedAt && earliestCreatedAt < canonicalRecord.createdAt) {
        await transaction.bookmark.update({
          where: { id: canonicalRecord.id },
          data: { createdAt: earliestCreatedAt },
        });
      }
      deduplicated += duplicateRecords.length;
      continue;
    }

    const winner = duplicateRecords[0];
    if (!winner) {
      continue;
    }
    const redundantIds = duplicateRecords.slice(1).map((record) => record.id);
    if (redundantIds.length > 0) {
      await transaction.bookmark.deleteMany({ where: { id: { in: redundantIds } } });
    }
    await transaction.bookmark.update({
      where: { id: winner.id },
      data: { paperId: canonicalPaperId },
    });
    moved += 1;
    deduplicated += redundantIds.length;
  }

  return { moved, deduplicated };
}

async function moveReadingProgress(
  transaction: Prisma.TransactionClient,
  canonicalPaperId: string,
  duplicatePaperIds: string[],
) {
  const progressRecords = await transaction.readingProgress.findMany({
    where: {
      paperId: { in: [canonicalPaperId, ...duplicatePaperIds] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      paperId: true,
      status: true,
      progressPercentage: true,
      startedAt: true,
      completedAt: true,
      lastReadAt: true,
      createdAt: true,
    },
  });
  const byUser = new Map<string, typeof progressRecords>();

  for (const progress of progressRecords) {
    const records = byUser.get(progress.userId) ?? [];
    records.push(progress);
    byUser.set(progress.userId, records);
  }

  let moved = 0;
  let deduplicated = 0;
  for (const records of byUser.values()) {
    const duplicateRecords = records.filter((record) => record.paperId !== canonicalPaperId);
    if (duplicateRecords.length === 0) {
      continue;
    }

    const canonicalRecord = records.find((record) => record.paperId === canonicalPaperId);
    const winner = canonicalRecord ?? duplicateRecords[0];
    if (!winner) {
      continue;
    }
    const redundantIds = records.filter((record) => record.id !== winner.id).map((record) => record.id);
    const merged = mergeReadingProgressValues(records);

    if (redundantIds.length > 0) {
      await transaction.readingProgress.deleteMany({ where: { id: { in: redundantIds } } });
    }
    await transaction.readingProgress.update({
      where: { id: winner.id },
      data: {
        paperId: canonicalPaperId,
        status: merged.status,
        progressPercentage: merged.progressPercentage,
        startedAt: merged.startedAt,
        completedAt: merged.completedAt,
        lastReadAt: merged.lastReadAt,
        createdAt: merged.createdAt,
      },
    });

    moved += canonicalRecord ? 0 : 1;
    deduplicated += redundantIds.length;
  }

  return { moved, deduplicated };
}

async function recordKeepBoth(
  transaction: Prisma.TransactionClient,
  adminUserId: string,
  input: KeepBothInput,
  group: DuplicateTitleGroup,
) {
  await transaction.duplicateGroupResolution.create({
    data: {
      groupKey: group.groupKey,
      groupFingerprint: group.groupFingerprint,
      resolution: "keep_both",
      canonicalPaperId: null,
      paperIds: group.paperIds,
      duplicatePaperIds: [],
      reason: input.reason,
      resolvedById: adminUserId,
    },
  });
  await transaction.adminPaperAuditLog.create({
    data: {
      adminUserId,
      action: "duplicate_group_kept",
      paperId: group.paperIds[0] as string,
      newValues: {
        groupFingerprint: group.groupFingerprint,
        paperIds: group.paperIds,
        resolution: "keep_both",
      },
      reason: input.reason,
    },
  });

  return {
    resolution: "keep_both" as const,
    groupFingerprint: group.groupFingerprint,
    paperIds: group.paperIds,
  };
}

async function recordMerge(
  transaction: Prisma.TransactionClient,
  adminUserId: string,
  input: MergeInput,
  group: DuplicateTitleGroup,
  suppliedPapers: Awaited<ReturnType<typeof validateCurrentGroup>>["suppliedPapers"],
  beforeFinalize?: () => Promise<void>,
) {
  const canonical = suppliedPapers.find((paper) => paper.id === input.canonicalPaperId);
  if (!canonical || input.duplicatePaperIds.includes(input.canonicalPaperId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select a valid canonical paper outside the duplicate list",
    });
  }
  if (canonical.status === "published" && !hasValidClassification(canonical.classification)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "A published canonical paper must have a complete classification",
    });
  }

  const duplicatePaperIds = group.paperIds.filter(
    (paperId) => paperId !== input.canonicalPaperId,
  );

  const sourceResult = await moveSources(
    transaction,
    input.canonicalPaperId,
    duplicatePaperIds,
  );
  const bookmarkResult = await moveBookmarks(
    transaction,
    input.canonicalPaperId,
    duplicatePaperIds,
  );
  const movedNotes = await moveNotes(transaction, input.canonicalPaperId, duplicatePaperIds);
  const progressResult = await moveReadingProgress(
    transaction,
    input.canonicalPaperId,
    duplicatePaperIds,
  );
  await beforeFinalize?.();
  const inactive = await transaction.paper.updateMany({
    where: {
      id: { in: duplicatePaperIds },
      status: { not: "inactive" },
    },
    data: { status: "inactive" },
  });

  if (inactive.count !== duplicatePaperIds.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A duplicate paper changed before the merge completed. Refresh and try again.",
    });
  }

  const moved = {
    sources: sourceResult.moved,
    bookmarks: bookmarkResult.moved,
    notes: movedNotes,
    readingProgress: progressResult.moved,
  };
  const deduplicated = {
    sources: sourceResult.deduplicated,
    bookmarks: bookmarkResult.deduplicated,
    readingProgress: progressResult.deduplicated,
  };

  await transaction.duplicateGroupResolution.create({
    data: {
      groupKey: group.groupKey,
      groupFingerprint: group.groupFingerprint,
      resolution: "merge",
      canonicalPaperId: input.canonicalPaperId,
      paperIds: group.paperIds,
      duplicatePaperIds,
      reason: input.reason,
      resolvedById: adminUserId,
    },
  });
  await transaction.adminPaperAuditLog.create({
    data: {
      adminUserId,
      action: "duplicate_group_merged",
      paperId: input.canonicalPaperId,
      previousValues: {
        groupFingerprint: group.groupFingerprint,
        paperIds: group.paperIds,
      },
      newValues: {
        canonicalPaperId: input.canonicalPaperId,
        duplicatePaperIds,
        moved,
        deduplicated,
        inactivePapers: inactive.count,
      },
      reason: input.reason,
    },
  });

  return {
    resolution: "merge" as const,
    groupFingerprint: group.groupFingerprint,
    canonicalPaperId: input.canonicalPaperId,
    duplicatePaperIds,
    moved,
    deduplicated,
    inactivePapers: inactive.count,
  };
}

async function resolveDuplicateGroupInternal(
  adminUserId: string,
  input: DuplicateGroupResolutionInput,
  beforeFinalizeMerge?: () => Promise<void>,
) {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const validated = await validateCurrentGroup(transaction, input);

        return input.resolution === "keep_both"
          ? await recordKeepBoth(
              transaction,
              adminUserId,
              input,
              validated.currentGroup,
            )
          : await recordMerge(
              transaction,
              adminUserId,
              input,
              validated.currentGroup,
              validated.suppliedPapers,
              beforeFinalizeMerge,
            );
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    if (hasErrorCode(error, "P2002")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This exact duplicate group has already been resolved",
      });
    }
    if (hasErrorCode(error, "P2034")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Duplicate group data changed during resolution. Refresh and try again.",
      });
    }

    console.error("[Duplicate Resolution] Transaction failed", {
      resolution: input.resolution,
      code: isRecord(error) && typeof error.code === "string" ? error.code : "unknown",
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to resolve duplicate group",
    });
  }
}

export async function resolveDuplicateGroup(
  adminUserId: string,
  input: DuplicateGroupResolutionInput,
) {
  return await resolveDuplicateGroupInternal(adminUserId, input);
}

export async function resolveDuplicateGroupWithRollbackProbeForTest(
  adminUserId: string,
  input: Extract<DuplicateGroupResolutionInput, { resolution: "merge" }>,
) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The duplicate-resolution rollback probe is available only in test mode.");
  }

  return await resolveDuplicateGroupInternal(adminUserId, input, async () => {
    throw new Error("Injected duplicate-resolution rollback probe");
  });
}
