export interface CorsResult {
  allowed: boolean;
  headers: Headers;
}

export function enforceCors(requestHeaders: Headers, configuredOrigins: string[]): CorsResult {
  const headers = new Headers();
  headers.set("Vary", "Origin");

  const origin = requestHeaders.get("origin");

  // If there's no Origin header, it's either same-origin or not a browser request. Allowed.
  if (!origin) {
    return { allowed: true, headers };
  }

  const isWildcard = configuredOrigins.includes("*");
  const isExactMatch = configuredOrigins.includes(origin);

  if (!isWildcard && !isExactMatch) {
    return { allowed: false, headers };
  }

  headers.set("Access-Control-Allow-Origin", isWildcard ? "*" : origin);
  
  // Handle OPTIONS preflight
  const requestMethod = requestHeaders.get("access-control-request-method");
  if (requestMethod) {
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  const requestHeadersList = requestHeaders.get("access-control-request-headers");
  if (requestHeadersList) {
    headers.set("Access-Control-Allow-Headers", requestHeadersList);
  }

  return { allowed: true, headers };
}
