import { requireUser } from "@/features/auth/auth-service";
import {
  ForbiddenError,
  requireProjectCapability,
} from "@/features/projects/authorization";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ projectId: string; jobId: string }>;
  },
) {
  try {
    const { projectId, jobId } = await context.params;
    const actor = await requireUser(readSessionToken(request));
    await requireProjectCapability({
      userId: actor.id,
      projectId,
      capability: "view_project",
    });

    const job = await prisma.generationJob.findFirst({
      where: { id: jobId, projectId },
      select: {
        id: true,
        status: true,
        count: true,
        seed: true,
        warningSummary: true,
        updatedAt: true,
      },
    });

    if (!job) {
      return Response.json({ error: "Generation job not found" }, { status: 404 });
    }

    return Response.json({
      jobId: job.id,
      status: job.status,
      count: job.count,
      seed: job.seed,
      warningSummary: job.warningSummary,
      updatedAt: job.updatedAt.toISOString(),
    });
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
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === cookieName) {
      return value.join("=") || null;
    }
  }

  return null;
}
