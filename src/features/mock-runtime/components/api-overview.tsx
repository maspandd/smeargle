import { type Project } from "@prisma/client";

type ApiOverviewProps = {
  project: Pick<Project, "tokenRequired">;
  collectionUrl: string;
  recordUrl: string;
};

export function ApiOverview({ project, collectionUrl, recordUrl }: ApiOverviewProps) {

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Endpoints</h2>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-800">Collection</h3>
            <div className="mt-1 flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2 font-mono text-sm text-zinc-700">
              <span>{collectionUrl}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">GET</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">POST</span>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-800">Record</h3>
            <div className="mt-1 flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2 font-mono text-sm text-zinc-700">
              <span>{recordUrl}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">GET</span>
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">PUT</span>
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">PATCH</span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">DELETE</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Examples</h2>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-zinc-800">cURL</h3>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-200">
            curl -X GET \{collectionUrl} \
            {project.tokenRequired ? "\n  -H 'Authorization: Bearer <your-token>'" : ""}
          </pre>
        </div>
      </section>
    </div>
  );
}
