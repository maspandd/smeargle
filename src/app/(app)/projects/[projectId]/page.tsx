import type { ProjectRole } from "@prisma/client";
import { requireUser } from "@/features/auth/auth-service";
import { requireProjectCapability } from "@/features/projects/authorization";
import { SchemaBuilder } from "@/features/schema/components/schema-builder";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addFieldAction } from "./schema/actions";

type ProjectWorkspaceProps = {
  name: string;
  baseEndpoint: string;
  currentVersion: string;
  currentVersionId: string;
  currentSnapshot: SchemaSnapshot;
  memberCount: number;
  projectId: string;
  role: ProjectRole | "ADMIN";
};

export function ProjectWorkspace({
  name,
  baseEndpoint,
  currentVersion,
  currentVersionId,
  currentSnapshot,
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
        <SchemaBuilder
          generationHref={`/projects/${projectId}/data`}
          initialSnapshot={currentSnapshot}
          initialVersionId={currentVersionId}
          initialVersionLabel={currentVersion}
          onAddField={addFieldAction}
          projectId={projectId}
          readOnly={readOnly}
        />
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
      currentSchemaVersion: {
        select: {
          id: true,
          snapshot: true,
        },
      },
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
      currentSnapshot={
        (project.currentSchemaVersion?.snapshot as SchemaSnapshot | undefined) ?? {
          fields: [],
        }
      }
      currentVersion={`v${project.currentMajor}.${project.currentMinor}`}
      currentVersionId={project.currentSchemaVersion?.id ?? ""}
      memberCount={project._count.memberships}
      name={project.name}
      projectId={projectId}
      role={user.systemRole === "ADMIN" ? "ADMIN" : project.memberships[0].role}
    />
  );
}
