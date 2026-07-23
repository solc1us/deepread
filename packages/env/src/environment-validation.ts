import { z } from "zod";

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);
export function httpOriginSchema(name: string) {
  return z
    .string()
    .trim()
    .url()
    .superRefine((value, context) => {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        context.addIssue({
          code: "custom",
          message: `${name} must use the http or https protocol.`,
        });
      }
      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        context.addIssue({
          code: "custom",
          message: `${name} must be an origin without credentials, a path, query, or fragment.`,
        });
      }
    })
    .transform((value) => new URL(value).origin);
}

function isLocalUrl(value: string) {
  return LOCAL_HOSTNAMES.has(new URL(value).hostname.toLowerCase());
}

export function validateProductionWebOrigin(input: {
  nodeEnv: string | undefined;
  serverUrl: string;
}) {
  if (input.nodeEnv !== "production") return;

  const url = new URL(input.serverUrl);
  if (url.protocol === "https:" && !isLocalUrl(input.serverUrl)) return;

  throw new Error(
    "[Environment] NEXT_PUBLIC_SERVER_URL must be an explicit HTTPS non-local web origin for production builds.",
  );
}

export function validateProductionWebProxy(input: {
  nodeEnv: string | undefined;
  publicWebOrigin: string;
  apiUpstreamUrl: string;
}) {
  if (input.nodeEnv !== "production") return;

  const upstream = new URL(input.apiUpstreamUrl);
  if (upstream.protocol !== "https:" || isLocalUrl(input.apiUpstreamUrl)) {
    throw new Error(
      "[Environment] API_UPSTREAM_URL must be an explicit HTTPS non-local API origin for production builds.",
    );
  }

  if (input.publicWebOrigin === input.apiUpstreamUrl) {
    throw new Error(
      "[Environment] API_UPSTREAM_URL must differ from NEXT_PUBLIC_SERVER_URL to prevent a proxy loop.",
    );
  }
}
