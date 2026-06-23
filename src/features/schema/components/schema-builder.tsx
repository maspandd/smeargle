"use client";

import { useState } from "react";
import type { SchemaSnapshot } from "../schema-types";
import { FieldDialog, type FieldDialogInput } from "./field-dialog";
import { FieldRow } from "./field-row";

export type AddFieldActionResult =
  | {
      ok: true;
      versionId: string;
      versionLabel: string;
      snapshot: SchemaSnapshot;
    }
  | { ok: false; code: "VERSION_CONFLICT" };

type SchemaBuilderProps = {
  projectId: string;
  readOnly: boolean;
  initialVersionId: string;
  initialVersionLabel: string;
  initialSnapshot: SchemaSnapshot;
  onAddField: (
    projectId: string,
    expectedVersionId: string,
    input: FieldDialogInput,
  ) => Promise<AddFieldActionResult>;
};

export function SchemaBuilder({
  projectId,
  readOnly,
  initialVersionId,
  initialVersionLabel,
  initialSnapshot,
  onAddField,
}: SchemaBuilderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [versionLabel, setVersionLabel] = useState(initialVersionLabel);
  const [error, setError] = useState<string | null>(null);

  async function handleAddField(input: FieldDialogInput) {
    setError(null);
    const result = await onAddField(projectId, versionId, input);

    if (!result.ok) {
      setError("This schema was updated elsewhere. Refresh and try again.");
      return;
    }

    setSnapshot(result.snapshot);
    setVersionId(result.versionId);
    setVersionLabel(result.versionLabel);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Schema Builder</h2>
          <p className="mt-1 text-zinc-600">Define the fields for this mock API.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700">
            {versionLabel}
          </span>
          <button
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-400"
            disabled
            type="button"
          >
            Generate Mock Data
          </button>
          <button
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300"
            disabled={readOnly}
            onClick={() => setDialogOpen(true)}
            title={readOnly ? "Viewers cannot edit the schema" : undefined}
            type="button"
          >
            Add Field
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {snapshot.fields.length === 0 ? (
        <div className="mt-8 border-y border-dashed border-zinc-300 py-16 text-center text-zinc-500">
          No fields yet. Add a field to begin the v1.0 schema.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem_7rem] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <span>Name</span>
            <span>Type</span>
            <span className="text-right">Badges</span>
          </div>
          {snapshot.fields.map((field) => (
            <FieldRow field={field} key={field.id} />
          ))}
        </div>
      )}

      <FieldDialog
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddField}
        open={dialogOpen}
      />
    </div>
  );
}
