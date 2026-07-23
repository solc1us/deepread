import { describe, expect, test } from "bun:test";
import type { Prisma } from "@deepread/db";

import type { NormalizedOpenAlexPaper } from "./openalex";
import { buildOpenAlexPaperCreateData } from "./openalex-ingestion-payload";
import { toPrismaJsonObject, toPrismaJsonValue } from "./openalex-json";

describe("OpenAlex Prisma JSON conversion", () => {
  test("preserves nested objects and arrays while removing undefined object properties", () => {
    expect(
      toPrismaJsonObject({
        title: "Paper",
        omitted: undefined,
        nested: {
          retained: true,
          omitted: undefined,
          values: [1, "two", null, { retained: "yes", omitted: undefined }],
        },
      }),
    ).toEqual({
      title: "Paper",
      nested: {
        retained: true,
        values: [1, "two", null, { retained: "yes" }],
      },
    });
  });

  test("converts non-finite and unsupported values to nested JSON null", () => {
    expect(
      toPrismaJsonObject({
        nan: Number.NaN,
        positiveInfinity: Number.POSITIVE_INFINITY,
        negativeInfinity: Number.NEGATIVE_INFINITY,
        unsupportedFunction: () => undefined,
        unsupportedSymbol: Symbol("unsupported"),
        values: [undefined, Number.NaN],
      }),
    ).toEqual({
      nan: null,
      positiveInfinity: null,
      negativeInfinity: null,
      unsupportedFunction: null,
      unsupportedSymbol: null,
      values: [null, null],
    });
    expect(toPrismaJsonValue(undefined)).toBeNull();
  });

  test("builds the exact Prisma paper create payload with JSON-safe raw metadata", () => {
    const fetchedAt = new Date("2026-07-23T00:00:00.000Z");
    const paper: NormalizedOpenAlexPaper = {
      openAlexId: "W123",
      title: "Typed ingestion payload",
      abstract: "A complete abstract used by the ingestion payload test.",
      authors: ["Ada Author"],
      publicationYear: 2026,
      doi: "10.1000/example",
      sourceName: null,
      sourceUrl: "https://openalex.org/W123",
      pdfUrl: null,
      keywords: ["testing"],
      rawMetadata: {
        id: "https://openalex.org/W123",
        nested: {
          finite: 2,
          nonFinite: Number.POSITIVE_INFINITY,
          omitted: undefined,
        },
      },
    };

    const data: Prisma.PaperUncheckedCreateInput = buildOpenAlexPaperCreateData(
      paper,
      "11111111-1111-1111-1111-111111111111",
      fetchedAt,
    );

    expect(data).toMatchObject({
      title: paper.title,
      sourceName: "OpenAlex",
      categoryId: "11111111-1111-1111-1111-111111111111",
      sources: {
        create: {
          provider: "openalex",
          externalId: "W123",
          rawMetadata: {
            id: "https://openalex.org/W123",
            nested: {
              finite: 2,
              nonFinite: null,
            },
          },
          fetchedAt,
        },
      },
    });
  });
});
