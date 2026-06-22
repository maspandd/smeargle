import { randomBytes } from "node:crypto";

export function createRouteKey(): string {
  return randomBytes(18).toString("base64url");
}
