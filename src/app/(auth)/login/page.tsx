"use client";

import { useActionState } from "react";
import { initialLoginState, loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialLoginState,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <form action={formAction} className="w-full space-y-5" noValidate>
        <div>
          <p className="text-sm font-semibold text-blue-600">Smeargle</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
            Log in to your account
          </h1>
        </div>

        {state.formError ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {state.formError}
          </p>
        ) : null}

        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="email">
            Email
          </label>
          <input
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            id="email"
            name="email"
            type="email"
          />
          {state.fieldErrors?.email ? (
            <p className="mt-1 text-sm text-red-700" id="email-error">
              {state.fieldErrors.email[0]}
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="password">
            Password
          </label>
          <input
            aria-describedby={
              state.fieldErrors?.password ? "password-error" : undefined
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            id="password"
            name="password"
            type="password"
          />
          {state.fieldErrors?.password ? (
            <p className="mt-1 text-sm text-red-700" id="password-error">
              {state.fieldErrors.password[0]}
            </p>
          ) : null}
        </div>

        <button
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
