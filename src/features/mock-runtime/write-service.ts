import { prisma } from "@/lib/db";
import { RuntimeContext } from "./runtime-context";
import { MockRuntimeError } from "./runtime-error";
import { Prisma } from "@prisma/client";
import { validateRecordValue } from "@/features/schema/value-validator";
import { SchemaSnapshot } from "@/features/schema/schema-types";
import { randomUUID } from "node:crypto";

export async function createRecord(context: RuntimeContext, body: unknown) {
  if (context.project.dataStatus === "INCOMPATIBLE") {
    throw new MockRuntimeError("CONFLICT", "Project data is incompatible with current schema");
  }

  const schemaSnapshot = context.schemaSnapshot as SchemaSnapshot;
  
  if (!schemaSnapshot || !schemaSnapshot.fields) {
    throw new MockRuntimeError("VALIDATION_ERROR", "No active schema found");
  }

  // Validate the body
  const validation = validateRecordValue(schemaSnapshot, body);
  if (!validation.ok) {
    throw new MockRuntimeError("VALIDATION_ERROR", "Validation failed", {
      errors: validation.errors.map(err => ({ message: err }))
    });
  }

  const recordValue = { ...(body as Prisma.InputJsonObject) };
  if (!recordValue.id) {
    recordValue.id = randomUUID();
  }

  // Check for duplicate explicit ID
  const existingCount = await prisma.mockRecord.count({
    where: {
      projectId: context.project.id,
      value: {
        path: ["id"],
        equals: recordValue.id as string,
      },
    },
  });

  if (existingCount > 0) {
    throw new MockRuntimeError("CONFLICT", "Record with this ID already exists");
  }

  // Determine the next ordinal (could use a transaction, but count is sufficient for mock API)
  const totalRecords = await prisma.mockRecord.count({
    where: { projectId: context.project.id },
  });

  const record = await prisma.mockRecord.create({
    data: {
      projectId: context.project.id,
      schemaVersionId: context.project.currentSchemaVersionId!,
      ordinal: totalRecords + 1,
      source: "GENERATED",
      value: recordValue,
    },
  });

  await prisma.auditEvent.create({
    data: {
      projectId: context.project.id,
      action: "DATA_GENERATED",
      metadata: { recordId: recordValue.id as string, operation: "CREATE" },
    },
  });

  return record.value;
}
