import { prisma } from "@/lib/db";

export async function resetDatabase() {
  await prisma.auditEvent.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
