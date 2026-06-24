import { prisma } from "@/lib/db";
import { MockRuntimeError } from "./runtime-error";
import { randomUUID } from "node:crypto";
import type { Project, SchemaVersion, Prisma } from "@prisma/client";

export interface RuntimeContext {
  project: Project;
  resource: string;
  requestId: string;
  recordId?: string;
  schemaSnapshot?: Prisma.JsonValue;
}

export async function resolveRuntimeContext(
  routeKey: string,
  segments: string[]
): Promise<RuntimeContext> {
  const requestId = randomUUID();
  const decodedSegments = segments.map(decodeURIComponent);

  const project = await prisma.project.findUnique({
    where: { routeKey },
    include: {
      schemaVersions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new MockRuntimeError("PROJECT_NOT_FOUND", "Project not found");
  }

  // derive resource from the last base-endpoint segment
  const baseSegments = project.baseEndpoint
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  
  const expectedResource = baseSegments[baseSegments.length - 1];

  if (!decodedSegments.length || decodedSegments[0] !== expectedResource) {
    throw new MockRuntimeError("RESOURCE_NOT_FOUND", "Resource not found");
  }

  if (decodedSegments.length > 2) {
    throw new MockRuntimeError("RECORD_NOT_FOUND", "Record not found");
  }

  const recordId = decodedSegments.length === 2 ? decodedSegments[1] : undefined;

  const currentSchemaVersion = project.schemaVersions[0];
  const schemaSnapshot = currentSchemaVersion ? (currentSchemaVersion as SchemaVersion).snapshot : undefined;

  return {
    project,
    resource: expectedResource,
    requestId,
    recordId,
    schemaSnapshot,
  };
}
