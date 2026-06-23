"use client";

import { FormEvent, useState } from "react";

export type FieldDialogItemInput =
  | { type: "string"; minLength?: number; maxLength?: number }
  | { type: "number"; min?: number; max?: number; precision?: number }
  | { type: "date"; minDate?: string; maxDate?: string }
  | { type: "email" };

export type FieldDialogInput =
  | {
      name: string;
      type: "string";
      required: boolean;
      minLength?: number;
      maxLength?: number;
    }
  | {
      name: string;
      type: "number";
      required: boolean;
      min?: number;
      max?: number;
      precision?: number;
    }
  | {
      name: string;
      type: "date";
      required: boolean;
      minDate?: string;
      maxDate?: string;
    }
  | {
      name: string;
      type: "email";
      required: boolean;
    }
  | {
      name: string;
      type: "object";
      required: boolean;
    }
  | {
      name: string;
      type: "array";
      required: boolean;
      minItems?: number;
      maxItems?: number;
      item: FieldDialogItemInput;
    };

type ScalarType = FieldDialogItemInput["type"];
type FieldDialogType = FieldDialogInput["type"];

// Root fields live at `depth`. Array items live one level deeper, so arrays may
// only be added while their item would stay within the five-level limit.
const MAX_DEPTH = 5;

type FieldDialogProps = {
  open: boolean;
  depth?: number;
  onClose: () => void;
  onSubmit: (input: FieldDialogInput) => Promise<void>;
};

const fieldTypes = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
] satisfies { value: FieldDialogType; label: string }[];

const itemTypes = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
] satisfies { value: ScalarType; label: string }[];

export function FieldDialog({ open, depth = 1, onClose, onSubmit }: FieldDialogProps) {
  const [fieldType, setFieldType] = useState<FieldDialogType>("string");
  const [itemType, setItemType] = useState<ScalarType>("string");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!open) return null;

  const availableTypes =
    depth >= MAX_DEPTH
      ? fieldTypes.filter((type) => type.value !== "array")
      : fieldTypes;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const formData = new FormData(event.currentTarget);
    const base = {
      name: String(formData.get("name") ?? "").trim(),
      required: formData.get("required") === "on",
    };

    try {
      await onSubmit(toFieldInput(fieldType, itemType, base, formData));
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save field");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 px-4">
      <div
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Add field</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Create a field for this schema.
            </p>
          </div>
          <button
            aria-label="Close field dialog"
            className="rounded-lg border border-zinc-200 px-3 py-1 text-sm"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {submitError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}
          <div>
            <label className="text-sm font-medium" htmlFor="field-name">
              Field name
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              id="field-name"
              name="name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="field-type">
              Field type
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              id="field-type"
              name="type"
              onChange={(event) =>
                setFieldType(event.target.value as FieldDialogType)
              }
              value={fieldType}
            >
              {availableTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input defaultChecked name="required" type="checkbox" />
            Required field
          </label>

          {fieldType === "string" ? <StringConstraints /> : null}
          {fieldType === "number" ? <NumberConstraints /> : null}
          {fieldType === "date" ? <DateConstraints /> : null}
          {fieldType === "object" ? (
            <p className="text-sm text-zinc-500">
              Add nested fields after creating the object.
            </p>
          ) : null}
          {fieldType === "array" ? (
            <ArrayConstraints itemType={itemType} onItemTypeChange={setItemType} />
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300"
              disabled={submitting}
              type="submit"
            >
              Save Field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StringConstraints({ prefix = "" }: { prefix?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberInput label={withPrefix(prefix, "minimum length")} name={`${prefix}minLength`} />
      <NumberInput label={withPrefix(prefix, "maximum length")} name={`${prefix}maxLength`} />
    </div>
  );
}

function NumberConstraints({ prefix = "" }: { prefix?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NumberInput label={withPrefix(prefix, "minimum value")} name={`${prefix}min`} />
      <NumberInput label={withPrefix(prefix, "maximum value")} name={`${prefix}max`} />
      <NumberInput label={withPrefix(prefix, "decimal precision")} name={`${prefix}precision`} />
    </div>
  );
}

function DateConstraints({ prefix = "" }: { prefix?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextInput label={withPrefix(prefix, "earliest date")} name={`${prefix}minDate`} type="date" />
      <TextInput label={withPrefix(prefix, "latest date")} name={`${prefix}maxDate`} type="date" />
    </div>
  );
}

function ArrayConstraints({
  itemType,
  onItemTypeChange,
}: {
  itemType: ScalarType;
  onItemTypeChange: (type: ScalarType) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput label="Minimum items" name="minItems" />
        <NumberInput label="Maximum items" name="maxItems" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="item-type">
          Item type
        </label>
        <select
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          id="item-type"
          name="itemType"
          onChange={(event) => onItemTypeChange(event.target.value as ScalarType)}
          value={itemType}
        >
          {itemTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      {itemType === "string" ? <StringConstraints prefix="item" /> : null}
      {itemType === "number" ? <NumberConstraints prefix="item" /> : null}
      {itemType === "date" ? <DateConstraints prefix="item" /> : null}
    </div>
  );
}

function NumberInput({ label, name }: { label: string; name: string }) {
  return <TextInput label={label} name={name} type="number" />;
}

function TextInput({
  label,
  name,
  type,
}: {
  label: string;
  name: string;
  type: "date" | "number";
}) {
  const id = `field-${name}`;
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
        id={id}
        name={name}
        step={type === "number" ? "any" : undefined}
        type={type}
      />
    </div>
  );
}

function withPrefix(prefix: string, label: string) {
  const text = prefix ? `${prefix} ${label}` : label;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toFieldInput(
  type: FieldDialogType,
  itemType: ScalarType,
  base: { name: string; required: boolean },
  formData: FormData,
): FieldDialogInput {
  switch (type) {
    case "string":
      return {
        ...base,
        type,
        ...optionalNumber("minLength", formData),
        ...optionalNumber("maxLength", formData),
      };
    case "number":
      return {
        ...base,
        type,
        ...optionalNumber("min", formData),
        ...optionalNumber("max", formData),
        ...optionalNumber("precision", formData),
      };
    case "date":
      return {
        ...base,
        type,
        ...optionalString("minDate", formData),
        ...optionalString("maxDate", formData),
      };
    case "email":
      return { ...base, type };
    case "object":
      return { ...base, type };
    case "array":
      return {
        ...base,
        type,
        ...optionalNumber("minItems", formData),
        ...optionalNumber("maxItems", formData),
        item: toItemInput(itemType, formData),
      };
  }
}

function toItemInput(type: ScalarType, formData: FormData): FieldDialogItemInput {
  switch (type) {
    case "string":
      return {
        type,
        ...optionalNumber("itemminLength", formData),
        ...optionalNumber("itemmaxLength", formData),
      };
    case "number":
      return {
        type,
        ...optionalNumber("itemmin", formData),
        ...optionalNumber("itemmax", formData),
        ...optionalNumber("itemprecision", formData),
      };
    case "date":
      return {
        type,
        ...optionalString("itemminDate", formData),
        ...optionalString("itemmaxDate", formData),
      };
    case "email":
      return { type };
  }
}

function optionalNumber(name: string, formData: FormData) {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? {} : { [name.replace(/^item/, "")]: Number(value) };
}

function optionalString(name: string, formData: FormData) {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? {} : { [name.replace(/^item/, "")]: value };
}
