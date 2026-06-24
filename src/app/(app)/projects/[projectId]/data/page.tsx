import { requireUser } from "@/features/auth/auth-service";
import { GenerationForm } from "@/features/generation/components/generation-form";
import { requireProjectCapability } from "@/features/projects/authorization";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createGenerationJobAction } from "./actions";

export default async function ProjectDataPage({
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
      routeKey: true,
      currentSchemaVersion: {
        select: { snapshot: true },
      },
      memberships: {
        where: { userId: user.id },
        select: { role: true },
        take: 1,
      },
    },
  });
  if (!project) notFound();

  const snapshot = project.currentSchemaVersion?.snapshot as
    | SchemaSnapshot
    | undefined;
  const readOnly =
    user.systemRole !== "ADMIN" && project.memberships[0]?.role === "VIEWER";

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-zinc-900 px-6 py-5 text-white">
          <div>
            <p className="font-mono text-sm text-zinc-400">
              {project.baseEndpoint}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
          </div>
          <Link
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold hover:border-orange-400 hover:text-orange-300"
            href={`/projects/${projectId}`}
          >
            Back to Schema
          </Link>
        </header>

        <GenerationForm
          action={createGenerationJobAction}
          endpoint={`/api/mock/${project.routeKey}`}
          projectId={projectId}
          readOnly={readOnly}
          schemaEmpty={!snapshot || snapshot.fields.length === 0}
        />
      </div>
    </main>
  );
}
