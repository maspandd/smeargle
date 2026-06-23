import packageJson from "../../../../../../../../package.json";
import { requireUser } from "@/features/auth/auth-service";
import { ForbiddenError, requireProjectCapability } from "@/features/projects/authorization";
import type { SchemaSnapshot } from "@/features/schema/schema-types";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; versionId: string }> },
) {
  try {
    const { projectId, versionId } = await context.params;
    const actor = await requireUser(readSessionToken(request));
    await requireProjectCapability({
      userId: actor.id,
      projectId,
      capability: "view_project",
    });

    const version = await prisma.schemaVersion.findFirstOrThrow({
      where: {
        id: versionId,
        projectId,
      },
      select: {
        id: true,
        versionLabel: true,
        createdAt: true,
        snapshot: true,
        project: {
          select: {
            id: true,
            name: true,
            baseEndpoint: true,
          },
        },
      },
    });

    return Response.json(
      {
        format: "mock-data-generator-schema",
        formatVersion: 1,
        productVersion: packageJson.version,
        project: {
          id: version.project.id,
          name: version.project.name,
          baseEndpoint: version.project.baseEndpoint,
        },
        version: {
          id: version.id,
          label: version.versionLabel,
          createdAt: version.createdAt.toISOString(),
        },
        schema: version.snapshot as SchemaSnapshot,
      },
      {
        status: 200,
        headers: {
          "Content-Disposition": `attachment; filename="${toDownloadFilename(
            version.project.name,
            version.versionLabel,
          )}"`,
        },
      },
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Authentication required") {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}

function readSessionToken(request: Request) {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "mock_data_session";
  const cookies = request.headers.get("cookie");

  if (!cookies) {
    return null;
  }

  for (const cookie of cookies.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === cookieName) {
      return value.join("=") || null;
    }
  }

  return null;
}

function toDownloadFilename(projectName: string, versionLabel: string) {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return `${slug || "project"}-schema-${versionLabel}.json`;
}
