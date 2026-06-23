import { randomBytes } from "node:crypto";

export function createFieldId() {
  return `fld_${randomBytes(18).toString("base64url")}`;
}
