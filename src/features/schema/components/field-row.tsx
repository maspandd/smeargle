import type { FieldDefinition } from "../schema-types";

type FieldRowProps = {
  field: FieldDefinition;
};

export function FieldRow({ field }: FieldRowProps) {
  const summary = fieldConstraintSummary(field);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem_7rem] items-center gap-4 border-b border-zinc-100 px-4 py-3 last:border-b-0">
      <div>
        <p className="font-medium text-zinc-950">{field.name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {field.required ? "Required" : "Optional"}
        </p>
        {summary ? <p className="mt-1 text-xs text-zinc-500">{summary}</p> : null}
      </div>
      <span className="text-sm text-zinc-700">{fieldTypeLabel(field.type)}</span>
      <div className="flex justify-end">
        {field.type === "email" ? (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            LLM-Powered
          </span>
        ) : null}
      </div>
    </div>
  );
}

function fieldTypeLabel(type: FieldDefinition["type"]) {
  switch (type) {
    case "string":
      return "String";
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    case "date":
      return "Date";
    case "email":
      return "Email";
    case "object":
      return "Object";
    case "array":
      return "Array";
  }
}

function fieldConstraintSummary(field: FieldDefinition) {
  switch (field.type) {
    case "string":
      if (field.minLength !== undefined && field.maxLength !== undefined) {
        return `Length ${field.minLength}-${field.maxLength}`;
      }
      if (field.minLength !== undefined) {
        return `Minimum length ${field.minLength}`;
      }
      if (field.maxLength !== undefined) {
        return `Maximum length ${field.maxLength}`;
      }
      return null;
    case "number": {
      const parts: string[] = [];

      if (field.min !== undefined || field.max !== undefined) {
        const lower = field.min ?? "-inf";
        const upper = field.max ?? "inf";
        parts.push(`Range ${lower} to ${upper}`);
      }
      if (field.precision !== undefined) {
        parts.push(`Precision ${field.precision}`);
      }

      return parts.length ? parts.join(" - ") : null;
    }
    case "date":
      if (field.minDate !== undefined && field.maxDate !== undefined) {
        return `From ${field.minDate} to ${field.maxDate}`;
      }
      if (field.minDate !== undefined) {
        return `From ${field.minDate}`;
      }
      if (field.maxDate !== undefined) {
        return `Until ${field.maxDate}`;
      }
      return null;
    default:
      return null;
  }
}
