import { prisma } from "@/lib/db";
import { RuntimeContext } from "./runtime-context";
import { MockRuntimeError } from "./runtime-error";
import { Prisma } from "@prisma/client";

export async function getRecords(context: RuntimeContext, searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSizeStr = searchParams.get("pageSize") || "10";
  const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10)));
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder")?.toLowerCase() === "desc" ? "desc" : "asc";

  const allowedFields = new Set<string>(["id"]);
  if (context.schemaSnapshot && typeof context.schemaSnapshot === "object" && "fields" in context.schemaSnapshot && Array.isArray((context.schemaSnapshot as { fields: unknown[] }).fields)) {
    for (const field of (context.schemaSnapshot as { fields: { name: string; type: string }[] }).fields) {
      if (["STRING", "NUMBER", "BOOLEAN"].includes(field.type)) {
        allowedFields.add(field.name);
      }
    }
  }

  if (sortBy && !allowedFields.has(sortBy)) {
    throw new MockRuntimeError("VALIDATION_ERROR", `Cannot sort by unknown field: ${sortBy}`);
  }

  const jsonFilters: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key !== "page" && key !== "pageSize" && key !== "sortBy" && key !== "sortOrder") {
      if (allowedFields.has(key)) {
        const numericValue = Number(value);
        if (!isNaN(numericValue) && String(numericValue) === value) {
          jsonFilters[key] = numericValue;
        } else if (value === "true") {
          jsonFilters[key] = true;
        } else if (value === "false") {
          jsonFilters[key] = false;
        } else {
          jsonFilters[key] = value;
        }
      }
    }
  }

  const where: Prisma.MockRecordWhereInput = {
    projectId: context.project.id,
  };

  if (Object.keys(jsonFilters).length > 0) {
    where.AND = Object.entries(jsonFilters).map(([key, val]) => ({
      value: {
        path: [key],
        equals: val,
      },
    })) as Prisma.MockRecordWhereInput["AND"];
  }

  const count = await prisma.mockRecord.count({ where });

  let records: { id: string; value: Prisma.JsonValue }[] = [];

  if (sortBy) {
    // Whitelisted sortBy means it's safe to interpolate in raw query.
    // Use stable secondary sort by record ID.
    const sortField = Prisma.sql([`"value"->>'${sortBy}'`]);
    const direction = sortOrder === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    
    // We also need to map the where conditions into raw SQL if we mix it.
    // However, generating dynamic WHERE in Prisma Raw is tricky.
    // Wait, let's use Prisma native findMany, then map? But pagination!
    // Since this is Mock Runtime, let's just use raw query for the whole thing.
    
    let filterSql = Prisma.empty;
    for (const [key, val] of Object.entries(jsonFilters)) {
      if (typeof val === "number") {
        filterSql = Prisma.sql`${filterSql} AND ("value"->>${key})::numeric = ${val}`;
      } else if (typeof val === "boolean") {
        filterSql = Prisma.sql`${filterSql} AND ("value"->>${key})::boolean = ${val}`;
      } else {
        filterSql = Prisma.sql`${filterSql} AND "value"->>${key} = ${val}`;
      }
    }

    records = await prisma.$queryRaw`
      SELECT * FROM "MockRecord"
      WHERE "projectId" = ${context.project.id}
      ${filterSql}
      ORDER BY ${sortField} ${direction}, "id" ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;
  } else {
    // No sortBy, just use Prisma's findMany with native JSON path filtering
    const dbRecords = await prisma.mockRecord.findMany({
      where,
      orderBy: { id: 'asc' }, // Stable sort
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    records = dbRecords;
  }

  return {
    data: records.map(r => r.value),
    meta: {
      count,
      endpoint: context.project.baseEndpoint,
      projectId: context.project.id,
    },
  };
}

export async function getRecordById(context: RuntimeContext) {
  if (!context.recordId) {
    throw new MockRuntimeError("RECORD_NOT_FOUND", "Record not found");
  }

  // Find record by traversing JSON value field to match "id" property = context.recordId
  // Wait, does "recordId" mean the MockRecord DB ID, or the data JSON ID?
  // Record GET tests: Assert a known ID returns one object. The ID we seeded was "record-123" inside data!
  const record = await prisma.mockRecord.findFirst({
    where: {
      projectId: context.project.id,
      value: {
        path: ["id"],
        equals: context.recordId,
      },
    },
  });

  if (!record) {
    throw new MockRuntimeError("RECORD_NOT_FOUND", "Record not found");
  }

  return record.value;
}
