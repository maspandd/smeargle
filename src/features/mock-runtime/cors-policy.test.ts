import { describe, expect, it } from "vitest";
import { enforceCors } from "./cors-policy";

describe("CORS Policy", () => {
  it("allows no Origin (same-origin or non-browser)", () => {
    const headers = new Headers();
    const result = enforceCors(headers, ["*"]);
    expect(result.allowed).toBe(true);
    expect(result.headers.get("Vary")).toBe("Origin");
  });

  it("allows explicit wildcard", () => {
    const headers = new Headers({ origin: "http://example.com" });
    const result = enforceCors(headers, ["*"]);
    expect(result.allowed).toBe(true);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("allows exact configured origins and returns matching headers", () => {
    const headers = new Headers({ origin: "http://example.com" });
    const result = enforceCors(headers, ["http://example.com", "http://another.com"]);
    expect(result.allowed).toBe(true);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
    expect(result.headers.get("Vary")).toBe("Origin");
  });

  it("rejects unlisted origins with 403 equivalents", () => {
    const headers = new Headers({ origin: "http://hacker.com" });
    const result = enforceCors(headers, ["http://example.com"]);
    expect(result.allowed).toBe(false);
  });

  it("handles OPTIONS request with allowed methods and headers", () => {
    const headers = new Headers({
        origin: "http://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type"
    });
    
    const result = enforceCors(headers, ["http://example.com"]);
    expect(result.allowed).toBe(true);
    expect(result.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(result.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
  });
});
