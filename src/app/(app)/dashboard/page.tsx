import { requireUser } from "@/features/auth/auth-service";
import { listProjectsForUser } from "@/features/projects/project-service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createProjectAction } from "../projects/actions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;

  let user;
  try {
    user = await requireUser(token);
  } catch {
    redirect("/login");
  }

  const projects = await listProjectsForUser(user.id);
  return <DashboardClient createProject={createProjectAction} projects={projects} />;
}
