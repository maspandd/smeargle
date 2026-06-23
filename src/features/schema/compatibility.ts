import type {
  ArrayField,
  DateField,
  FieldDefinition,
  NumberField,
  ObjectField,
  SchemaSnapshot,
  StringField,
} from "./schema-types";

export type CompatibilityKind = "COMPATIBLE" | "TRANSFORMABLE" | "INCOMPATIBLE";

export type CompatibilityOperation =
  | "NONE"
  | "DELETE_KEYS"
  | "RENAME_KEYS"
  | "MIXED"
  | "REGENERATE_RECORDS";

export type FieldDeletion = {
  fieldId: string;
  path: string;
};

export type FieldRename = {
  fieldId: string;
  fromPath: string;
  toPath: string;
};

export type SchemaCompatibility = {
  kind: CompatibilityKind;
  operation: CompatibilityOperation;
  affectedFieldIds: string[];
  affectedPaths: string[];
  deletions: FieldDeletion[];
  renames: FieldRename[];
  warning: string | null;
};

type CompatibilityChange =
  | {
      kind: "DELETE";
      fieldId: string;
      path: string;
    }
  | {
      kind: "RENAME";
      fieldId: string;
      fromPath: string;
      toPath: string;
    }
  | {
      kind: "INCOMPATIBLE";
      fieldId: string;
      path: string;
    };

export function classifySchemaChange(
  before: SchemaSnapshot,
  after: SchemaSnapshot,
): SchemaCompatibility {
  const changes = compareFields(before.fields, after.fields, []);
  const incompatible = changes.filter((change) => change.kind === "INCOMPATIBLE");

  if (incompatible.length > 0) {
    return {
      kind: "INCOMPATIBLE",
      operation: "REGENERATE_RECORDS",
      affectedFieldIds: unique(incompatible.map((change) => change.fieldId)),
      affectedPaths: unique(incompatible.map((change) => change.path)),
      deletions: [],
      renames: [],
      warning: "Existing generated data is incompatible with this schema change.",
    };
  }

  const deletions = changes.filter((change) => change.kind === "DELETE");
  const renames = changes.filter((change) => change.kind === "RENAME");

  if (deletions.length > 0 || renames.length > 0) {
    const operation =
      deletions.length > 0 && renames.length > 0
        ? "MIXED"
        : deletions.length > 0
          ? "DELETE_KEYS"
          : "RENAME_KEYS";

    return {
      kind: "TRANSFORMABLE",
      operation,
      affectedFieldIds: unique(changes.map((change) => change.fieldId)),
      affectedPaths: unique(
        changes.flatMap((change) => {
          switch (change.kind) {
            case "DELETE":
            case "INCOMPATIBLE":
              return [change.path];
            case "RENAME":
              return [change.fromPath, change.toPath];
          }
        }),
      ),
      deletions: deletions.map((change) => ({
        fieldId: change.fieldId,
        path: change.path,
      })),
      renames: renames.map((change) => ({
        fieldId: change.fieldId,
        fromPath: change.fromPath,
        toPath: change.toPath,
      })),
      warning: "Existing generated data must be transformed to match this schema change.",
    };
  }

  return {
    kind: "COMPATIBLE",
    operation: "NONE",
    affectedFieldIds: [],
    affectedPaths: [],
    deletions: [],
    renames: [],
    warning: null,
  };
}

function compareFields(
  beforeFields: FieldDefinition[],
  afterFields: FieldDefinition[],
  parentPath: string[],
): CompatibilityChange[] {
  const changes: CompatibilityChange[] = [];
  const beforeById = new Map(beforeFields.map((field) => [field.id, field]));
  const afterById = new Map(afterFields.map((field) => [field.id, field]));

  for (const beforeField of beforeFields) {
    if (!afterById.has(beforeField.id)) {
      changes.push({
        kind: "DELETE",
        fieldId: beforeField.id,
        path: pathOf(parentPath, beforeField.name),
      });
    }
  }

  for (const afterField of afterFields) {
    const beforeField = beforeById.get(afterField.id);

    if (!beforeField) {
      if (afterField.required) {
        changes.push({
          kind: "INCOMPATIBLE",
          fieldId: afterField.id,
          path: pathOf(parentPath, afterField.name),
        });
      }
      continue;
    }

    changes.push(...compareField(beforeField, afterField, parentPath));
  }

  return changes;
}

function compareField(
  beforeField: FieldDefinition,
  afterField: FieldDefinition,
  parentPath: string[],
): CompatibilityChange[] {
  const beforePath = pathOf(parentPath, beforeField.name);
  const afterPath = pathOf(parentPath, afterField.name);
  const changes: CompatibilityChange[] = [];

  if (beforeField.name !== afterField.name) {
    changes.push({
      kind: "RENAME",
      fieldId: afterField.id,
      fromPath: beforePath,
      toPath: afterPath,
    });
  }

  if (beforeField.type !== afterField.type) {
    changes.push({
      kind: "INCOMPATIBLE",
      fieldId: afterField.id,
      path: afterPath,
    });
    return changes;
  }

  if (!beforeField.required && afterField.required) {
    changes.push({
      kind: "INCOMPATIBLE",
      fieldId: afterField.id,
      path: afterPath,
    });
  }

  switch (afterField.type) {
    case "string":
      if (isNarrowedString(beforeField as StringField, afterField)) {
        changes.push({
          kind: "INCOMPATIBLE",
          fieldId: afterField.id,
          path: afterPath,
        });
      }
      return changes;
    case "number":
      if (isNarrowedNumber(beforeField as NumberField, afterField)) {
        changes.push({
          kind: "INCOMPATIBLE",
          fieldId: afterField.id,
          path: afterPath,
        });
      }
      return changes;
    case "date":
      if (isNarrowedDate(beforeField as DateField, afterField)) {
        changes.push({
          kind: "INCOMPATIBLE",
          fieldId: afterField.id,
          path: afterPath,
        });
      }
      return changes;
    case "object":
      return [
        ...changes,
        ...compareFields((beforeField as ObjectField).fields, afterField.fields, [
          ...parentPath,
          afterField.name,
        ]),
      ];
    case "array":
      if (isNarrowedArray(beforeField as ArrayField, afterField)) {
        changes.push({
          kind: "INCOMPATIBLE",
          fieldId: afterField.id,
          path: afterPath,
        });
      }
      return [
        ...changes,
        ...compareField(
          (beforeField as ArrayField).item,
          afterField.item,
          [...parentPath, afterField.name],
        ),
      ];
    case "boolean":
    case "email":
      return changes;
  }
}

function isNarrowedString(beforeField: StringField, afterField: StringField) {
  return (
    grew(beforeField.minLength, afterField.minLength) ||
    shrank(beforeField.maxLength, afterField.maxLength)
  );
}

function isNarrowedNumber(beforeField: NumberField, afterField: NumberField) {
  return (
    grew(beforeField.min, afterField.min) ||
    shrank(beforeField.max, afterField.max) ||
    shrank(beforeField.precision, afterField.precision)
  );
}

function isNarrowedDate(beforeField: DateField, afterField: DateField) {
  return (
    grew(beforeField.minDate, afterField.minDate) ||
    shrank(beforeField.maxDate, afterField.maxDate)
  );
}

function isNarrowedArray(beforeField: ArrayField, afterField: ArrayField) {
  return (
    grew(beforeField.minItems, afterField.minItems) ||
    shrank(beforeField.maxItems, afterField.maxItems)
  );
}

function grew<T extends number | string>(before: T | undefined, after: T | undefined) {
  return before !== undefined && after !== undefined && after > before;
}

function shrank<T extends number | string>(before: T | undefined, after: T | undefined) {
  return before !== undefined && after !== undefined && after < before;
}

function pathOf(parentPath: string[], name: string) {
  return [...parentPath, name].join(".");
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
