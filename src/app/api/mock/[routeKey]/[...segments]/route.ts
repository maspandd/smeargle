import { NextRequest } from "next/server";
import { resolveRuntimeContext } from "@/features/mock-runtime/runtime-context";
import { toJsonErrorResponse, MockRuntimeError } from "@/features/mock-runtime/runtime-error";
import { getRecords, getRecordById } from "@/features/mock-runtime/read-service";
import { createRecord, updateRecord, patchRecord, deleteRecord } from "@/features/mock-runtime/write-service";
import { toJsonSuccessResponse } from "@/features/mock-runtime/json-response";
import { enforceCors } from "@/features/mock-runtime/cors-policy";
import { PostgresRateLimitStore, checkRateLimit } from "@/features/mock-runtime/rate-limit";
import { verifyToken, hashToken } from "@/features/mock-runtime/token-auth";

const rateLimitStore = new PostgresRateLimitStore();

function applyCorsHeaders(response: Response, headers: Headers): Response {
  for (const [key, value] of headers.entries()) {
    response.headers.set(key, value);
  }
  return response;
}

type MockRouteParams = { params: Promise<{ routeKey: string; segments: string[] }> };

async function handleRuntimeRequest(
  request: NextRequest,
  params: { routeKey: string; segments: string[] }
) {
  let corsHeaders: Headers | undefined;
  let rateLimitHeaders: Headers | undefined;

  try {
    const context = await resolveRuntimeContext(params.routeKey, params.segments);
    
    // 1. CORS Policy
    const corsResult = enforceCors(request.headers, context.project.corsOrigins);
    corsHeaders = corsResult.headers;

    // OPTIONS preflight
    if (request.method === "OPTIONS") {
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
      const key = `${context.project.id}:options:${clientIp}`;
      const rl = await checkRateLimit(rateLimitStore, key, 1000);
      rateLimitHeaders = rl.headers;
      
      if (!rl.allowed) throw new MockRuntimeError("RATE_LIMITED", "Rate limit exceeded");
      if (!corsResult.allowed) throw new MockRuntimeError("FORBIDDEN", "CORS policy rejected");
      
      const response = new Response(null, { status: 204 });
      for (const [k, v] of rateLimitHeaders.entries()) response.headers.set(k, v);
      return applyCorsHeaders(response, corsHeaders);
    }

    if (!corsResult.allowed) {
      throw new MockRuntimeError("FORBIDDEN", "CORS policy rejected the request");
    }

    // 2. Token extraction
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    let tokenHashStr = "none";
    if (token) {
        tokenHashStr = await hashToken(token);
    }

    // 3. Rate Limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const keySuffix = token ? `token:${tokenHashStr}` : `ip:${clientIp}`;
    const rateLimitKey = `${context.project.id}:${keySuffix}`;
    const rlResult = await checkRateLimit(rateLimitStore, rateLimitKey, context.project.rateLimit);
    rateLimitHeaders = rlResult.headers;

    if (!rlResult.allowed) {
      throw new MockRuntimeError("RATE_LIMITED", "Rate limit exceeded");
    }

    // 4. Token Auth
    if (context.project.tokenRequired) {
      if (!token) {
        throw new MockRuntimeError("UNAUTHORIZED", "Missing Bearer token");
      }
      const isValid = await verifyToken(context.project.id, token);
      if (!isValid) {
        throw new MockRuntimeError("UNAUTHORIZED", "Invalid, expired, or revoked token");
      }
    }

    // Helper to wrap response
    const wrapResponse = (response: Response) => {
      if (rateLimitHeaders) {
        for (const [k, v] of rateLimitHeaders.entries()) response.headers.set(k, v);
      }
      if (corsHeaders) {
        applyCorsHeaders(response, corsHeaders);
      }
      return response;
    };

    // 5. Method Service
    if (request.method === "GET") {
      if (context.recordId) {
        const record = await getRecordById(context);
        return wrapResponse(toJsonSuccessResponse(record));
      } else {
        const result = await getRecords(context, request.nextUrl.searchParams);
        return wrapResponse(toJsonSuccessResponse(result.data, result.meta));
      }
    }
    
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        throw new MockRuntimeError("MALFORMED_REQUEST", "Invalid JSON body");
      }
      const newRecord = await createRecord(context, body);
      const resp = new Response(JSON.stringify({ data: newRecord }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
      return wrapResponse(resp);
    }
    
    if (request.method === "PUT") {
      if (!context.recordId) throw new MockRuntimeError("METHOD_DISABLED", "PUT requires a record ID");
      let body;
      try {
        body = await request.json();
      } catch {
        throw new MockRuntimeError("MALFORMED_REQUEST", "Invalid JSON body");
      }
      const updated = await updateRecord(context, context.recordId, body);
      return wrapResponse(toJsonSuccessResponse(updated));
    }
    
    if (request.method === "PATCH") {
      if (!context.recordId) throw new MockRuntimeError("METHOD_DISABLED", "PATCH requires a record ID");
      let body;
      try {
        body = await request.json();
      } catch {
        throw new MockRuntimeError("MALFORMED_REQUEST", "Invalid JSON body");
      }
      const patched = await patchRecord(context, context.recordId, body);
      return wrapResponse(toJsonSuccessResponse(patched));
    }
    
    if (request.method === "DELETE") {
      if (!context.recordId) throw new MockRuntimeError("METHOD_DISABLED", "DELETE requires a record ID");
      await deleteRecord(context, context.recordId);
      return wrapResponse(new Response(null, { status: 204 }));
    }

    throw new MockRuntimeError("METHOD_DISABLED", `Method ${request.method} is not implemented yet`);
  } catch (error) {
    const errorResponse = toJsonErrorResponse(error);
    if (rateLimitHeaders) {
      for (const [k, v] of rateLimitHeaders.entries()) errorResponse.headers.set(k, v);
    }
    if (corsHeaders) {
      applyCorsHeaders(errorResponse, corsHeaders);
    }
    return errorResponse;
  }
}

export async function GET(request: NextRequest, props: MockRouteParams) {
  const params = await props.params;
  return handleRuntimeRequest(request, params);
}

export async function POST(request: NextRequest, props: MockRouteParams) {
  const params = await props.params;
  return handleRuntimeRequest(request, params);
}

export async function PUT(request: NextRequest, props: MockRouteParams) {
  const params = await props.params;
  return handleRuntimeRequest(request, params);
}

export async function PATCH(request: NextRequest, props: MockRouteParams) {
  const params = await props.params;
  return handleRuntimeRequest(request, params);
}

export async function DELETE(request: NextRequest, props: MockRouteParams) {
  const params = await props.params;
  return handleRuntimeRequest(request, params);
}

export async function OPTIONS(request: NextRequest, props: MockRouteParams) {
  const params = await props.params;
  return handleRuntimeRequest(request, params);
}
