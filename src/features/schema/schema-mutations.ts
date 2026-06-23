import { parseSchema } from "./schema-parser";
import type { FieldDefinition, ObjectField, SchemaSnapshot } from "./schema-types";

export function addField(
  snapshot: SchemaSnapshot,
  parentFieldPath: string[],
  field: FieldDefinition,
): SchemaSnapshot {
  const draft = cloneSnapshot(snapshot);
  const fields = findChildFields(draft, parentFieldPath);

  fields.push(cloneField(field));

  return parseSchema(draft);
}

export function editField(
  snapshot: SchemaSnapshot,
  fieldPath: string[],
  replacement: FieldDefinition,
): SchemaSnapshot {
  const draft = cloneSnapshot(snapshot);
  const target = findFieldSlot(draft, fieldPath);

  target.fields[target.index] = cloneField(replacement);

  return parseSchema(draft);
}

export function deleteField(
  snapshot: SchemaSnapshot,
  fieldPath: string[],
): SchemaSnapshot {
  const draft = cloneSnapshot(snapshot);
  const target = findFieldSlot(draft, fieldPath);

  target.fields.splice(target.index, 1);

  return parseSchema(draft);
}

export function reorderField(
  snapshot: SchemaSnapshot,
  parentFieldPath: string[],
  fieldId: string,
  targetIndex: number,
): SchemaSnapshot {
  const draft = cloneSnapshot(snapshot);
  const fields = findChildFields(draft, parentFieldPath);
  const sourceIndex = fields.findIndex((field) => field.id === fieldId);

  if (sourceIndex === -1) {
    throw new Error(`Field path not found: ${[...parentFieldPath, fieldId].join(".")}`);
  }
  if (targetIndex < 0 || targetIndex >= fields.length) {
    throw new Error(`Target index out of range: ${targetIndex}`);
  }

  const [field] = fields.splice(sourceIndex, 1);
  fields.splice(targetIndex, 0, field);

  return parseSchema(draft);
}

function cloneSnapshot(snapshot: SchemaSnapshot): SchemaSnapshot {
  return {
    fields: snapshot.fields.map(cloneField),
  };
}

function cloneField(field: FieldDefinition): FieldDefinition {
  if (field.type === "object") {
    return {
      ...field,
      fields: field.fields.map(cloneField),
    };
  }
  if (field.type === "array") {
    return {
      ...field,
      item: cloneField(field.item),
    };
  }

  return { ...field };
}

function findChildFields(
  snapshot: SchemaSnapshot,
  parentFieldPath: string[],
): FieldDefinition[] {
  if (parentFieldPath.length === 0) {
    return snapshot.fields;
  }

  const parentSlot = findFieldSlot(snapshot, parentFieldPath);
  const parent = parentSlot.fields[parentSlot.index];

  if (!isObjectField(parent)) {
    throw new Error(`Field path does not reference an object: ${parentFieldPath.join(".")}`);
  }

  return parent.fields;
}

function findFieldSlot(snapshot: SchemaSnapshot, fieldPath: string[]) {
  if (fieldPath.length === 0) {
    throw new Error("Field path cannot be empty");
  }

  let fields = snapshot.fields;

  for (let depth = 0; depth < fieldPath.length; depth += 1) {
    const id = fieldPath[depth];
    const index = fields.findIndex((field) => field.id === id);

    if (index === -1) {
      throw new Error(`Field path not found: ${fieldPath.slice(0, depth + 1).join(".")}`);
    }

    if (depth === fieldPath.length - 1) {
      return { fields, index };
    }

    const field = fields[index];
    if (!isObjectField(field)) {
      throw new Error(
        `Field path does not reference an object: ${fieldPath.slice(0, depth + 1).join(".")}`,
      );
    }

    fields = field.fields;
  }

  throw new Error(`Field path not found: ${fieldPath.join(".")}`);
}

function isObjectField(field: FieldDefinition): field is ObjectField {
  return field.type === "object";
}
