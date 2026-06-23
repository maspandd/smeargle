import type { FieldDefinition, SchemaSnapshot } from "../schema/schema-types";

export type SchemaChangeKind =
  | "ADDED"
  | "DELETED"
  | "RENAMED"
  | "REORDERED"
  | "MODIFIED";

export type SchemaChange = {
  kind: SchemaChangeKind;
  fieldId: string;
  pathBefore: string | null;
  pathAfter: string | null;
  before: FieldDefinition | null;
  after: FieldDefinition | null;
};

export function diffSchemas(before: SchemaSnapshot, after: SchemaSnapshot): SchemaChange[] {
  return sortChanges(compareFieldLists(before.fields, after.fields, [], []));
}

function compareFieldLists(
  beforeFields: FieldDefinition[],
  afterFields: FieldDefinition[],
  beforeParentPath: string[],
  afterParentPath: string[],
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const beforeById = new Map(beforeFields.map((field) => [field.id, field]));
  const afterById = new Map(afterFields.map((field) => [field.id, field]));

  for (const beforeField of beforeFields) {
    if (!afterById.has(beforeField.id)) {
      changes.push({
        kind: "DELETED",
        fieldId: beforeField.id,
        pathBefore: joinPath(beforeParentPath, beforeField.name),
        pathAfter: null,
        before: beforeField,
        after: null,
      });
    }
  }

  for (const afterField of afterFields) {
    const beforeField = beforeById.get(afterField.id);

    if (!beforeField) {
      changes.push({
        kind: "ADDED",
        fieldId: afterField.id,
        pathBefore: null,
        pathAfter: joinPath(afterParentPath, afterField.name),
        before: null,
        after: afterField,
      });
      continue;
    }

    changes.push(...compareField(beforeField, afterField, beforeParentPath, afterParentPath));
  }

  changes.push(...compareReorder(beforeFields, afterFields, beforeParentPath, afterParentPath));

  return changes;
}

function compareField(
  beforeField: FieldDefinition,
  afterField: FieldDefinition,
  beforeParentPath: string[],
  afterParentPath: string[],
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const pathBefore = joinPath(beforeParentPath, beforeField.name);
  const pathAfter = joinPath(afterParentPath, afterField.name);

  if (beforeField.name !== afterField.name) {
    changes.push({
      kind: "RENAMED",
      fieldId: afterField.id,
      pathBefore,
      pathAfter,
      before: beforeField,
      after: afterField,
    });
  }

  if (hasFieldModification(beforeField, afterField)) {
    changes.push({
      kind: "MODIFIED",
      fieldId: afterField.id,
      pathBefore,
      pathAfter,
      before: beforeField,
      after: afterField,
    });
  }

  if (beforeField.type === "object" && afterField.type === "object") {
    changes.push(
      ...compareFieldLists(
        beforeField.fields,
        afterField.fields,
        [...beforeParentPath, beforeField.name],
        [...afterParentPath, afterField.name],
      ),
    );
  }

  if (beforeField.type === "array" && afterField.type === "array") {
    changes.push(
      ...compareArrayItem(
        beforeField.item,
        afterField.item,
        [...beforeParentPath, `${beforeField.name}[]`],
        [...afterParentPath, `${afterField.name}[]`],
      ),
    );
  }

  return changes;
}

function compareArrayItem(
  beforeField: FieldDefinition,
  afterField: FieldDefinition,
  beforeParentPath: string[],
  afterParentPath: string[],
): SchemaChange[] {
  const pathBefore = joinPath(beforeParentPath, beforeField.name);
  const pathAfter = joinPath(afterParentPath, afterField.name);
  const changes: SchemaChange[] = [];

  if (beforeField.name !== afterField.name) {
    changes.push({
      kind: "RENAMED",
      fieldId: afterField.id,
      pathBefore,
      pathAfter,
      before: beforeField,
      after: afterField,
    });
  }

  if (hasFieldModification(beforeField, afterField)) {
    changes.push({
      kind: "MODIFIED",
      fieldId: afterField.id,
      pathBefore,
      pathAfter,
      before: beforeField,
      after: afterField,
    });
  }

  if (beforeField.type === "object" && afterField.type === "object") {
    changes.push(
      ...compareFieldLists(
        beforeField.fields,
        afterField.fields,
        [...beforeParentPath, beforeField.name],
        [...afterParentPath, afterField.name],
      ),
    );
  }

  if (beforeField.type === "array" && afterField.type === "array") {
    changes.push(
      ...compareArrayItem(
        beforeField.item,
        afterField.item,
        [...beforeParentPath, `${beforeField.name}[]`],
        [...afterParentPath, `${afterField.name}[]`],
      ),
    );
  }

  return changes;
}

function compareReorder(
  beforeFields: FieldDefinition[],
  afterFields: FieldDefinition[],
  beforeParentPath: string[],
  afterParentPath: string[],
): SchemaChange[] {
  const commonBefore = beforeFields.filter((field) =>
    afterFields.some((afterField) => afterField.id === field.id),
  );
  const commonAfter = afterFields.filter((field) =>
    beforeFields.some((beforeField) => beforeField.id === field.id),
  );

  return commonBefore.flatMap((beforeField, beforeIndex) => {
    const afterIndex = commonAfter.findIndex((field) => field.id === beforeField.id);
    if (beforeIndex === afterIndex) {
      return [];
    }

    const afterField = commonAfter[afterIndex];
    return [
      {
        kind: "REORDERED" as const,
        fieldId: beforeField.id,
        pathBefore: joinPath(beforeParentPath, beforeField.name),
        pathAfter: joinPath(afterParentPath, afterField.name),
        before: beforeField,
        after: afterField,
      },
    ];
  });
}

function hasFieldModification(beforeField: FieldDefinition, afterField: FieldDefinition) {
  return JSON.stringify(stripStructuralChildren(beforeField)) !==
    JSON.stringify(stripStructuralChildren(afterField));
}

function stripStructuralChildren(field: FieldDefinition) {
  if (field.type === "object") {
    const { fields, ...rest } = field;
    void fields;
    return rest;
  }
  if (field.type === "array") {
    const { item, ...rest } = field;
    void item;
    return rest;
  }
  return field;
}

function joinPath(parentPath: string[], name: string) {
  return [...parentPath, name].join(".");
}

function sortChanges(changes: SchemaChange[]) {
  const kindOrder: Record<SchemaChangeKind, number> = {
    ADDED: 0,
    DELETED: 1,
    RENAMED: 2,
    REORDERED: 3,
    MODIFIED: 4,
  };

  return [...changes].sort((left, right) => {
    const leftPath = left.pathAfter ?? left.pathBefore ?? "";
    const rightPath = right.pathAfter ?? right.pathBefore ?? "";

    if (leftPath !== rightPath) {
      return leftPath.localeCompare(rightPath);
    }
    if (left.fieldId !== right.fieldId) {
      return left.fieldId.localeCompare(right.fieldId);
    }
    return kindOrder[left.kind] - kindOrder[right.kind];
  });
}
