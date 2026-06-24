import type { MockRecord } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectCapability } from "@/features/projects/authorization";

export type RecordQueryResult = {
  totalCount: number;
  records: MockRecord[];
};

export async function queryRecords(params: {
  actorId: string;
  projectId: string;
  page: number; // 1-indexed
  pageSize: number;
}): Promise<RecordQueryResult> {
  await requireProjectCapability({
    userId: params.actorId,
    projectId: params.projectId,
    capability: "view_project",
  });

  const [totalCount, records] = await prisma.$transaction([
    prisma.mockRecord.count({
      where: { projectId: params.projectId },
    }),
    prisma.mockRecord.findMany({
      where: { projectId: params.projectId },
      orderBy: { ordinal: "asc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  return { totalCount, records };
}
