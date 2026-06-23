"use client";

import type { ProjectRole } from "@prisma/client";
import type { CreateProjectInput } from "@/features/projects/project-schema";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import Link from "next/link";
import { useState } from "react";

export type DashboardProject = {
  id: string;
  name: string;
  baseEndpoint: string;
  role: ProjectRole;
  currentVersion: string;
};

type DashboardClientProps = {
  projects: DashboardProject[];
  createProject: (input: CreateProjectInput) => Promise<void>;
};

function displayRole(role: ProjectRole) {
  return role[0] + role.slice(1).toLowerCase();
}

export function DashboardClient({ projects, createProject }: DashboardClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-lg font-bold tracking-tight">Smeargle</p>
            <p className="text-sm text-zinc-500">Mock API workspace</p>
          </div>
          {projects.length ? (
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setDialogOpen(true)}
              type="button"
            >
              Create Mock API
            </button>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-2 text-zinc-600">
          Build stable contracts for frontend development and automated tests.
        </p>

        {projects.length === 0 ? (
          <div className="mt-10 border-y border-zinc-200 py-16 text-center">
            <h2 className="text-xl font-semibold">No mock APIs yet</h2>
            <p className="mx-auto mt-2 max-w-md text-zinc-600">
              Create a project to define your first versioned API schema.
            </p>
            <button
              className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => setDialogOpen(true)}
              type="button"
            >
              Create First Mock API
            </button>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {projects.map((project) => (
              <Link
                className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-5 transition-colors last:border-b-0 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <div>
                  <h2 className="font-semibold text-zinc-950">{project.name}</h2>
                  <p className="mt-1 font-mono text-sm text-zinc-500">
                    {project.baseEndpoint}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500">{displayRole(project.role)}</span>
                  <span className="rounded-md bg-blue-600 px-2.5 py-1 font-semibold text-white">
                    {project.currentVersion}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateProjectDialog
        onClose={() => setDialogOpen(false)}
        onSubmit={createProject}
        open={dialogOpen}
      />
    </main>
  );
}
