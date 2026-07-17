"use client";

import type { AppRouter } from "@deepread/api/routers/index";
import { Button } from "@deepread/ui/components/button";
import { Input } from "@deepread/ui/components/input";
import { Label } from "@deepread/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import { invalidateAdminRemediationQueries } from "./admin-remediation-cache";
import { AdminDialog, AdminSpinner, getAdminMutationError } from "./admin-remediation-ui";

type UpdateMetadataInput = inferRouterInputs<AppRouter>["admin"]["papers"]["updateMetadata"];
type MetadataField = "authors" | "abstract" | "publicationYear" | "sourceUrl" | "pdfUrl" | "form";
type FieldErrors = Partial<Record<MetadataField, string>>;

export type PaperMetadataEditorInitialValues = {
  authors?: unknown;
  abstract?: string | null;
  publicationYear?: number | null;
  sourceUrl?: string | null;
  pdfUrl?: string | null;
};

function usableAuthors(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((author): author is string => typeof author === "string" && author.trim().length > 0);
}

function validHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function fieldFromError(field: string, message: string): MetadataField {
  if (field === "authors" || /author/i.test(message)) return "authors";
  if (field === "abstract" || /abstract/i.test(message)) return "abstract";
  if (field === "publicationYear" || /year/i.test(message)) return "publicationYear";
  if (field === "sourceUrl" || /source url/i.test(message)) return "sourceUrl";
  if (field === "pdfUrl" || /pdf/i.test(message)) return "pdfUrl";
  return "form";
}

export function PaperMetadataEditor({
  paperId,
  paperTitle,
  initialValues = {},
  onUpdated,
  triggerLabel = "Edit metadata",
  disabled = false,
}: {
  paperId: string;
  paperTitle: string;
  initialValues?: PaperMetadataEditorInitialValues;
  onUpdated?: () => void;
  triggerLabel?: string;
  disabled?: boolean;
}) {
  const formId = useId();
  const initialAuthors = usableAuthors(initialValues.authors);
  const [open, setOpen] = useState(false);
  const [authors, setAuthors] = useState<string[]>(initialAuthors.length > 0 ? initialAuthors : [""]);
  const [abstract, setAbstract] = useState(initialValues.abstract ?? "");
  const [publicationYear, setPublicationYear] = useState(
    initialValues.publicationYear === null || initialValues.publicationYear === undefined
      ? ""
      : String(initialValues.publicationYear),
  );
  const [sourceUrl, setSourceUrl] = useState(initialValues.sourceUrl ?? "");
  const [pdfUrl, setPdfUrl] = useState(initialValues.pdfUrl ?? "");
  const [touched, setTouched] = useState<Record<Exclude<MetadataField, "form">, boolean>>({
    authors: false,
    abstract: false,
    publicationYear: false,
    sourceUrl: false,
    pdfUrl: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const resetForm = () => {
    const nextAuthors = usableAuthors(initialValues.authors);
    setAuthors(nextAuthors.length > 0 ? nextAuthors : [""]);
    setAbstract(initialValues.abstract ?? "");
    setPublicationYear(
      initialValues.publicationYear === null || initialValues.publicationYear === undefined
        ? ""
        : String(initialValues.publicationYear),
    );
    setSourceUrl(initialValues.sourceUrl ?? "");
    setPdfUrl(initialValues.pdfUrl ?? "");
    setTouched({ authors: false, abstract: false, publicationYear: false, sourceUrl: false, pdfUrl: false });
    setErrors({});
  };

  const updateMetadata = useMutation(
    trpc.admin.papers.updateMetadata.mutationOptions({
      onSuccess: async () => {
        toast.success("Paper metadata updated");
        setOpen(false);
        resetForm();
        onUpdated?.();
        await invalidateAdminRemediationQueries();
      },
      onError: (error) => {
        const safeError = getAdminMutationError(error, "Paper metadata could not be updated.");
        setErrors({ [fieldFromError(safeError.field, safeError.message)]: safeError.message });
      },
    }),
  );

  const markTouched = (field: Exclude<MetadataField, "form">) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const submit = () => {
    const nextErrors: FieldErrors = {};
    const input: UpdateMetadataInput = { paperId };

    if (!Object.values(touched).some(Boolean)) {
      setErrors({ form: "Change at least one metadata field before saving." });
      return;
    }

    if (touched.authors) {
      const normalizedAuthors = authors.map((author) => author.trim()).filter(Boolean);
      if (normalizedAuthors.length === 0) {
        nextErrors.authors = "Add at least one author.";
      } else if (normalizedAuthors.some((author) => !/[\p{L}\p{N}]/u.test(author))) {
        nextErrors.authors = "Author names cannot contain only punctuation.";
      } else {
        input.authors = normalizedAuthors;
      }
    }

    if (touched.abstract) {
      const normalizedAbstract = abstract.trim();
      if (!normalizedAbstract) nextErrors.abstract = "Abstract cannot be blank.";
      else input.abstract = normalizedAbstract;
    }

    if (touched.publicationYear) {
      const normalizedYear = publicationYear.trim();
      if (!normalizedYear) {
        input.publicationYear = null;
      } else {
        const parsedYear = Number(normalizedYear);
        if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
          nextErrors.publicationYear = "Publication year must be between 1900 and 2100.";
        } else {
          input.publicationYear = parsedYear;
        }
      }
    }

    if (touched.sourceUrl) {
      const normalizedSourceUrl = sourceUrl.trim();
      if (!normalizedSourceUrl) nextErrors.sourceUrl = "Source URL cannot be blank.";
      else if (!validHttpUrl(normalizedSourceUrl)) nextErrors.sourceUrl = "Enter a valid HTTP or HTTPS URL.";
      else input.sourceUrl = normalizedSourceUrl;
    }

    if (touched.pdfUrl) {
      const normalizedPdfUrl = pdfUrl.trim();
      if (normalizedPdfUrl && !validHttpUrl(normalizedPdfUrl)) {
        nextErrors.pdfUrl = "Enter a valid HTTP or HTTPS URL.";
      } else {
        input.pdfUrl = normalizedPdfUrl || null;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    updateMetadata.mutate(input);
  };

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        size="sm"
        variant="outline"
      >
        <Pencil aria-hidden="true" />
        {triggerLabel}
      </Button>

      <AdminDialog
        busy={updateMetadata.isPending}
        contentClassName="overflow-hidden"
        description={`Update supported metadata for “${paperTitle}”. Untouched fields remain unchanged.`}
        onClose={() => setOpen(false)}
        open={open}
        title="Edit paper metadata"
      >
        <form
          aria-busy={updateMetadata.isPending}
          className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="grid gap-5">
          <fieldset className="min-w-0" disabled={updateMetadata.isPending}>
            <legend className="mb-2 text-xs font-medium">Authors</legend>
            <div className="grid gap-2">
              {authors.map((author, index) => {
                const inputId = `${formId}-author-${index}`;
                return (
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2" key={inputId}>
                    <Label className="sr-only" htmlFor={inputId}>Author {index + 1}</Label>
                    <Input
                      aria-describedby={errors.authors ? `${formId}-authors-error` : undefined}
                      aria-invalid={Boolean(errors.authors)}
                      className="min-w-0"
                      data-autofocus={index === 0 ? "true" : undefined}
                      id={inputId}
                      onChange={(event) => {
                        markTouched("authors");
                        setAuthors((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item));
                      }}
                      placeholder={`Author ${index + 1}`}
                      value={author}
                    />
                    <Button
                      aria-label={`Remove author ${index + 1}`}
                      className="shrink-0"
                      disabled={authors.length === 1}
                      onClick={() => {
                        markTouched("authors");
                        setAuthors((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              className="mt-2 w-fit"
              onClick={() => {
                markTouched("authors");
                setAuthors((current) => [...current, ""]);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" />
              Add author
            </Button>
            {errors.authors ? <p className="mt-1.5 text-xs text-destructive" id={`${formId}-authors-error`} role="alert">{errors.authors}</p> : null}
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-abstract`}>Abstract</Label>
            <textarea
              aria-describedby={errors.abstract ? `${formId}-abstract-error` : undefined}
              aria-invalid={Boolean(errors.abstract)}
              className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
              disabled={updateMetadata.isPending}
              id={`${formId}-abstract`}
              onChange={(event) => {
                markTouched("abstract");
                setAbstract(event.target.value);
              }}
              placeholder="Leave untouched to keep the current abstract"
              value={abstract}
            />
            {errors.abstract ? <p className="text-xs text-destructive" id={`${formId}-abstract-error`} role="alert">{errors.abstract}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetadataInput
              disabled={updateMetadata.isPending}
              error={errors.publicationYear}
              id={`${formId}-publication-year`}
              label="Publication year"
              max={2100}
              min={1900}
              onChange={(value) => {
                markTouched("publicationYear");
                setPublicationYear(value);
              }}
              type="number"
              value={publicationYear}
            />
            <MetadataInput
              disabled={updateMetadata.isPending}
              error={errors.sourceUrl}
              id={`${formId}-source-url`}
              label="Source URL"
              onChange={(value) => {
                markTouched("sourceUrl");
                setSourceUrl(value);
              }}
              type="url"
              value={sourceUrl}
            />
            <MetadataInput
              disabled={updateMetadata.isPending}
              error={errors.pdfUrl}
              id={`${formId}-pdf-url`}
              label="PDF URL"
              onChange={(value) => {
                markTouched("pdfUrl");
                setPdfUrl(value);
              }}
              type="url"
              value={pdfUrl}
            />
          </div>

          {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/80 bg-card px-5 py-4">
            <Button disabled={updateMetadata.isPending} onClick={() => setOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button aria-busy={updateMetadata.isPending} disabled={updateMetadata.isPending} type="submit">
              {updateMetadata.isPending ? <><AdminSpinner />Saving metadata</> : "Save metadata"}
            </Button>
          </footer>
        </form>
      </AdminDialog>
    </>
  );
}

function MetadataInput({
  id,
  label,
  value,
  onChange,
  error,
  type,
  min,
  max,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type: "number" | "url";
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? <p className="text-xs text-destructive" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
