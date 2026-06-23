import { prisma } from "@/lib/db";

export async function resetDatabase() {
  await prisma.auditEvent.deleteMany();
  await prisma.project.updateMany({ data: { currentSchemaVersionId: null } });
  await prisma.schemaVersion.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
