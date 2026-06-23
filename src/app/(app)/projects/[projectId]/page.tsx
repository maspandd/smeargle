import type { ProjectRole } from "@prisma/client";
import { requireUser } from "@/features/auth/auth-service";
import { requireProjectCapability } from "@/features/projects/authorization";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ProjectWorkspaceProps = {
  name: string;
  baseEndpoint: string;
  currentVersion: string;
  memberCount: number;
  projectId: string;
  role: ProjectRole | "ADMIN";
};

export function ProjectWorkspace({
  name,
  baseEndpoint,
  currentVersion,
  memberCount,
  projectId,
  role,
}: ProjectWorkspaceProps) {
  const readOnly = role === "VIEWER";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-zinc-500">{baseEndpoint}</p>
              <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
            </div>
            <span className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">
              {currentVersion}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
            <span>Indonesian locale</span>
            <span>{memberCount} member{memberCount === 1 ? "" : "s"}</span>
            <span>{role === "ADMIN" ? "Administrator" : role.toLowerCase()}</span>
            {role === "OWNER" || role === "ADMIN" ? (
              <Link className="font-medium text-blue-700" href={`/projects/${projectId}/members`}>
                Members
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Schema Builder</h2>
            <p className="mt-1 text-zinc-600">Define the fields for this mock API.</p>
          </div>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300"
            disabled={readOnly}
            title={readOnly ? "Viewers cannot edit the schema" : undefined}
            type="button"
          >
            Add Field
          </button>
        </div>
        <div className="mt-8 border-y border-dashed border-zinc-300 py-16 text-center text-zinc-500">
          No fields yet. Add a field to begin the v1.0 schema.
        </div>
      </section>
    </main>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;

  let user;
  try {
    user = await requireUser(token);
  } catch {
    redirect("/login");
  }

  await requireProjectCapability({
    userId: user.id,
    projectId,
    capability: "view_project",
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      baseEndpoint: true,
      currentMajor: true,
      currentMinor: true,
      _count: { select: { memberships: true } },
      memberships: {
        where: { userId: user.id },
        select: { role: true },
        take: 1,
      },
    },
  });
  if (!project) notFound();

  return (
    <ProjectWorkspace
      baseEndpoint={project.baseEndpoint}
      currentVersion={`v${project.currentMajor}.${project.currentMinor}`}
      memberCount={project._count.memberships}
      name={project.name}
      projectId={projectId}
      role={user.systemRole === "ADMIN" ? "ADMIN" : project.memberships[0].role}
    />
  );
}
