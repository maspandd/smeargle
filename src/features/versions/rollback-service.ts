import { prisma } from "@/lib/db";
import {
  type CompatibilityKind,
  classifySchemaChange,
} from "../schema/compatibility";
import type { SchemaSnapshot } from "../schema/schema-types";
import { requireProjectCapability } from "../projects/authorization";

type RollbackSchemaVersionRequest = {
  actorId: string;
  projectId: string;
  versionId: string;
  expectedVersionId: string;
  confirmedImpact: boolean;
};

export type RollbackSchemaVersionResult =
  | {
      ok: true;
      compatibility: ReturnType<typeof classifySchemaChange>;
      version: {
        id: string;
        versionLabel: string;
        snapshot: SchemaSnapshot;
      };
    }
  | { ok: false; code: "VERSION_CONFLICT" | "ROLLBACK_CONFIRMATION_REQUIRED" };

export async function rollbackSchemaVersion(
  request: RollbackSchemaVersionRequest,
): Promise<RollbackSchemaVersionResult> {
  await requireProjectCapability({
    userId: request.actorId,
    projectId: request.projectId,
    capability: "edit_schema",
  });

  if (!request.confirmedImpact) {
    return { ok: false, code: "ROLLBACK_CONFIRMATION_REQUIRED" };
  }

  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findUniqueOrThrow({
      where: { id: request.projectId },
      select: {
        dataStatus: true,
        currentSchemaVersionId: true,
        currentSchemaVersion: {
          select: {
            major: true,
            minor: true,
            snapshot: true,
          },
        },
      },
    });

    if (project.currentSchemaVersionId !== request.expectedVersionId) {
      return { ok: false, code: "VERSION_CONFLICT" };
    }

    if (!project.currentSchemaVersion) {
      throw new Error("Project does not have a current schema version");
    }

    const restoredFrom = await transaction.schemaVersion.findFirstOrThrow({
      where: {
        id: request.versionId,
        projectId: request.projectId,
      },
      select: {
        id: true,
        versionLabel: true,
        snapshot: true,
      },
    });

    const currentSnapshot = project.currentSchemaVersion.snapshot as SchemaSnapshot;
    const rollbackSnapshot = restoredFrom.snapshot as SchemaSnapshot;
    const compatibility = classifySchemaChange(currentSnapshot, rollbackSnapshot);
    const major = project.currentSchemaVersion.major;
    const minor = project.currentSchemaVersion.minor + 1;
    const versionLabel = formatVersionLabel(major, minor);
    const version = await transaction.schemaVersion.create({
      data: {
        projectId: request.projectId,
        major,
        minor,
        versionLabel,
        snapshot: rollbackSnapshot,
        changeSummary: `Restored schema from ${restoredFrom.versionLabel}`,
        actorId: request.actorId,
        restoredFromId: restoredFrom.id,
      },
    });

    await transaction.project.update({
      where: { id: request.projectId },
      data: {
        currentMajor: major,
        currentMinor: minor,
        currentSchemaVersionId: version.id,
        dataStatus: nextDataStatus(project.dataStatus, compatibility.kind),
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorId: request.actorId,
        projectId: request.projectId,
        action: "SCHEMA_MUTATED",
        metadata: {
          versionId: version.id,
          versionLabel,
          mutationType: "rollback",
          restoredFromId: restoredFrom.id,
          restoredFromVersionLabel: restoredFrom.versionLabel,
          compatibilityKind: compatibility.kind,
          compatibilityOperation: compatibility.operation,
          affectedFieldIds: compatibility.affectedFieldIds,
          affectedPaths: compatibility.affectedPaths,
          compatibilityWarning: compatibility.warning,
        },
      },
    });

    return {
      ok: true,
      compatibility,
      version: {
        id: version.id,
        versionLabel: version.versionLabel,
        snapshot: version.snapshot as SchemaSnapshot,
      },
    };
  });
}

function formatVersionLabel(major: number, minor: number) {
  return `v${major}.${minor}`;
}

function nextDataStatus(
  current: "EMPTY" | "COMPATIBLE" | "INCOMPATIBLE",
  compatibilityKind: CompatibilityKind,
) {
  if (current === "EMPTY") {
    return "EMPTY" as const;
  }
  if (current === "INCOMPATIBLE") {
    return "INCOMPATIBLE" as const;
  }
  if (compatibilityKind === "INCOMPATIBLE") {
    return "INCOMPATIBLE" as const;
  }

  return "COMPATIBLE" as const;
}
