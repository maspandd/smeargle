"use client";

import { useState } from "react";
import type { FieldDefinition } from "../schema-types";
import { FieldDialog, type FieldDialogInput } from "./field-dialog";
import { FieldRow } from "./field-row";

const MAX_DEPTH = 5;
const MAX_DIRECT_FIELDS = 100;

export type AddFieldHandler = (
  parentFieldPath: string[],
  input: FieldDialogInput,
) => Promise<void> | void;

type NestedFieldsEditorProps = {
  fields: FieldDefinition[];
  parentFieldPath: string[];
  depth: number;
  readOnly: boolean;
  onAddField: AddFieldHandler;
};

export function NestedFieldsEditor({
  fields,
  parentFieldPath,
  depth,
  readOnly,
  onAddField,
}: NestedFieldsEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const atDepthLimit = depth > MAX_DEPTH;
  const atFieldLimit = fields.length >= MAX_DIRECT_FIELDS;
  const canAdd = !readOnly && !atDepthLimit && !atFieldLimit;

  const disabledReason = atDepthLimit
    ? "Maximum nesting depth of five levels reached"
    : atFieldLimit
      ? "Maximum of 100 fields reached"
      : readOnly
        ? "Viewers cannot edit the schema"
        : undefined;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300"
          disabled={!canAdd}
          onClick={() => setDialogOpen(true)}
          title={disabledReason}
          type="button"
        >
          Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="border-y border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500">
          No fields yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {fields.map((field) => (
            <FieldNode
              depth={depth}
              field={field}
              key={field.id}
              onAddField={onAddField}
              parentFieldPath={parentFieldPath}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      <FieldDialog
        depth={depth}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (input) => {
          await onAddField(parentFieldPath, input);
        }}
        open={dialogOpen}
      />
    </div>
  );
}

type FieldNodeProps = {
  field: FieldDefinition;
  parentFieldPath: string[];
  depth: number;
  readOnly: boolean;
  onAddField: AddFieldHandler;
};

function FieldNode({
  field,
  parentFieldPath,
  depth,
  readOnly,
  onAddField,
}: FieldNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isObject = field.type === "object";

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <div className="flex items-center gap-1">
        {isObject ? (
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${field.name}`}
            className="px-2 text-zinc-500"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <div className="flex-1">
          <FieldRow field={field} />
        </div>
      </div>

      {isObject && expanded ? (
        <div
          aria-label={`${field.name} fields`}
          className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 pl-8"
          role="group"
        >
          <NestedFieldsEditor
            depth={depth + 1}
            fields={field.fields}
            onAddField={onAddField}
            parentFieldPath={[...parentFieldPath, field.id]}
            readOnly={readOnly}
          />
        </div>
      ) : null}
    </div>
  );
}
