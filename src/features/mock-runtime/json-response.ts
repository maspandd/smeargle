export function toJsonSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      data,
      ...(meta ? { meta } : {}),
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
