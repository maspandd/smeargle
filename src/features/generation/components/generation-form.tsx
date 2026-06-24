"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { JobProgress } from "./job-progress";

export type GenerationFormValues = {
  count: string;
  seed: string;
  nullPercentage: string;
  mode: "FAKER_ONLY" | "HYBRID_LLM";
  confirmedReplacement: boolean;
};

export type GenerationFormActionResult =
  | {
      ok: true;
      jobId: string;
      seed: string;
    }
  | {
      ok: false;
      code: "VALIDATION_ERROR";
      fieldErrors?: {
        count?: string;
        nullPercentage?: string;
      };
      formError?: string;
    }
  | {
      ok: false;
      code: "REPLACEMENT_CONFIRMATION_REQUIRED";
      existingRecordCount: number;
    };

export type GenerationFormAction = (
  projectId: string,
  values: GenerationFormValues,
) => Promise<GenerationFormActionResult>;

type GenerationFormProps = {
  action: GenerationFormAction;
  endpoint: string;
  projectId: string;
  readOnly: boolean;
  schemaEmpty: boolean;
};

const EMPTY_SCHEMA_MESSAGE =
  "Add at least one schema field before generating records";

export function GenerationForm({
  action,
  endpoint,
  projectId,
  readOnly,
  schemaEmpty,
}: GenerationFormProps) {
  const router = useRouter();
  const [count, setCount] = useState("10");
  const [seed, setSeed] = useState("");
  const [nullPercentage, setNullPercentage] = useState("0");
  const [mode, setMode] =
    useState<GenerationFormValues["mode"]>("FAKER_ONLY");
  const [fieldErrors, setFieldErrors] = useState<{
    count?: string;
    nullPercentage?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [replacementCount, setReplacementCount] = useState<number | null>(null);
  const [createdJob, setCreatedJob] = useState<{
    id: string;
    seed: string;
  } | null>(null);

  const numericCount = Number(count);
  const buttonLabel =
    count.trim() && Number.isInteger(numericCount) && numericCount > 0
      ? `Generate ${numericCount} Records`
      : "Generate Records";

  async function submit(confirmedReplacement: boolean) {
    if (pending) return;

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const result = await action(projectId, {
        count,
        seed,
        nullPercentage,
        mode,
        confirmedReplacement,
      });

      if (result.ok) {
        setReplacementCount(null);
        setCreatedJob({ id: result.jobId, seed: result.seed });
        return;
      }

      if (result.code === "REPLACEMENT_CONFIRMATION_REQUIRED") {
        setReplacementCount(result.existingRecordCount);
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.formError ?? null);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(false);
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
          Indonesian mock data
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Generate records</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Seeded generation keeps every run reproducible.
        </p>
      </div>

      {schemaEmpty ? (
        <p
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {EMPTY_SCHEMA_MESSAGE}
        </p>
      ) : null}

      {readOnly ? (
        <p className="mt-6 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Viewers can inspect generation status but cannot create datasets.
        </p>
      ) : null}

      {formError ? (
        <p
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <form className="mt-8 space-y-6" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium text-zinc-800"
              htmlFor="generation-count"
            >
              Number of records
            </label>
            <input
              aria-describedby={
                fieldErrors.count ? "generation-count-error" : undefined
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
              disabled={pending || readOnly}
              id="generation-count"
              inputMode="numeric"
              max={10_000}
              min={1}
              onChange={(event) => setCount(event.target.value)}
              type="number"
              value={count}
            />
            {fieldErrors.count ? (
              <p
                className="mt-2 text-sm text-red-700"
                id="generation-count-error"
              >
                {fieldErrors.count}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="text-sm font-medium text-zinc-800"
              htmlFor="generation-null-percentage"
            >
              Null percentage
            </label>
            <input
              aria-describedby="generation-null-help"
              className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
              disabled={pending || readOnly}
              id="generation-null-percentage"
              max={100}
              min={0}
              onChange={(event) => setNullPercentage(event.target.value)}
              type="number"
              value={nullPercentage}
            />
            <p className="mt-2 text-sm text-zinc-500" id="generation-null-help">
              {nullPercentage || "0"}% of optional values may be null.
            </p>
            {fieldErrors.nullPercentage ? (
              <p className="mt-2 text-sm text-red-700">
                {fieldErrors.nullPercentage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium text-zinc-800"
              htmlFor="generation-seed"
            >
              Seed
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
              disabled={pending || readOnly}
              id="generation-seed"
              onChange={(event) => setSeed(event.target.value)}
              placeholder="Created automatically when blank"
              type="text"
              value={seed}
            />
          </div>

          <div>
            <label
              className="text-sm font-medium text-zinc-800"
              htmlFor="generation-mode"
            >
              Generation mode
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-orange-500"
              disabled={pending || readOnly}
              id="generation-mode"
              onChange={(event) =>
                setMode(event.target.value as GenerationFormValues["mode"])
              }
              value={mode}
            >
              <option value="FAKER_ONLY">Seeded faker only</option>
              <option value="HYBRID_LLM">Hybrid LLM enrichment</option>
            </select>
            {mode === "HYBRID_LLM" ? (
              <p className="mt-2 text-sm text-blue-700">
                LLM enrichment may fall back to deterministic faker values.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            className="text-sm font-medium text-zinc-800"
            htmlFor="generation-endpoint"
          >
            Mock endpoint
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 font-mono text-sm text-zinc-500"
            id="generation-endpoint"
            readOnly
            value={endpoint}
          />
        </div>

        <button
          className="w-full rounded-xl bg-orange-500 px-5 py-3.5 font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={pending || schemaEmpty || readOnly}
          type="submit"
        >
          {pending ? "Starting generation..." : buttonLabel}
        </button>
      </form>

      {createdJob ? (
        <JobProgress
          jobId={createdJob.id}
          projectId={projectId}
          seed={createdJob.seed}
          onComplete={() => router.refresh()}
        />
      ) : null}

      {replacementCount !== null ? (
        <div
          aria-labelledby="replacement-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold" id="replacement-title">
              Replace existing records
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Replace {replacementCount} existing records? The current dataset
              remains available until generation completes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold"
                disabled={pending}
                onClick={() => setReplacementCount(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300"
                disabled={pending}
                onClick={() => void submit(true)}
                type="button"
              >
                {pending
                  ? "Starting generation..."
                  : `Replace ${replacementCount} Records`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
