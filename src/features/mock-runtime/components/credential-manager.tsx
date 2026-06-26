import { type ApiCredential } from "@prisma/client";
import { useState } from "react";

type CredentialManagerProps = {
  credentials: ApiCredential[];
  canManage: boolean;
  onCreate: (label: string) => void;
  onRevoke: (id: string) => void;
  newTokenPlaintext: string | null;
};

export function CredentialManager({
  credentials,
  canManage,
  onCreate,
  onRevoke,
  newTokenPlaintext,
}: CredentialManagerProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">API Credentials</h2>
          {canManage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const label = formData.get("label") as string;
                if (label) {
                  onCreate(label);
                  e.currentTarget.reset();
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                name="label"
                placeholder="Token label..."
                required
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Create Token
              </button>
            </form>
          )}
        </div>

        {newTokenPlaintext && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-medium text-green-900">Copy this token now</h3>
            <p className="mt-1 text-xs text-green-700">
              For security, we will never show it again.
            </p>
            <div className="mt-3 flex items-center justify-between rounded-md bg-white px-3 py-2 border border-green-200 font-mono text-sm text-zinc-900">
              <span>{newTokenPlaintext}</span>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-zinc-200 pt-6">
          {credentials.length === 0 ? (
            <p className="text-sm text-zinc-500">No credentials created yet.</p>
          ) : (
            <ul className="space-y-4">
              {credentials.map((cred) => (
                <li
                  key={cred.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-4"
                >
                  <div>
                    <h4 className="text-sm font-medium text-zinc-900">{cred.label}</h4>
                    <p className="text-xs text-zinc-500">
                      Created: {new Date(cred.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canManage && !cred.revokedAt && (
                    <>
                      {revokingId === cred.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-red-600">
                            Are you sure you want to revoke this token?
                          </span>
                          <button
                            onClick={() => {
                              onRevoke(cred.id);
                              setRevokingId(null);
                            }}
                            className="rounded px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
                          >
                            Confirm Revoke
                          </button>
                          <button
                            onClick={() => setRevokingId(null)}
                            className="rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRevokingId(cred.id)}
                          className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      )}
                    </>
                  )}
                  {cred.revokedAt && (
                    <span className="rounded bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">
                      Revoked
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
