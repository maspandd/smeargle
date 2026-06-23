import { prisma } from "@/lib/db";
import { requireProjectCapability } from "../projects/authorization";
import { addField, deleteField, editField, reorderField } from "./schema-mutations";
import type { FieldDefinition, SchemaSnapshot } from "./schema-types";

type AddFieldMutation = {
  type: "addField";
  parentFieldPath: string[];
  field: FieldDefinition;
};

type EditFieldMutation = {
  type: "editField";
  fieldPath: string[];
  field: FieldDefinition;
};

type DeleteFieldMutation = {
  type: "deleteField";
  fieldPath: string[];
};

type ReorderFieldMutation = {
  type: "reorderField";
  parentFieldPath: string[];
  fieldId: string;
  targetIndex: number;
};

export type SchemaMutation =
  | AddFieldMutation
  | EditFieldMutation
  | DeleteFieldMutation
  | ReorderFieldMutation;

type MutateSchemaRequest = {
  actorId: string;
  projectId: string;
  expectedVersionId: string;
  mutation: SchemaMutation;
};

type MutateSchemaResult =
  | {
      ok: true;
      version: {
        id: string;
        versionLabel: string;
        snapshot: SchemaSnapshot;
      };
    }
  | { ok: false; code: "VERSION_CONFLICT" };

export async function mutateSchema(
  request: MutateSchemaRequest,
): Promise<MutateSchemaResult> {
  await requireProjectCapability({
    userId: request.actorId,
    projectId: request.projectId,
    capability: "edit_schema",
  });

  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findUniqueOrThrow({
      where: { id: request.projectId },
      select: {
        currentSchemaVersionId: true,
        currentSchemaVersion: true,
      },
    });

    if (project.currentSchemaVersionId !== request.expectedVersionId) {
      return { ok: false, code: "VERSION_CONFLICT" };
    }

    if (!project.currentSchemaVersion) {
      throw new Error("Project does not have a current schema version");
    }

    const snapshot = applyMutation(
      project.currentSchemaVersion.snapshot as SchemaSnapshot,
      request.mutation,
    );
    const major = project.currentSchemaVersion.major;
    const minor = project.currentSchemaVersion.minor + 1;
    const versionLabel = formatVersionLabel(major, minor);
    const version = await transaction.schemaVersion.create({
      data: {
        projectId: request.projectId,
        major,
        minor,
        versionLabel,
        snapshot,
        changeSummary: summarizeMutation(request.mutation),
        actorId: request.actorId,
      },
    });

    await transaction.project.update({
      where: { id: request.projectId },
      data: {
        currentMajor: major,
        currentMinor: minor,
        currentSchemaVersionId: version.id,
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
          mutationType: request.mutation.type,
        },
      },
    });

    return {
      ok: true,
      version: {
        id: version.id,
        versionLabel: version.versionLabel,
        snapshot: version.snapshot as SchemaSnapshot,
      },
    };
  });
}

function applyMutation(
  snapshot: SchemaSnapshot,
  mutation: SchemaMutation,
): SchemaSnapshot {
  switch (mutation.type) {
    case "addField":
      return addField(snapshot, mutation.parentFieldPath, mutation.field);
    case "editField":
      return editField(snapshot, mutation.fieldPath, mutation.field);
    case "deleteField":
      return deleteField(snapshot, mutation.fieldPath);
    case "reorderField":
      return reorderField(
        snapshot,
        mutation.parentFieldPath,
        mutation.fieldId,
        mutation.targetIndex,
      );
  }
}

function summarizeMutation(mutation: SchemaMutation) {
  switch (mutation.type) {
    case "addField":
      return `Added ${mutation.field.name} field`;
    case "editField":
      return `Updated ${mutation.field.name} field`;
    case "deleteField":
      return "Deleted field";
    case "reorderField":
      return "Reordered field";
  }
}

function formatVersionLabel(major: number, minor: number) {
  return `v${major}.${minor}`;
}
