import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSchema } from "../schema/schema-parser";
import type { SchemaSnapshot } from "../schema/schema-types";

export const EMPTY_SCHEMA_SNAPSHOT: SchemaSnapshot = { fields: [] };

type CreateSchemaVersionRequest = {
  actorId: string;
  projectId: string;
  snapshot: SchemaSnapshot;
  changeSummary: string;
};

type CreateInitialSchemaVersionRequest = {
  actorId: string;
  projectId: string;
};

export async function createSchemaVersion(request: CreateSchemaVersionRequest) {
  return prisma.$transaction((transaction) =>
    createSchemaVersionInTransaction(transaction, request),
  );
}

export async function createInitialSchemaVersionInTransaction(
  transaction: Prisma.TransactionClient,
  request: CreateInitialSchemaVersionRequest,
) {
  const version = await transaction.schemaVersion.create({
    data: {
      projectId: request.projectId,
      major: 1,
      minor: 0,
      versionLabel: formatVersionLabel(1, 0),
      snapshot: EMPTY_SCHEMA_SNAPSHOT,
      changeSummary: "Initial empty schema",
      actorId: request.actorId,
    },
  });

  await transaction.project.update({
    where: { id: request.projectId },
    data: {
      currentMajor: version.major,
      currentMinor: version.minor,
      currentSchemaVersionId: version.id,
    },
  });

  return version;
}

async function createSchemaVersionInTransaction(
  transaction: Prisma.TransactionClient,
  request: CreateSchemaVersionRequest,
) {
  const snapshot = parseSchema(request.snapshot);
  const project = await transaction.project.findUniqueOrThrow({
    where: { id: request.projectId },
    select: {
      currentSchemaVersion: {
        select: { major: true, minor: true },
      },
    },
  });
  const current = project.currentSchemaVersion ?? { major: 1, minor: 0 };
  const next = {
    major: current.major,
    minor: current.minor + 1,
  };
  const version = await transaction.schemaVersion.create({
    data: {
      projectId: request.projectId,
      major: next.major,
      minor: next.minor,
      versionLabel: formatVersionLabel(next.major, next.minor),
      snapshot,
      changeSummary: request.changeSummary,
      actorId: request.actorId,
    },
  });

  await transaction.project.update({
    where: { id: request.projectId },
    data: {
      currentMajor: version.major,
      currentMinor: version.minor,
      currentSchemaVersionId: version.id,
    },
  });

  return version;
}

function formatVersionLabel(major: number, minor: number) {
  return `v${major}.${minor}`;
}
