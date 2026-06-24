import { NextRequest } from "next/server";
import { resolveRuntimeContext } from "@/features/mock-runtime/runtime-context";
import { toJsonErrorResponse, MockRuntimeError } from "@/features/mock-runtime/runtime-error";
import { getRecords, getRecordById } from "@/features/mock-runtime/read-service";
import { createRecord, updateRecord, patchRecord, deleteRecord } from "@/features/mock-runtime/write-service";
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
    
    if (request.method === "PUT") {
      if (!context.recordId) throw new MockRuntimeError("METHOD_DISABLED", "PUT requires a record ID");
      let body;
      try {
        body = await request.json();
      } catch (_e) {
        throw new MockRuntimeError("MALFORMED_REQUEST", "Invalid JSON body");
      }
      const updated = await updateRecord(context, context.recordId, body);
      return toJsonSuccessResponse(updated);
    }
    
    if (request.method === "PATCH") {
      if (!context.recordId) throw new MockRuntimeError("METHOD_DISABLED", "PATCH requires a record ID");
      let body;
      try {
        body = await request.json();
      } catch (_e) {
        throw new MockRuntimeError("MALFORMED_REQUEST", "Invalid JSON body");
      }
      const patched = await patchRecord(context, context.recordId, body);
      return toJsonSuccessResponse(patched);
    }
    
    if (request.method === "DELETE") {
      if (!context.recordId) throw new MockRuntimeError("METHOD_DISABLED", "DELETE requires a record ID");
      await deleteRecord(context, context.recordId);
      return new Response(null, { status: 204 });
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
