"use client";

import { FormEvent, useRef, useState } from "react";
import {
  createProjectInput,
  type CreateProjectInput,
} from "../project-schema";

type CreateProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateProjectInput) => Promise<void>;
};

type FieldErrors = Partial<Record<keyof CreateProjectInput, string[]>>;

export function CreateProjectDialog({
  open,
  onClose,
  onSubmit,
}: CreateProjectDialogProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const endpointRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = createProjectInput.safeParse({
      name: formData.get("name"),
      baseEndpoint: formData.get("baseEndpoint"),
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(fieldErrors);
      if (fieldErrors.name) nameRef.current?.focus();
      else endpointRef.current?.focus();
      return;
    }

    setErrors({});
    setPending(true);
    try {
      await onSubmit(result.data);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <button
        aria-label="Dismiss create project dialog"
        className="absolute inset-0 bg-zinc-950/45"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="create-project-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <h2 className="text-xl font-semibold text-zinc-950" id="create-project-title">
          Create a mock API
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Start with a project name and the endpoint your frontend expects.
        </p>

        <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-zinc-800" htmlFor="project-name">
              Project name
            </label>
            <input
              aria-describedby={errors.name ? "project-name-error" : undefined}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="project-name"
              name="name"
              ref={nameRef}
            />
            {errors.name ? (
              <p className="mt-1 text-sm text-red-700" id="project-name-error">
                {errors.name[0]}
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-800" htmlFor="base-endpoint">
              Base endpoint
            </label>
            <input
              aria-describedby={
                errors.baseEndpoint ? "base-endpoint-error" : undefined
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="base-endpoint"
              name="baseEndpoint"
              placeholder="/api/products"
              ref={endpointRef}
            />
            {errors.baseEndpoint ? (
              <p className="mt-1 text-sm text-red-700" id="base-endpoint-error">
                {errors.baseEndpoint[0]}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving..." : "Save Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
