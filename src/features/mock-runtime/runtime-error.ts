export type MockRuntimeErrorCode =
  | "PROJECT_NOT_FOUND"
  | "RESOURCE_NOT_FOUND"
  | "RECORD_NOT_FOUND"
  | "METHOD_DISABLED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class MockRuntimeError extends Error {
  constructor(
    public readonly code: MockRuntimeErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MockRuntimeError";
  }
}

export function toJsonErrorResponse(error: unknown, requestId?: string): Response {
  let code: MockRuntimeErrorCode = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let details: unknown = undefined;
  let status = 500;

  if (error instanceof MockRuntimeError) {
    code = error.code;
    message = error.message;
    details = error.details;

    switch (code) {
      case "PROJECT_NOT_FOUND":
      case "RESOURCE_NOT_FOUND":
      case "RECORD_NOT_FOUND":
        status = 404;
        break;
      case "METHOD_DISABLED":
        status = 405;
        break;
      case "UNAUTHORIZED":
        status = 401;
        break;
      case "FORBIDDEN":
        status = 403;
        break;
      case "VALIDATION_ERROR":
        status = 422;
        break;
      case "CONFLICT":
        status = 409;
        break;
      case "RATE_LIMITED":
        status = 429;
        break;
      case "INTERNAL_ERROR":
      default:
        status = 500;
        break;
    }
  }

  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      requestId: requestId ?? "unknown",
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
