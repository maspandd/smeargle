import type { FieldDeletion, FieldRename } from "../schema/compatibility";

type JsonObject = Record<string, unknown>;

export function deleteRecordKeys<T extends JsonObject>(
  records: T[],
  deletions: FieldDeletion[],
): T[] {
  return records.map((record) => {
    let next = cloneJson(record);

    for (const deletion of deletions) {
      next = deleteAtPath(next, splitPath(deletion.path)) as T;
    }

    return next;
  });
}

export function renameRecordKeys<T extends JsonObject>(
  records: T[],
  renames: FieldRename[],
): T[] {
  return records.map((record) => {
    let next = cloneJson(record);

    for (const rename of renames) {
      next = renameAtPath(
        next,
        splitPath(rename.fromPath),
        splitPath(rename.toPath),
      ) as T;
    }

    return next;
  });
}

function deleteAtPath(value: unknown, path: string[]): unknown {
  if (path.length === 0) return value;
  if (Array.isArray(value)) {
    return value.map((item) => deleteAtPath(item, path));
  }
  if (!isJsonObject(value)) {
    return value;
  }

  const [segment, ...rest] = path;
  if (!(segment in value)) {
    return value;
  }

  if (rest.length === 0) {
    const next = { ...value };
    delete next[segment];
    return next;
  }

  return {
    ...value,
    [segment]: deleteAtPath(value[segment], rest),
  };
}

function renameAtPath(
  value: unknown,
  fromPath: string[],
  toPath: string[],
): unknown {
  if (fromPath.length === 0 || toPath.length === 0) return value;
  if (Array.isArray(value)) {
    return value.map((item) => renameAtPath(item, fromPath, toPath));
  }
  if (!isJsonObject(value)) {
    return value;
  }

  const [fromSegment, ...fromRest] = fromPath;
  const [toSegment, ...toRest] = toPath;

  if (!(fromSegment in value)) {
    return value;
  }

  if (fromRest.length === 0 && toRest.length === 0) {
    const next = { ...value, [toSegment]: value[fromSegment] };
    delete next[fromSegment];
    return next;
  }

  if (fromSegment !== toSegment) {
    return value;
  }

  return {
    ...value,
    [fromSegment]: renameAtPath(value[fromSegment], fromRest, toRest),
  };
}

function splitPath(path: string) {
  return path.split(".").filter(Boolean);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
