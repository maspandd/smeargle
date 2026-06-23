"use client";

import { useState } from "react";
import type { VersionHistoryEntry } from "../version-query";

type VersionHistoryProps = {
  canRollback?: boolean;
  onRollback?: (
    projectId: string,
    versionId: string,
    expectedVersionId: string,
    confirmedImpact: boolean,
  ) => Promise<
    | { ok: true }
    | { ok: false; code: "VERSION_CONFLICT" | "ROLLBACK_CONFIRMATION_REQUIRED" }
  >;
  projectId: string;
  versions: Array<
    Omit<VersionHistoryEntry, "snapshot"> & {
      snapshot?: VersionHistoryEntry["snapshot"];
    }
  >;
};

export function VersionHistory({
  canRollback = false,
  onRollback,
  projectId,
  versions,
}: VersionHistoryProps) {
  const ordered = [...versions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);
  const currentVersionId = ordered.find((version) => version.isCurrent)?.id ?? null;

  async function handleRollback(versionId: string, versionLabel: string) {
    if (!onRollback || !currentVersionId) return;
    if (!window.confirm(`Restore ${versionLabel} as the current schema version?`)) {
      return;
    }

    setError(null);
    setPendingVersionId(versionId);

    try {
      const result = await onRollback(projectId, versionId, currentVersionId, true);
      if (!result.ok) {
        setError(
          result.code === "VERSION_CONFLICT"
            ? "This schema changed while you were viewing history. Refresh and try again."
            : "Confirm the rollback before trying again.",
        );
        return;
      }

      window.location.reload();
    } finally {
      setPendingVersionId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Version History</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Review schema snapshots from newest to oldest.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ol aria-label="Schema version history" className="mt-6 space-y-3">
        {ordered.map((version) => (
          <li
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
            key={version.id}
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold">{version.versionLabel}</h3>
              {version.isCurrent ? (
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                  Current
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-zinc-700">{version.changeSummary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>{version.actorLabel}</span>
              <span>{version.createdAtLabel}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
                download
                href={`/api/projects/${projectId}/versions/${version.id}/download`}
              >
                Download {version.versionLabel} JSON
              </a>
              {canRollback && !version.isCurrent ? (
                <button
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
                  disabled={pendingVersionId === version.id}
                  onClick={() => void handleRollback(version.id, version.versionLabel)}
                  type="button"
                >
                  Restore {version.versionLabel}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
