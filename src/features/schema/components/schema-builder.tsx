"use client";

import { useState } from "react";
import type { SchemaSnapshot } from "../schema-types";
import type { FieldDialogInput } from "./field-dialog";
import { NestedFieldsEditor } from "./nested-fields-editor";

export type AddFieldActionResult =
  | {
      ok: true;
      versionId: string;
      versionLabel: string;
      snapshot: SchemaSnapshot;
    }
  | { ok: false; code: "VERSION_CONFLICT" }
  | { ok: false; code: "VALIDATION_ERROR"; message: string };

type SchemaBuilderProps = {
  projectId: string;
  readOnly: boolean;
  initialVersionId: string;
  initialVersionLabel: string;
  initialSnapshot: SchemaSnapshot;
  onAddField: (
    projectId: string,
    expectedVersionId: string,
    parentFieldPath: string[],
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
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [versionLabel, setVersionLabel] = useState(initialVersionLabel);
  const [error, setError] = useState<string | null>(null);

  async function handleAddField(parentFieldPath: string[], input: FieldDialogInput) {
    setError(null);
    const result = await onAddField(projectId, versionId, parentFieldPath, input);

    if (!result.ok) {
      if (result.code === "VALIDATION_ERROR") {
        throw new Error(result.message);
      }

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
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8">
        <NestedFieldsEditor
          depth={1}
          fields={snapshot.fields}
          onAddField={handleAddField}
          parentFieldPath={[]}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
