import type { Prisma } from "@deepread/db";

export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toPrismaJsonValue);
  }

  if (typeof value === "object") {
    return toPrismaJsonObject(value);
  }

  return null;
}

export function toPrismaJsonObject(value: object): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, toPrismaJsonValue(item)]),
  );
}
