import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, RateLimitStore } from "./rate-limit";

class MemoryRateLimitStore implements RateLimitStore {
  private counts = new Map<string, { count: number, expiresAt: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number, expiresAt: number }> {
    const now = Date.now();
    const record = this.counts.get(key);
    
    if (!record || record.expiresAt < now) {
      const newRecord = { count: 1, expiresAt: now + windowMs };
      this.counts.set(key, newRecord);
      return newRecord;
    }
    
    record.count += 1;
    return record;
  }
}

describe("Rate Limit", () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scopes limits by route key plus token hash or client IP", async () => {
    const key1 = "route1:ip:127.0.0.1";
    const key2 = "route1:token:abc";
    
    const res1 = await checkRateLimit(store, key1, 100);
    const res2 = await checkRateLimit(store, key2, 100);
    
    expect(res1.remaining).toBe(99);
    expect(res2.remaining).toBe(99);
  });

  it("includes standard limit/remaining/reset headers", async () => {
    const res = await checkRateLimit(store, "test", 10);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(res.headers.has("X-RateLimit-Reset")).toBe(true);
  });

  it("returns 429 after threshold", async () => {
    await checkRateLimit(store, "test", 2); // 1
    await checkRateLimit(store, "test", 2); // 2
    
    const res = await checkRateLimit(store, "test", 2); // 3 (exceeded)
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it("recovers after the window", async () => {
    await checkRateLimit(store, "test", 1); // 1
    const blocked = await checkRateLimit(store, "test", 1); // 2
    expect(blocked.allowed).toBe(false);

    // Fast forward 1 minute
    vi.advanceTimersByTime(60001);

    const recovered = await checkRateLimit(store, "test", 1);
    expect(recovered.allowed).toBe(true);
    expect(recovered.remaining).toBe(0);
  });
});
