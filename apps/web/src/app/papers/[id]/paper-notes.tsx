"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Input } from "@deepread/ui/components/input";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { markNotesOverviewStale, markProfileOverviewStale, queryClient, trpc } from "@/utils/trpc";

type PaperNotesProps = {
  paperId: string;
  isAuthenticated: boolean;
  isAuthPending: boolean;
};

const textareaClassName =
  "min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export default function PaperNotes({ paperId, isAuthenticated, isAuthPending }: PaperNotesProps) {
  const [note, setNote] = useState("");
  const [section, setSection] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [editingSection, setEditingSection] = useState("");

  const notes = useQuery({
    ...trpc.notes.listForPaper.queryOptions({ paperId }),
    enabled: isAuthenticated,
  });
  const refreshNotes = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.notes.listForPaper.queryKey({ paperId }) }),
      markNotesOverviewStale(),
    ]);
  };

  const createNote = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: async () => {
        setNote("");
        setSection("");
        await Promise.all([refreshNotes(), markProfileOverviewStale()]);
        toast.success("Note added");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const updateNote = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: async () => {
        setEditingId(null);
        setEditingNote("");
        setEditingSection("");
        await refreshNotes();
        toast.success("Note updated");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const deleteNote = useMutation(
    trpc.notes.delete.mutationOptions({
      onSuccess: async () => {
        await Promise.all([refreshNotes(), markProfileOverviewStale()]);
        toast.success("Note deleted");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (isAuthPending) {
    return (
      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Reading Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Skeleton className="h-24 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="rounded-lg border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Reading Notes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Sign in to keep private notes for this paper.</p>
          <Button className="rounded-md" nativeButton={false} render={<Link href="/login" />} variant="outline">
            Sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Reading Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedNote = note.trim();

            if (!trimmedNote) {
              toast.error("Note cannot be empty");
              return;
            }

            createNote.mutate({
              paperId,
              note: trimmedNote,
              section: section.trim() || undefined,
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Note
            <textarea
              className={textareaClassName}
              disabled={createNote.isPending}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Write a point you want to remember"
              value={note}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Section (optional)
            <Input
              className="h-9 rounded-md bg-background text-sm"
              disabled={createNote.isPending}
              maxLength={100}
              onChange={(event) => setSection(event.target.value)}
              placeholder="Abstract, Methods, Results"
              value={section}
            />
          </label>
          <Button className="w-fit rounded-md" disabled={createNote.isPending} type="submit">
            <Plus data-icon="inline-start" />
            {createNote.isPending ? "Adding..." : "Add Note"}
          </Button>
        </form>

        <div className="flex flex-col gap-3 border-t pt-5">
          {notes.isLoading ? (
            <>
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </>
          ) : notes.isError ? (
            <p className="text-sm text-destructive">Unable to load notes.</p>
          ) : notes.data?.length ? (
            notes.data.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <article className="flex flex-col gap-3 rounded-md border bg-background p-3" key={item.id}>
                  {isEditing ? (
                    <>
                      <textarea
                        className={textareaClassName}
                        maxLength={2000}
                        onChange={(event) => setEditingNote(event.target.value)}
                        value={editingNote}
                      />
                      <Input
                        className="h-9 rounded-md text-sm"
                        maxLength={100}
                        onChange={(event) => setEditingSection(event.target.value)}
                        placeholder="Section (optional)"
                        value={editingSection}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="rounded-md"
                          disabled={updateNote.isPending}
                          onClick={() => {
                            const trimmedNote = editingNote.trim();

                            if (!trimmedNote) {
                              toast.error("Note cannot be empty");
                              return;
                            }

                            updateNote.mutate({
                              noteId: item.id,
                              note: trimmedNote,
                              section: editingSection.trim(),
                            });
                          }}
                          size="sm"
                        >
                          {updateNote.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          className="rounded-md"
                          disabled={updateNote.isPending}
                          onClick={() => setEditingId(null)}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          {item.section ? <div className="text-xs font-medium text-primary">{item.section}</div> : null}
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{item.note}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            aria-label="Edit note"
                            disabled={deleteNote.isPending}
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingNote(item.note);
                              setEditingSection(item.section ?? "");
                            }}
                            size="icon-sm"
                            title="Edit note"
                            variant="ghost"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            aria-label="Delete note"
                            disabled={deleteNote.isPending}
                            onClick={() => deleteNote.mutate({ noteId: item.id })}
                            size="icon-sm"
                            title="Delete note"
                            variant="destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet. Add your first note above.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
