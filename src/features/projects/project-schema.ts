import { z } from "zod";

export const createProjectInput = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  baseEndpoint: z
    .string()
    .trim()
    .refine((value) => value.startsWith("/"), "Endpoint must start with /")
    .refine(
      (value) => !/[?#]/.test(value),
      "Endpoint cannot include a query string or fragment",
    )
    .transform((value) => value.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/")
    .refine(
      (value) => value !== "/api/mock" && !value.startsWith("/api/mock/"),
      "Endpoint is reserved by the platform",
    ),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;
