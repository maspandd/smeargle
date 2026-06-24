import { NextRequest } from "next/server";
import { resolveRuntimeContext } from "@/features/mock-runtime/runtime-context";
import { toJsonErrorResponse, MockRuntimeError } from "@/features/mock-runtime/runtime-error";

type MockRouteParams = { params: Promise<{ routeKey: string; segments: string[] }> };

async function handleRuntimeRequest(
  request: NextRequest,
  params: { routeKey: string; segments: string[] }
) {
  try {
    const context = await resolveRuntimeContext(params.routeKey, params.segments);
    
    // For now we just reject as METHOD_DISABLED since handlers aren't implemented yet
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
