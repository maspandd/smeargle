"use client";

import type { SchemaSnapshot } from "@/features/schema/schema-types";
import type { MockRecord } from "@prisma/client";

function JsonDisclosure({ value, label }: { value: unknown; label: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-blue-600 hover:text-blue-800">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function renderCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="italic text-zinc-400">null</span>;
  }
  
  if (Array.isArray(value)) {
    return <JsonDisclosure value={value} label="[ ... ]" />;
  }
  
  if (typeof value === "object") {
    return <JsonDisclosure value={value} label="{ ... }" />;
  }

  return String(value);
}

export function DataPreview({
  schema,
  records,
  totalCount,
  page,
  pageSize,
}: {
  schema: SchemaSnapshot;
  records: MockRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  const columns = schema.fields;
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Showing {startIndex} of {totalCount} records
      </p>
      
      <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
        <table className="w-full text-left text-sm text-zinc-700">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <tr>
              {columns.map((col) => (
                <th key={col.id} className="px-4 py-3">
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {records.map((record) => {
              const value = (record.value as Record<string, unknown>) || {};
              return (
                <tr key={record.id} className="hover:bg-zinc-50">
                  {columns.map((col) => (
                    <td key={col.id} className="px-4 py-3">
                      {renderCellValue(value[col.name])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
