import { type Project } from "@prisma/client";
import { FormEvent, useState } from "react";

type RuntimeSettingsProps = {
  project: Pick<Project, "corsOrigins" | "rateLimit" | "tokenRequired">;
  canManage: boolean;
  onSave: (settings: { corsOrigins: string[]; rateLimit: number; tokenRequired: boolean }) => void;
};

export function RuntimeSettings({ project, canManage, onSave }: RuntimeSettingsProps) {
  const [corsOriginsStr, setCorsOriginsStr] = useState(project.corsOrigins.join("\n"));
  const [rateLimit, setRateLimit] = useState(project.rateLimit.toString());
  const [tokenRequired, setTokenRequired] = useState(project.tokenRequired);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setError(null);

    const origins = corsOriginsStr
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    // Validate origins
    for (const origin of origins) {
      if (origin === "*") continue;
      try {
        new URL(origin);
      } catch {
        setError(`Must be a valid URL: ${origin}`);
        return;
      }
    }

    const rateLimitNum = parseInt(rateLimit, 10);
    if (isNaN(rateLimitNum) || rateLimitNum < 0) {
      setError("Rate limit must be a positive number.");
      return;
    }

    onSave({
      corsOrigins: origins,
      rateLimit: rateLimitNum,
      tokenRequired,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Runtime Settings</h2>
        
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <div>
            <label htmlFor="cors-origins" className="block text-sm font-medium text-zinc-800">
              Allowed Origins (CORS)
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              One per line. Use * for wildcard.
            </p>
            <textarea
              id="cors-origins"
              value={corsOriginsStr}
              onChange={(e) => setCorsOriginsStr(e.target.value)}
              disabled={!canManage}
              rows={3}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="rate-limit" className="block text-sm font-medium text-zinc-800">
              Rate Limit
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Requests per IP/Token per window.
            </p>
            <input
              id="rate-limit"
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              disabled={!canManage}
              className="mt-2 w-full max-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="token-required"
              type="checkbox"
              checked={tokenRequired}
              onChange={(e) => setTokenRequired(e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600 disabled:opacity-50"
            />
            <label htmlFor="token-required" className="text-sm font-medium text-zinc-800">
              Require Token (Authorization: Bearer)
            </label>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {canManage && (
            <div className="pt-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Save Settings
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
