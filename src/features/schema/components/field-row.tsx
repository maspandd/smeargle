import type { FieldDefinition } from "../schema-types";

type FieldRowProps = {
  field: FieldDefinition;
};

export function FieldRow({ field }: FieldRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem_7rem] items-center gap-4 border-b border-zinc-100 px-4 py-3 last:border-b-0">
      <div>
        <p className="font-medium text-zinc-950">{field.name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {field.required ? "Required" : "Optional"}
        </p>
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
