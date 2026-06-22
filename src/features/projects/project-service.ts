import { prisma } from "@/lib/db";
import { createRouteKey } from "@/lib/route-key";
import { createProjectInput } from "./project-schema";

type CreateProjectRequest = {
  actorId: string;
  name: string;
  baseEndpoint: string;
};

export async function createProject(request: CreateProjectRequest) {
  const input = createProjectInput.parse(request);

  const project = await prisma.$transaction((transaction) =>
    transaction.project.create({
      data: {
        name: input.name,
        baseEndpoint: input.baseEndpoint,
        routeKey: createRouteKey(),
        memberships: {
          create: { userId: request.actorId, role: "OWNER" },
        },
        auditEvents: {
          create: {
            actorId: request.actorId,
            action: "PROJECT_CREATED",
            metadata: {},
          },
        },
      },
    }),
  );

  return {
    ...project,
    currentVersion: `v${project.currentMajor}.${project.currentMinor}`,
  };
}

export async function listProjectsForUser(userId: string) {
  const memberships = await prisma.projectMembership.findMany({
    where: { userId },
    orderBy: { project: { createdAt: "desc" } },
    select: {
      role: true,
      project: {
        select: {
          id: true,
          name: true,
          baseEndpoint: true,
          currentMajor: true,
          currentMinor: true,
        },
      },
    },
  });

  return memberships.map(({ project, role }) => ({
    ...project,
    role,
    currentVersion: `v${project.currentMajor}.${project.currentMinor}`,
  }));
}
