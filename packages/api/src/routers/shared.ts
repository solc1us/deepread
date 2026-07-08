import prisma from "@deepread/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const difficultyLevelSchema = z.enum(["beginner_friendly", "moderate", "difficult", "expert"]);
export const paperSortSchema = z.enum(["beginner_score", "newest", "title"]);
export const paperIdInputSchema = z.object({
  paperId: z.string().uuid(),
});
export const updateReadingProgressInputSchema = paperIdInputSchema.extend({
  progressPercentage: z.number().int().min(0).max(100),
});
export const noteTextSchema = z.string().trim().min(1).max(2000);
export const noteSectionSchema = z.string().trim().max(100).optional();
export const createNoteInputSchema = paperIdInputSchema.extend({
  note: noteTextSchema,
  section: noteSectionSchema,
});
export const updateNoteInputSchema = z.object({
  noteId: z.string().uuid(),
  note: noteTextSchema,
  section: noteSectionSchema,
});
export const noteIdInputSchema = z.object({
  noteId: z.string().uuid(),
});

export type ReadingStatusValue = "not_started" | "reading" | "completed";

export const readingProgressSelect = {
  id: true,
  paperId: true,
  status: true,
  progressPercentage: true,
  startedAt: true,
  completedAt: true,
  lastReadAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const bookmarkSelect = {
  id: true,
  paperId: true,
  createdAt: true,
  paper: {
    select: {
      id: true,
      title: true,
      abstract: true,
      authors: true,
      publicationYear: true,
      sourceName: true,
      sourceUrl: true,
      pdfUrl: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      classification: {
        select: {
          difficultyLevel: true,
          beginnerScore: true,
          estimatedReadingTime: true,
        },
      },
    },
  },
} as const;

export const readingNoteSelect = {
  id: true,
  paperId: true,
  note: true,
  section: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const profilePaperSelect = {
  id: true,
  title: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  classification: {
    select: {
      difficultyLevel: true,
      beginnerScore: true,
      estimatedReadingTime: true,
    },
  },
} as const;

export function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function ensurePublishedPaper(paperId: string) {
  const paper = await prisma.paper.findFirst({
    where: {
      id: paperId,
      status: "published",
    },
    select: {
      id: true,
    },
  });

  if (!paper) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Published paper not found",
    });
  }

  return paper;
}

export async function ensurePaperExists(paperId: string) {
  const paper = await prisma.paper.findUnique({
    where: {
      id: paperId,
    },
    select: {
      id: true,
    },
  });

  if (!paper) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Paper not found",
    });
  }

  return paper;
}

export async function requireOwnedNote(noteId: string, userId: string) {
  const note = await prisma.readingNote.findUnique({
    where: {
      id: noteId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!note) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Reading note not found",
    });
  }

  if (note.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this reading note",
    });
  }

  return note;
}

export function mapBookmark(bookmark: {
  id: string;
  paperId: string;
  createdAt: Date;
  paper: {
    id: string;
    title: string;
    abstract: string;
    authors: unknown;
    publicationYear: number | null;
    sourceName: string;
    sourceUrl: string;
    pdfUrl: string | null;
    category: {
      id: string;
      name: string;
    };
    classification: {
      difficultyLevel: "beginner_friendly" | "moderate" | "difficult" | "expert";
      beginnerScore: number;
      estimatedReadingTime: number;
    } | null;
  };
}) {
  return {
    id: bookmark.id,
    paperId: bookmark.paperId,
    createdAt: bookmark.createdAt,
    paper: {
      ...bookmark.paper,
      authors: toStringArray(bookmark.paper.authors),
    },
  };
}
