import { describe, expect, test } from "bun:test";

import {
  getClassificationClientErrorMessage,
  INTERNAL_CLASSIFICATION_ERROR_MESSAGE,
  PaperClassificationServiceError,
} from "./classification-errors";

const unsafeFragments = [
  "Prisma",
  "Invalid invocation",
  "E:\\",
  "C:\\",
  "/home/",
  "node_modules",
  "DATABASE_URL",
  "SELECT",
];

function expectSanitized(error: unknown) {
  const message = getClassificationClientErrorMessage(error);

  expect(message).toBe(INTERNAL_CLASSIFICATION_ERROR_MESSAGE);
  for (const fragment of unsafeFragments) {
    expect(message).not.toContain(fragment);
  }
}

describe("classification client error sanitization", () => {
  test("maps an explicitly safe domain error", () => {
    const error = new PaperClassificationServiceError(
      "PAPER_INACTIVE",
      "Unsafe implementation detail must not be reused",
    );

    expect(getClassificationClientErrorMessage(error)).toBe(
      "Paper is no longer eligible for classification.",
    );
  });

  test("sanitizes a generic error", () => {
    expectSanitized(new Error("Unexpected classifier failure"));
  });

  test("sanitizes a Prisma-like error", () => {
    expectSanitized(new Error("Invalid Prisma invocation: SELECT * FROM papers"));
  });

  test("sanitizes a Windows local path", () => {
    expectSanitized(new Error("Failure at E:\\Code\\deepread\\node_modules\\client.js using DATABASE_URL"));
    expectSanitized(new Error("Failure at C:\\workspace\\deepread\\service.ts"));
  });

  test("sanitizes a Unix local path", () => {
    expectSanitized(new Error("Failure at /home/runner/work/deepread/node_modules/client.js"));
  });

  test("sanitizes a non-Error thrown value", () => {
    expectSanitized({ message: "Prisma Invalid invocation" });
  });
});
