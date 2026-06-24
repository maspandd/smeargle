import { NextRequest } from "next/server";
import { resolveRuntimeContext } from "@/features/mock-runtime/runtime-context";
import { toJsonErrorResponse, MockRuntimeError } from "@/features/mock-runtime/runtime-error";
import { getRecords, getRecordById } from "@/features/mock-runtime/read-service";
import { createRecord } from "@/features/mock-runtime/write-service";
import { toJsonSuccessResponse } from "@/features/mock-runtime/json-response";

type MockRouteParams = { params: Promise<{ routeKey: string; segments: string[] }> };

async function handleRuntimeRequest(
  request: NextRequest,
  params: { routeKey: string; segments: string[] }
) {
  try {
    const context = await resolveRuntimeContext(params.routeKey, params.segments);
    
    if (request.method === "GET") {
      if (context.recordId) {
        const record = await getRecordById(context);
        return toJsonSuccessResponse(record);
      } else {
        const result = await getRecords(context, request.nextUrl.searchParams);
        return toJsonSuccessResponse(result.data, result.meta);
      }
    }
    
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (_e) {
        throw new MockRuntimeError("MALFORMED_REQUEST", "Invalid JSON body");
      }
      const newRecord = await createRecord(context, body);
      return new Response(JSON.stringify({ data: newRecord }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Reject other methods for now
    throw new MockRuntimeError("METHOD_DISABLED", `Method ${request.method} is not implemented yet`);
  } catch (error) {
    return toJsonErrorResponse(error);
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
