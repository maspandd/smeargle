"use client";

import type { ProjectRole } from "@prisma/client";
import { FormEvent, useMemo, useState } from "react";

type Member = { userId: string; email: string; role: ProjectRole };

type MembersClientProps = {
  members: Member[];
  onAdd: (input: { email: string; role: "EDITOR" | "VIEWER" }) => Promise<void>;
  onChangeRole: (userId: string, role: ProjectRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
};

export function MembersClient({
  members,
  onAdd,
  onChangeRole,
  onRemove,
}: MembersClientProps) {
  const [search, setSearch] = useState("");
  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const filteredMembers = useMemo(
    () =>
      members.filter((member) =>
        member.email.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [members, search],
  );

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onAdd({
      email: String(formData.get("email")).trim().toLowerCase(),
      role: formData.get("role") as "EDITOR" | "VIEWER",
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-end"
        onSubmit={handleAdd}
      >
        <div className="flex-1">
          <label className="text-sm font-medium" htmlFor="member-email">
            Member email
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            id="member-email"
            name="email"
            required
            type="email"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="new-member-role">
            New member role
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            defaultValue="VIEWER"
            id="new-member-role"
            name="role"
          >
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
          type="submit"
        >
          Add member
        </button>
      </form>

      <div>
        <label className="text-sm font-medium" htmlFor="member-search">
          Search members
        </label>
        <input
          className="mt-1 w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2"
          id="member-search"
          onChange={(event) => setSearch(event.target.value)}
          type="search"
          value={search}
        />
      </div>

      {filteredMembers.length === 0 ? (
        <p className="border-y border-zinc-200 py-10 text-center text-zinc-500">
          No members match your search.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {filteredMembers.map((member) => {
            const lastOwner = member.role === "OWNER" && ownerCount === 1;
            const explanation = lastOwner
              ? "Project must retain at least one owner"
              : undefined;
            return (
              <div
                className="flex flex-col gap-3 border-b border-zinc-200 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                key={member.userId}
              >
                <div>
                  <p className="font-medium">{member.email}</p>
                  {explanation ? (
                    <p className="mt-1 text-sm text-zinc-500">{explanation}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <select
                    aria-label={`Role for ${member.email}`}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                    disabled={lastOwner}
                    onChange={(event) =>
                      void onChangeRole(member.userId, event.target.value as ProjectRole)
                    }
                    title={explanation}
                    value={member.role}
                  >
                    <option value="OWNER">Owner</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    aria-label={`Remove ${member.email}`}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:border-zinc-200 disabled:text-zinc-400"
                    disabled={lastOwner}
                    onClick={() => {
                      if (window.confirm(`Remove ${member.email} from this project?`)) {
                        void onRemove(member.userId);
                      }
                    }}
                    title={explanation}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
