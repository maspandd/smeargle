"use client";

import type { GenerationStatus } from "@prisma/client";
import { useEffect, useState } from "react";

type JobProgressProps = {
  jobId: string;
  projectId: string;
  seed: string;
  onComplete?: () => void;
};

type JobStatusResponse = {
  jobId: string;
  status: GenerationStatus;
  warningSummary?: {
    fallback?: number;
  } | null;
};

const terminalStatuses = new Set<GenerationStatus>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export function JobProgress({ jobId, projectId, seed, onComplete }: JobProgressProps) {
  const [status, setStatus] = useState<GenerationStatus>("PENDING");
  const [pollError, setPollError] = useState(false);
  const [warningSummary, setWarningSummary] = useState<{ fallback?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function poll(delayMs: number) {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/generation-jobs/${jobId}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Unable to read generation status");
        }

        const result = (await response.json()) as JobStatusResponse;
        if (cancelled) return;

        setPollError(false);
        setStatus(result.status);
        if (result.warningSummary) {
          setWarningSummary(result.warningSummary);
        }

        if (terminalStatuses.has(result.status)) {
          if (result.status === "COMPLETED") {
            if (onComplete) {
              onComplete();
            } else {
              window.location.reload();
            }
          }
          return;
        }
      } catch {
        if (cancelled) return;
        setPollError(true);
      }

      timeout = setTimeout(
        () => void poll(Math.min(Math.round(delayMs * 1.5), 5_000)),
        delayMs,
      );
    }

    void poll(1_000);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [jobId, projectId, onComplete]);

  const isFailure = status === "FAILED" || status === "CANCELLED";
  const message =
    status === "RUNNING"
      ? "Generating records"
      : status === "COMPLETED"
        ? "Generation completed"
        : status === "FAILED"
          ? "Generation failed. Your previous dataset was not changed."
          : status === "CANCELLED"
            ? "Generation was cancelled. Your previous dataset was not changed."
            : "Generation queued";

  return (
    <div className="mt-6 border-t border-dashed border-zinc-300 pt-6">
      <p
        aria-live="polite"
        className={
          isFailure
            ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            : "rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"
        }
        role={isFailure ? "alert" : "status"}
      >
        {message}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Reproducible seed: <span className="font-mono">{seed}</span>
      </p>
      {warningSummary?.fallback ? (
        <p className="mt-2 text-xs text-amber-700">
          Used fallback faker generation for {warningSummary.fallback} records.
        </p>
      ) : null}
      {pollError ? (
        <p className="mt-2 text-xs text-amber-700">
          Status is temporarily unavailable. Retrying automatically.
        </p>
      ) : null}
    </div>
  );
}
