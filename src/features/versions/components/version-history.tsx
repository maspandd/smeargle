import type { VersionHistoryEntry } from "../version-query";

type VersionHistoryProps = {
  versions: Array<
    Omit<VersionHistoryEntry, "snapshot"> & {
      snapshot?: VersionHistoryEntry["snapshot"];
    }
  >;
};

export function VersionHistory({ versions }: VersionHistoryProps) {
  const ordered = [...versions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

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
          </li>
        ))}
      </ol>
    </section>
  );
}
