import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const requestIdSymbol = Symbol("deepreadRequestId");

type RequestWithId = Request & {
  [requestIdSymbol]?: string;
};

function incomingRequestId(request: Request) {
  const value = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : null;
}

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestId = incomingRequestId(request) ?? randomUUID();
  (request as RequestWithId)[requestIdSymbol] = requestId;
  request.headers[REQUEST_ID_HEADER] = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(request: Request) {
  return (request as RequestWithId)[requestIdSymbol] ?? "unavailable";
}

export function getSafeErrorType(error: unknown) {
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)) {
    return error.name;
  }

  return typeof error;
}

export function logSanitizedRequestFailure(
  error: unknown,
  context: {
    operation: string;
    requestId: string;
    method: string;
    path: string;
  },
) {
  console.error("[Server Request Error]", {
    ...context,
    errorType: getSafeErrorType(error),
  });
}
