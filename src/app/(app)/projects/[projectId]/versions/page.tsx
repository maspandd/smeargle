import { requireUser } from "@/features/auth/auth-service";
import { requireProjectCapability } from "@/features/projects/authorization";
import { VersionComparison } from "@/features/versions/components/version-comparison";
import { VersionHistory } from "@/features/versions/components/version-history";
import { diffSchemas } from "@/features/versions/schema-diff";
import { listProjectVersions } from "@/features/versions/version-query";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { rollbackVersionAction } from "./actions";

export default async function ProjectVersionsPage({
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
      memberships: {
        where: { userId: user.id },
        select: { role: true },
        take: 1,
      },
    },
  });
  if (!project) notFound();

  const versions = await listProjectVersions(projectId);
  const latest = versions[0] ?? null;
  const previous = versions[1] ?? null;
  const changes =
    latest && previous ? diffSchemas(previous.snapshot, latest.snapshot) : [];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm text-zinc-500">{project.baseEndpoint}</p>
              <h1 className="mt-1 text-2xl font-semibold">Schema Versions</h1>
              <p className="mt-2 text-sm text-zinc-500">{project.name}</p>
            </div>
            <Link
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold"
              href={`/projects/${projectId}`}
            >
              Back to Schema
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <VersionHistory
          canRollback={
            user.systemRole === "ADMIN" || project.memberships[0]?.role !== "VIEWER"
          }
          onRollback={rollbackVersionAction}
          projectId={projectId}
          versions={versions}
        />
        {latest && previous ? (
          <VersionComparison
            afterVersionLabel={latest.versionLabel}
            beforeVersionLabel={previous.versionLabel}
            changes={changes}
          />
        ) : (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Comparing Versions</h2>
            <p className="mt-3 text-sm text-zinc-500">
              Create another schema version to compare changes.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
