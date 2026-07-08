"use client";

import { Button } from "@deepread/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@deepread/ui/components/card";
import { Input } from "@deepread/ui/components/input";
import { Skeleton } from "@deepread/ui/components/skeleton";
import { cn } from "@deepread/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  Clock,
  FileText,
  Library,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { markProfileOverviewStale, queryClient, trpc } from "@/utils/trpc";

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

const textareaClassName =
  "min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatDifficulty(value: string | undefined) {
  return value?.replace("_", " ") ?? "Unclassified";
}

function getDifficultyClass(value: string | undefined) {
  switch (value) {
    case "beginner_friendly":
      return "bg-difficulty-beginner text-difficulty-beginner-foreground";
    case "moderate":
      return "bg-difficulty-moderate text-difficulty-moderate-foreground";
    case "difficult":
      return "bg-difficulty-difficult text-difficulty-difficult-foreground";
    case "expert":
      return "bg-difficulty-expert text-difficulty-expert-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function NotesOverview() {
  const groupedNotes = useQuery(trpc.notes.listMineGroupedByPaper.queryOptions());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [editingSection, setEditingSection] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const refreshNoteQueries = async (paperId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.notes.listMineGroupedByPaper.queryKey() }),
      queryClient.invalidateQueries({
        queryKey: trpc.notes.listForPaper.queryKey({ paperId }),
        refetchType: "none",
      }),
    ]);
  };

  const updateNote = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: async (data) => {
        setEditingId(null);
        setEditingNote("");
        setEditingSection("");
        await refreshNoteQueries(data.paperId);
        toast.success("Note updated");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const deleteNote = useMutation(
    trpc.notes.delete.mutationOptions({
      onSuccess: async (_data, variables) => {
        const deletedGroup = groupedNotes.data?.papers.find((group) =>
          group.notes.some((note) => note.id === variables.noteId),
        );
        setConfirmingDeleteId(null);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.notes.listMineGroupedByPaper.queryKey() }),
          ...(deletedGroup
            ? [
                queryClient.invalidateQueries({
                  queryKey: trpc.notes.listForPaper.queryKey({ paperId: deletedGroup.paper.id }),
                  refetchType: "none",
                }),
              ]
            : []),
          markProfileOverviewStale(),
        ]);
        toast.success("Note deleted");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (groupedNotes.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-5xl gap-7 px-4 py-8">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-24 rounded-lg" key={index} />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </main>
    );
  }

  if (groupedNotes.isError || !groupedNotes.data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card className="rounded-lg border-border/80 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 text-destructive" />
            <div className="grid gap-1">
              <div className="text-sm font-medium">Notes unavailable</div>
              <p className="text-sm leading-6 text-muted-foreground">Your notes could not be loaded.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const paperGroups = groupedNotes.data.papers;
  const totalNotes = paperGroups.reduce((total, group) => total + group.noteCount, 0);
  const latestUpdatedAt = paperGroups[0]?.latestUpdatedAt ?? null;
  const summaryItems = [
    { label: "Total notes", value: String(totalNotes), icon: NotebookPen },
    { label: "Papers with notes", value: String(paperGroups.length), icon: Library },
    { label: "Latest update", value: latestUpdatedAt ? formatDate(latestUpdatedAt) : "None yet", icon: CalendarClock },
  ] as const;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 md:py-10">
      <section className="grid gap-2 border-b pb-6">
        <p className="text-sm font-medium text-primary">Reading Notes</p>
        <h1 className="text-3xl font-semibold tracking-normal">Notes</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Review the points you saved while reading papers across DeepRead.
        </p>
      </section>

      <section aria-label="Notes summary" className="grid gap-3 sm:grid-cols-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card className="rounded-lg border-border/80 shadow-sm" key={item.label} size="sm">
              <CardContent className="flex items-center justify-between gap-4 py-2">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-lg font-semibold">{item.value}</span>
                </div>
                <Icon className="text-primary" />
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="notes-list-heading" className="grid gap-4">
        <h2 className="text-lg font-semibold" id="notes-list-heading">
          Notes by Paper
        </h2>

        {paperGroups.length ? (
          <div className="grid gap-5">
            {paperGroups.map((group) => (
              <Card className="rounded-lg border-border/80 shadow-sm" key={group.paper.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md border bg-background px-2.5 py-1">{group.paper.category.name}</span>
                    <span
                      className={cn(
                        "rounded-md px-2.5 py-1 capitalize",
                        getDifficultyClass(group.paper.classification?.difficultyLevel),
                      )}
                    >
                      {formatDifficulty(group.paper.classification?.difficultyLevel)}
                    </span>
                    {group.paper.classification ? (
                      <>
                        <span className="rounded-md border bg-background px-2.5 py-1">
                          Score {group.paper.classification.beginnerScore}/100
                        </span>
                        <span className="rounded-md border bg-background px-2.5 py-1">
                          {group.paper.classification.estimatedReadingTime} min read
                        </span>
                      </>
                    ) : null}
                    <span className="rounded-md border bg-background px-2.5 py-1">
                      {group.noteCount} {group.noteCount === 1 ? "note" : "notes"}
                    </span>
                  </div>
                  <CardTitle className="text-lg leading-7">
                    <Link className="hover:text-primary" href={`/papers/${group.paper.id}`}>
                      {group.paper.title}
                    </Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Latest update {formatDate(group.latestUpdatedAt)}</p>
                </CardHeader>

                <CardContent>
                  <div className="divide-y divide-border">
                    {group.notes.map((item) => {
                      const isEditing = editingId === item.id;
                      const isConfirmingDelete = confirmingDeleteId === item.id;
                      const isDeletingThisNote = deleteNote.isPending && deleteNote.variables?.noteId === item.id;

                      return (
                        <article className="grid gap-3 py-5 first:pt-0 last:pb-0" key={item.id}>
                          {isEditing ? (
                            <div className="grid gap-3">
                              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                                Note
                                <textarea
                                  className={textareaClassName}
                                  disabled={updateNote.isPending}
                                  maxLength={2000}
                                  onChange={(event) => setEditingNote(event.target.value)}
                                  value={editingNote}
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                                Section (optional)
                                <Input
                                  className="h-9 rounded-md bg-background text-sm"
                                  disabled={updateNote.isPending}
                                  maxLength={100}
                                  onChange={(event) => setEditingSection(event.target.value)}
                                  value={editingSection}
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <Button
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
                                  {updateNote.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                                <Button
                                  disabled={updateNote.isPending}
                                  onClick={() => setEditingId(null)}
                                  size="sm"
                                  variant="outline"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-2">
                                {item.section ? <p className="text-xs font-medium text-primary">{item.section}</p> : null}
                                <p className="break-words whitespace-pre-wrap text-sm leading-7 text-foreground">
                                  {item.note}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Created {formatDate(item.createdAt)}
                                  {item.updatedAt !== item.createdAt ? ` - Updated ${formatDate(item.updatedAt)}` : ""}
                                </p>
                              </div>

                              <div className="flex flex-wrap justify-end gap-2">
                                {isConfirmingDelete ? (
                                  <>
                                    <Button
                                      disabled={deleteNote.isPending}
                                      onClick={() => setConfirmingDeleteId(null)}
                                      size="sm"
                                      variant="outline"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      disabled={deleteNote.isPending}
                                      onClick={() => deleteNote.mutate({ noteId: item.id })}
                                      size="sm"
                                      variant="destructive"
                                    >
                                      <Trash2 data-icon="inline-start" />
                                      {isDeletingThisNote ? "Deleting..." : "Confirm Delete"}
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      disabled={deleteNote.isPending || updateNote.isPending}
                                      onClick={() => {
                                        setConfirmingDeleteId(null);
                                        setEditingId(item.id);
                                        setEditingNote(item.note);
                                        setEditingSection(item.section ?? "");
                                      }}
                                      size="sm"
                                      variant="ghost"
                                    >
                                      <Pencil data-icon="inline-start" />
                                      Edit
                                    </Button>
                                    <Button
                                      disabled={deleteNote.isPending || updateNote.isPending}
                                      onClick={() => setConfirmingDeleteId(item.id)}
                                      size="sm"
                                      variant="destructive"
                                    >
                                      <Trash2 data-icon="inline-start" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </CardContent>

                <CardFooter className="flex-wrap gap-2">
                  <Button nativeButton={false} render={<Link href={`/papers/${group.paper.id}`} />} variant="outline">
                    <FileText data-icon="inline-start" />
                    View Paper
                  </Button>
                  <Button
                    nativeButton={false}
                    render={<Link href={`/papers/${group.paper.id}/read`} />}
                    variant="outline"
                  >
                    <BookOpen data-icon="inline-start" />
                    Continue Reading
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-lg border-dashed border-border/80 shadow-none">
            <CardHeader>
              <CardTitle>No notes yet</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Open a paper and add a note to collect important ideas here.
              </p>
              <Button className="w-fit" nativeButton={false} render={<Link href="/papers" />}>
                Browse Papers
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
