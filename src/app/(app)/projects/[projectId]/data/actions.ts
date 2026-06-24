"use server";

import { requireUser } from "@/features/auth/auth-service";
import type {
  GenerationFormActionResult,
  GenerationFormValues,
} from "@/features/generation/components/generation-form";
import { createGenerationJob } from "@/features/generation/generation-service";
import { cookies } from "next/headers";

export async function createGenerationJobAction(
  projectId: string,
  values: GenerationFormValues,
): Promise<GenerationFormActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(
    process.env.SESSION_COOKIE_NAME ?? "mock_data_session",
  )?.value;
  const actor = await requireUser(token);
  const result = await createGenerationJob({
    actorId: actor.id,
    projectId,
    count: parseOptionalNumber(values.count),
    seed: values.seed,
    nullRate: parseNullRate(values.nullPercentage),
    mode: values.mode,
    confirmedReplacement: values.confirmedReplacement,
  });

  if (result.ok || result.code === "REPLACEMENT_CONFIRMATION_REQUIRED") {
    return result;
  }

  if (
    result.message === "Please specify number of records" ||
    result.message === "Record count must be between 1 and 10,000"
  ) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { count: result.message },
    };
  }

  if (result.message === "Null rate must be between 0 and 1") {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { nullPercentage: result.message },
    };
  }

  return {
    ok: false,
    code: "VALIDATION_ERROR",
    formError: result.message,
  };
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") return undefined;
  return Number(value);
}

function parseNullRate(value: string) {
  if (value.trim() === "") return Number.NaN;
  return Number(value) / 100;
}
