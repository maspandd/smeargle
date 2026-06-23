import { prisma } from "@/lib/db";
import type { SchemaSnapshot } from "../schema/schema-types";

export type VersionHistoryEntry = {
  id: string;
  versionLabel: string;
  changeSummary: string;
  actorLabel: string;
  createdAt: string;
  createdAtLabel: string;
  isCurrent: boolean;
  snapshot: SchemaSnapshot;
};

export async function listProjectVersions(projectId: string): Promise<VersionHistoryEntry[]> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      currentSchemaVersionId: true,
      schemaVersions: {
        orderBy: [{ major: "desc" }, { minor: "desc" }],
        select: {
          id: true,
          versionLabel: true,
          changeSummary: true,
          createdAt: true,
          snapshot: true,
          actor: {
            select: { email: true },
          },
        },
      },
    },
  });

  return project.schemaVersions.map((version) => ({
    id: version.id,
    versionLabel: version.versionLabel,
    changeSummary: version.changeSummary,
    actorLabel: version.actor?.email ?? "System",
    createdAt: version.createdAt.toISOString(),
    createdAtLabel: formatTimestamp(version.createdAt),
    isCurrent: version.id === project.currentSchemaVersionId,
    snapshot: version.snapshot as SchemaSnapshot,
  }));
}

function formatTimestamp(value: Date) {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
