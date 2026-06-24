import { requireUser } from "@/features/auth/auth-service";
import { GenerationForm } from "@/features/generation/components/generation-form";
import { requireProjectCapability } from "@/features/projects/authorization";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createGenerationJobAction } from "./actions";
import { queryRecords } from "@/features/records/record-query";
import { DataPreview } from "@/features/records/components/data-preview";

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
      dataStatus: true,
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

  // Fetch page data
  const { totalCount, records } = await queryRecords({
    actorId: user.id,
    projectId,
    page: 1,
    pageSize: 10,
  });

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

        {project.dataStatus === "INCOMPATIBLE" ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="font-semibold text-red-800">Incompatible dataset</h3>
            <p className="mt-1 text-sm text-red-700">
              The schema has changed since these records were generated. You should regenerate or delete this dataset to restore compatibility.
            </p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <GenerationForm
              action={createGenerationJobAction}
              endpoint={`/api/mock/${project.routeKey}`}
              projectId={projectId}
              readOnly={readOnly}
              schemaEmpty={!snapshot || snapshot.fields.length === 0}
            />
          </div>
          <div className="lg:col-span-2">
            {snapshot && totalCount > 0 ? (
              <DataPreview schema={snapshot} records={records} totalCount={totalCount} page={1} pageSize={10} />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
