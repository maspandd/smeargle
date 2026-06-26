/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();
const action = process.argv[2];
const input = JSON.parse(process.argv[3] || "{}");
const password = "Correct-Horse-42";

async function main() {
  switch (action) {
    case "reset":
      await prisma.mockRecord.deleteMany();
      await prisma.generatedRecordStage.deleteMany();
      await prisma.generationJob.deleteMany();
      await prisma.schemaVersion.deleteMany();
      await prisma.auditEvent.deleteMany();
      await prisma.projectMembership.deleteMany();
      await prisma.session.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
      return null;
    case "seed-user":
      return prisma.user.create({
        data: {
          email: input.email,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
          systemRole: input.options.role || "USER",
          status: input.options.status || "ACTIVE",
        },
      });
    case "seed-project":
      return prisma.project.create({
        data: {
          name: "Products API",
          baseEndpoint: "/api/products",
          routeKey: randomBytes(18).toString("base64url"),
          memberships: { create: { userId: input.ownerId, role: "OWNER" } },
          auditEvents: {
            create: {
              actorId: input.ownerId,
              action: "PROJECT_CREATED",
              metadata: {},
            },
          },
        },
      });
    case "seed-membership":
      return prisma.projectMembership.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
        },
      });
    case "seed-mock-api":
      const project = await prisma.project.create({
        data: {
          name: "Mock API",
          baseEndpoint: "/api/items",
          routeKey: input.routeKey || randomBytes(18).toString("base64url"),
          tokenRequired: input.tokenRequired || false,
          corsOrigins: input.corsOrigins || [],
          rateLimit: input.rateLimit || 100,
          schemaVersions: {
            create: {
              major: 1,
              minor: 0,
              versionLabel: "v1",
              changeSummary: "Initial schema",
              snapshot: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" }
                }
              },
            }
          }
        },
        include: { schemaVersions: true }
      });
      if (input.records) {
        await prisma.mockRecord.createMany({
          data: input.records.map((r, i) => ({
            id: `rec_${i}`,
            projectId: project.id,
            schemaVersionId: project.schemaVersions[0].id,
            value: r,
            ordinal: i,
            source: "GENERATED"
          }))
        });
      }
      if (input.tokenHash) {
        await prisma.apiCredential.create({
          data: {
            projectId: project.id,
            label: "Test Token",
            tokenHash: input.tokenHash,
          }
        });
      }
      return project;
    case "count-projects":
      return prisma.project.count();
    default:
      throw new Error(`Unknown fixture action: ${action}`);
  }
}

main()
  .then(async (result) => {
    await prisma.$disconnect();
    if (result !== null && result !== undefined) {
      process.stdout.write(JSON.stringify(result));
    }
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error(error);
    process.exit(1);
  });
