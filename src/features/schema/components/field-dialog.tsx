"use client";

import { FormEvent, useState } from "react";

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
    };

type FieldDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: FieldDialogInput) => Promise<void>;
};

const scalarTypes = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
] satisfies { value: FieldDialogInput["type"]; label: string }[];

export function FieldDialog({ open, onClose, onSubmit }: FieldDialogProps) {
  const [fieldType, setFieldType] = useState<FieldDialogInput["type"]>("string");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const base = {
      name: String(formData.get("name") ?? "").trim(),
      required: formData.get("required") === "on",
    };

    try {
      await onSubmit(toFieldInput(fieldType, base, formData));
      onClose();
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
              Create a scalar field for this schema.
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
                setFieldType(event.target.value as FieldDialogInput["type"])
              }
              value={fieldType}
            >
              {scalarTypes.map((type) => (
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

function StringConstraints() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberInput label="Minimum length" name="minLength" />
      <NumberInput label="Maximum length" name="maxLength" />
    </div>
  );
}

function NumberConstraints() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NumberInput label="Minimum value" name="min" />
      <NumberInput label="Maximum value" name="max" />
      <NumberInput label="Decimal precision" name="precision" />
    </div>
  );
}

function DateConstraints() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextInput label="Earliest date" name="minDate" type="date" />
      <TextInput label="Latest date" name="maxDate" type="date" />
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
        type={type}
      />
    </div>
  );
}

function toFieldInput(
  type: FieldDialogInput["type"],
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
  }
}

function optionalNumber(name: string, formData: FormData) {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? {} : { [name]: Number(value) };
}

function optionalString(name: string, formData: FormData) {
  const value = String(formData.get(name) ?? "").trim();
  return value === "" ? {} : { [name]: value };
}
