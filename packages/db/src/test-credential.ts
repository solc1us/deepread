import { hashPassword } from "better-auth/crypto";

export function hashTestCredentialPassword(password: string) {
  return hashPassword(password);
}
