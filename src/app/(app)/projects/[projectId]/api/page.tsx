import { requireUser } from "@/features/auth/auth-service";
import { requireProjectCapability } from "@/features/projects/authorization";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createTokenAction, revokeTokenAction, saveRuntimeSettingsAction } from "./actions";
import { ApiWorkspaceClient } from "@/features/mock-runtime/components/api-workspace-client";
import { cookies } from "next/headers";

export default async function ApiPage({
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
      id: true,
      routeKey: true,
      baseEndpoint: true,
      tokenRequired: true,
      corsOrigins: true,
      rateLimit: true,
      memberships: {
        where: { userId: user.id },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!project) notFound();

  const role = user.systemRole === "ADMIN" ? "ADMIN" : project.memberships[0].role;
  const canManage = role === "OWNER" || role === "ADMIN" || role === "EDITOR"; // based on capabilities

  const credentials = await prisma.apiCredential.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;
  const collectionUrl = `${baseUrl}/api/mock/${project.routeKey}${project.baseEndpoint}`;
  const recordUrl = `${collectionUrl}/:id`;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-2xl font-semibold">Mock API Workspace</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your API credentials, CORS policies, and rate limits.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <ApiWorkspaceClient
          project={project}
          credentials={credentials}
          canManage={canManage}
          collectionUrl={collectionUrl}
          recordUrl={recordUrl}
          createTokenAction={createTokenAction}
          revokeTokenAction={revokeTokenAction}
          saveRuntimeSettingsAction={saveRuntimeSettingsAction}
        />
      </section>
    </main>
  );
}
