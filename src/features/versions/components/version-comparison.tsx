import type { SchemaChange } from "../schema-diff";

type VersionComparisonProps = {
  beforeVersionLabel: string;
  afterVersionLabel: string;
  changes: SchemaChange[];
};

export function VersionComparison({
  beforeVersionLabel,
  afterVersionLabel,
  changes,
}: VersionComparisonProps) {
  if (changes.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Comparing {afterVersionLabel} to {beforeVersionLabel}</h2>
        <p className="mt-3 text-sm text-zinc-500">No schema differences between these versions.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div>
        <h2 className="text-xl font-semibold">Comparing {afterVersionLabel} to {beforeVersionLabel}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Added, deleted, renamed, reordered, and modified fields are listed below.
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        {changes.map((change) => (
          <li
            className="rounded-xl border border-zinc-200 p-4"
            key={`${change.fieldId}:${change.kind}:${change.pathAfter ?? change.pathBefore ?? ""}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={badgeClassName(change.kind)}>{labelForKind(change.kind)}</span>
              <code className="rounded bg-zinc-100 px-2 py-1 text-sm">
                {change.pathAfter ?? change.pathBefore ?? change.fieldId}
              </code>
            </div>
            {(change.pathBefore && change.pathAfter && change.pathBefore !== change.pathAfter) ? (
              <p className="mt-2 text-sm text-zinc-500">
                {change.pathBefore} to {change.pathAfter}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function labelForKind(kind: SchemaChange["kind"]) {
  switch (kind) {
    case "ADDED":
      return "Added";
    case "DELETED":
      return "Deleted";
    case "RENAMED":
      return "Renamed";
    case "REORDERED":
      return "Reordered";
    case "MODIFIED":
      return "Modified";
  }
}

function badgeClassName(kind: SchemaChange["kind"]) {
  switch (kind) {
    case "ADDED":
      return "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700";
    case "DELETED":
      return "rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700";
    case "RENAMED":
      return "rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700";
    case "REORDERED":
      return "rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700";
    case "MODIFIED":
      return "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700";
  }
}
