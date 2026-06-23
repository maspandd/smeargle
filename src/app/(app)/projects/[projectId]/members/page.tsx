import { requireUser } from "@/features/auth/auth-service";
import { requireProjectCapability } from "@/features/projects/authorization";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
} from "./actions";
import { MembersClient } from "./members-client";

export default async function MembersPage({
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
    capability: "manage_members",
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, role: true, user: { select: { email: true } } },
      },
    },
  });
  if (!project) notFound();

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <Link className="text-sm font-medium text-blue-700" href={`/projects/${projectId}`}>
          Back to project
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Project members</h1>
        <p className="mt-2 text-zinc-600">Manage access to {project.name}.</p>
        <div className="mt-8">
          <MembersClient
            members={project.memberships.map((membership) => ({
              userId: membership.userId,
              email: membership.user.email,
              role: membership.role,
            }))}
            onAdd={addMemberAction.bind(null, projectId)}
            onChangeRole={changeMemberRoleAction.bind(null, projectId)}
            onRemove={removeMemberAction.bind(null, projectId)}
          />
        </div>
      </div>
    </main>
  );
}
