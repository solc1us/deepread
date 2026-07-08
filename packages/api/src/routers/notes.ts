import prisma from "@deepread/db";

import { protectedProcedure, router } from "../index";
import {
  createNoteInputSchema,
  ensurePaperExists,
  ensurePublishedPaper,
  noteIdInputSchema,
  paperIdInputSchema,
  readingNoteSelect,
  requireOwnedNote,
  updateNoteInputSchema,
} from "./shared";

export const notesRouter = router({
  listMineGroupedByPaper: protectedProcedure.query(async ({ ctx }) => {
    const notes = await prisma.readingNote.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        note: true,
        section: true,
        createdAt: true,
        updatedAt: true,
        paper: {
          select: {
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
          },
        },
      },
    });

    const paperGroups = new Map<
      string,
      {
        paper: (typeof notes)[number]["paper"];
        noteCount: number;
        latestUpdatedAt: string;
        notes: Array<{
          id: string;
          note: string;
          section: string | null;
          createdAt: string;
          updatedAt: string;
        }>;
      }
    >();

    for (const note of notes) {
      let group = paperGroups.get(note.paper.id);

      if (!group) {
        group = {
          paper: note.paper,
          noteCount: 0,
          latestUpdatedAt: note.updatedAt.toISOString(),
          notes: [],
        };
        paperGroups.set(note.paper.id, group);
      }

      group.noteCount += 1;
      group.notes.push({
        id: note.id,
        note: note.note,
        section: note.section,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      });
    }

    return {
      papers: Array.from(paperGroups.values()),
    };
  }),
  listForPaper: protectedProcedure.input(paperIdInputSchema).query(async ({ ctx, input }) => {
    await ensurePaperExists(input.paperId);

    return await prisma.readingNote.findMany({
      where: {
        userId: ctx.session.user.id,
        paperId: input.paperId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: readingNoteSelect,
    });
  }),
  create: protectedProcedure.input(createNoteInputSchema).mutation(async ({ ctx, input }) => {
    await ensurePublishedPaper(input.paperId);

    return await prisma.readingNote.create({
      data: {
        userId: ctx.session.user.id,
        paperId: input.paperId,
        note: input.note,
        section: input.section || null,
      },
      select: readingNoteSelect,
    });
  }),
  update: protectedProcedure.input(updateNoteInputSchema).mutation(async ({ ctx, input }) => {
    await requireOwnedNote(input.noteId, ctx.session.user.id);

    return await prisma.readingNote.update({
      where: {
        id: input.noteId,
        userId: ctx.session.user.id,
      },
      data: {
        note: input.note,
        ...(input.section !== undefined ? { section: input.section || null } : {}),
      },
      select: readingNoteSelect,
    });
  }),
  delete: protectedProcedure.input(noteIdInputSchema).mutation(async ({ ctx, input }) => {
    await requireOwnedNote(input.noteId, ctx.session.user.id);

    await prisma.readingNote.delete({
      where: {
        id: input.noteId,
        userId: ctx.session.user.id,
      },
    });

    return {
      success: true,
    };
  }),
});
