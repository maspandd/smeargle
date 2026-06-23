import type { FieldDefinition, SchemaSnapshot } from "./schema-types";

export type ValidationResult =
  | { ok: true; errors: [] }
  | { ok: false; errors: string[] };

export function validateRecordValue(
  schema: SchemaSnapshot,
  value: unknown,
): ValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, errors: ["record must be an object"] };
  }

  validateFields(schema.fields, value, errors, "");

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

function validateFields(
  fields: FieldDefinition[],
  value: Record<string, unknown>,
  errors: string[],
  parentPath: string,
) {
  for (const field of fields) {
    const path = parentPath ? `${parentPath}.${field.name}` : field.name;
    validateField(field, value[field.name], errors, path);
  }
}

function validateField(
  field: FieldDefinition,
  value: unknown,
  errors: string[],
  path: string,
) {
  if (value === null || value === undefined) {
    if (field.required) {
      errors.push(`${path} is required`);
    }
    return;
  }

  switch (field.type) {
    case "string":
      validateString(field, value, errors, path);
      return;
    case "number":
      validateNumber(field, value, errors, path);
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(`${path} must be a boolean`);
      }
      return;
    case "date":
      validateDate(field, value, errors, path);
      return;
    case "email":
      validateEmail(value, errors, path);
      return;
    case "object":
      if (!isPlainObject(value)) {
        errors.push(`${path} must be an object`);
        return;
      }
      validateFields(field.fields, value, errors, path);
      return;
    case "array":
      validateArray(field, value, errors, path);
      return;
  }
}

function validateString(
  field: Extract<FieldDefinition, { type: "string" }>,
  value: unknown,
  errors: string[],
  path: string,
) {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }
  if (field.minLength !== undefined && value.length < field.minLength) {
    errors.push(`${path} must be at least ${field.minLength} characters`);
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    errors.push(`${path} must be at most ${field.maxLength} characters`);
  }
}

function validateNumber(
  field: Extract<FieldDefinition, { type: "number" }>,
  value: unknown,
  errors: string[],
  path: string,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a number`);
    return;
  }
  if (field.min !== undefined && value < field.min) {
    errors.push(`${path} must be at least ${field.min}`);
  }
  if (field.max !== undefined && value > field.max) {
    errors.push(`${path} must be at most ${field.max}`);
  }
  if (
    field.precision !== undefined &&
    Number(value.toFixed(field.precision)) !== value
  ) {
    errors.push(`${path} must use at most ${field.precision} decimal places`);
  }
}

function validateDate(
  field: Extract<FieldDefinition, { type: "date" }>,
  value: unknown,
  errors: string[],
  path: string,
) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${path} must be a date formatted as YYYY-MM-DD`);
    return;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);

  if (Number.isNaN(timestamp)) {
    errors.push(`${path} must be a valid date`);
    return;
  }
  if (
    field.minDate !== undefined &&
    timestamp < Date.parse(`${field.minDate}T00:00:00.000Z`)
  ) {
    errors.push(`${path} must be on or after ${field.minDate}`);
  }
  if (
    field.maxDate !== undefined &&
    timestamp > Date.parse(`${field.maxDate}T00:00:00.000Z`)
  ) {
    errors.push(`${path} must be on or before ${field.maxDate}`);
  }
}

function validateEmail(value: unknown, errors: string[], path: string) {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${path} must be an email`);
  }
}

function validateArray(
  field: Extract<FieldDefinition, { type: "array" }>,
  value: unknown,
  errors: string[],
  path: string,
) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (field.minItems !== undefined && value.length < field.minItems) {
    errors.push(`${path} must contain at least ${field.minItems} items`);
  }
  if (field.maxItems !== undefined && value.length > field.maxItems) {
    errors.push(`${path} must contain at most ${field.maxItems} items`);
  }

  value.forEach((item, index) => {
    validateField(field.item, item, errors, `${path}[${index}]`);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
