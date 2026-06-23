import type {
  BooleanField,
  DateField,
  NumberField,
  SemanticField,
  StringField,
} from "@/features/schema/schema-types";
import type { RandomSource } from "./random-source";

type AdditionalSemanticType = "personName" | "productName" | "address";
type AdditionalSemanticField = {
  id: string;
  name: string;
  type: AdditionalSemanticType;
  required: boolean;
};

export type ScalarFieldDefinition =
  | StringField
  | NumberField
  | BooleanField
  | DateField
  | SemanticField
  | AdditionalSemanticField;

export type ScalarValue = string | number | boolean;

export function generateScalar(
  field: ScalarFieldDefinition,
  random: RandomSource,
): ScalarValue {
  const value = generateUncheckedScalar(field, random);

  if (process.env.NODE_ENV !== "production") {
    validateScalarValue(field, value);
  }

  return value;
}

function generateUncheckedScalar(
  field: ScalarFieldDefinition,
  random: RandomSource,
): ScalarValue {
  switch (field.type) {
    case "string":
      return generateString(field, random);
    case "number":
      return generateNumber(field, random);
    case "boolean":
      return random.boolean();
    case "date":
      return generateDate(field, random);
    case "email":
      return random.faker.internet.email().toLowerCase();
    case "personName":
      return random.faker.person.fullName();
    case "productName":
      return random.faker.commerce.productName();
    case "address":
      return random.faker.location.streetAddress({ useFullAddress: true });
  }
}

function generateString(field: StringField, random: RandomSource) {
  const minLength = field.minLength ?? 1;
  const maxLength = field.maxLength ?? Math.max(32, minLength);

  if (minLength > maxLength) {
    throw new Error(`${field.name} minimum length cannot exceed maximum length`);
  }
  if (maxLength === 0) {
    return "";
  }

  const targetLength = random.integer(Math.max(1, minLength), maxLength);
  const source = random.faker.lorem
    .words({ min: 1, max: 6 })
    .replace(/[^A-Za-z0-9]/g, "");

  return fitNonEmptyString(source, targetLength, random);
}

function fitNonEmptyString(
  source: string,
  targetLength: number,
  random: RandomSource,
) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  let value = source || "data";

  while (value.length < targetLength) {
    value += random.pick(alphabet);
  }

  return value.slice(0, targetLength);
}

function generateNumber(field: NumberField, random: RandomSource) {
  const min = field.min ?? 0;
  const max = field.max ?? 1_000;

  if (min > max) {
    throw new Error(`${field.name} minimum cannot exceed maximum`);
  }
  if (min === max) {
    return roundNumber(min, field.precision);
  }
  if (field.precision === undefined) {
    return random.float(min, max);
  }

  const scale = 10 ** field.precision;
  const scaledMin = Math.ceil(min * scale);
  const scaledMax = Math.floor(max * scale);

  if (scaledMin > scaledMax) {
    throw new Error(`${field.name} precision cannot represent the configured range`);
  }

  return random.integer(scaledMin, scaledMax) / scale;
}

function roundNumber(value: number, precision: number | undefined) {
  if (precision === undefined) {
    return value;
  }

  return Number(value.toFixed(precision));
}

function generateDate(field: DateField, random: RandomSource) {
  const minDate = parseUtcDate(field.minDate ?? "1970-01-01", field.name);
  const maxDate = parseUtcDate(field.maxDate ?? "2100-12-31", field.name);

  if (minDate > maxDate) {
    throw new Error(`${field.name} start date cannot be after end date`);
  }

  const dayOffset = random.integer(
    0,
    Math.floor((maxDate.getTime() - minDate.getTime()) / DAY_IN_MS),
  );

  return formatUtcDate(new Date(minDate.getTime() + dayOffset * DAY_IN_MS));
}

function parseUtcDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} date constraint must use YYYY-MM-DD`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} date constraint is invalid`);
  }

  return parsed;
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validateScalarValue(field: ScalarFieldDefinition, value: ScalarValue) {
  switch (field.type) {
    case "string":
      assertString(value, field);
      return;
    case "number":
      assertNumber(value, field);
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`${field.name} generated value must be a boolean`);
      }
      return;
    case "date":
      assertDate(value, field);
      return;
    case "email":
      assertNonEmptyString(value, field.name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error(`${field.name} generated value must be an email`);
      }
      return;
    case "personName":
    case "productName":
    case "address":
      assertNonEmptyString(value, field.name);
      return;
  }
}

function assertString(value: ScalarValue, field: StringField) {
  assertNonEmptyString(value, field.name);
  const minLength = field.minLength ?? 0;
  const maxLength = field.maxLength ?? Number.POSITIVE_INFINITY;

  if (value.length < minLength || value.length > maxLength) {
    throw new Error(`${field.name} generated string violates length constraints`);
  }
}

function assertNumber(value: ScalarValue, field: NumberField) {
  if (typeof value !== "number") {
    throw new Error(`${field.name} generated value must be a number`);
  }
  if (field.min !== undefined && value < field.min) {
    throw new Error(`${field.name} generated number is below the minimum`);
  }
  if (field.max !== undefined && value > field.max) {
    throw new Error(`${field.name} generated number is above the maximum`);
  }
  if (
    field.precision !== undefined &&
    Number(value.toFixed(field.precision)) !== value
  ) {
    throw new Error(`${field.name} generated number exceeds precision`);
  }
}

function assertDate(value: ScalarValue, field: DateField) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field.name} generated date must use YYYY-MM-DD`);
  }

  const timestamp = parseUtcDate(value, field.name).getTime();

  if (
    field.minDate !== undefined &&
    timestamp < parseUtcDate(field.minDate, field.name).getTime()
  ) {
    throw new Error(`${field.name} generated date is before the minimum`);
  }
  if (
    field.maxDate !== undefined &&
    timestamp > parseUtcDate(field.maxDate, field.name).getTime()
  ) {
    throw new Error(`${field.name} generated date is after the maximum`);
  }
}

function assertNonEmptyString(
  value: ScalarValue,
  fieldName: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} generated value must be a non-empty string`);
  }
}

const DAY_IN_MS = 24 * 60 * 60 * 1_000;
