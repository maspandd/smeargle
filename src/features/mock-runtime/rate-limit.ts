import { prisma } from "@/lib/db";

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number, expiresAt: number }>;
}

export class PostgresRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number): Promise<{ count: number, expiresAt: number }> {
    const now = new Date();
    
    // First, try to update if it exists and hasn't expired
    const updated = await prisma.rateLimit.updateMany({
      where: {
        key,
        expiresAt: { gt: now }
      },
      data: {
        count: { increment: 1 }
      }
    });

    if (updated.count > 0) {
      const record = await prisma.rateLimit.findUnique({ where: { key } });
      if (record) return { count: record.count, expiresAt: record.expiresAt.getTime() };
    }

    // Either didn't exist, or was expired. Upsert it with count 1
    const expiresAt = new Date(now.getTime() + windowMs);
    const upserted = await prisma.rateLimit.upsert({
      where: { key },
      update: {
        count: 1,
        expiresAt
      },
      create: {
        key,
        count: 1,
        expiresAt
      }
    });

    // Cleanup old records occasionally (e.g. 10% probability or run a cron job)
    if (Math.random() < 0.1) {
      // Best effort background cleanup
      prisma.rateLimit.deleteMany({
        where: { expiresAt: { lt: now } }
      }).catch(() => {});
    }

    return { count: upserted.count, expiresAt: upserted.expiresAt.getTime() };
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  headers: Headers;
}

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const { count, expiresAt } = await store.increment(key, windowMs);
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;

  const headers = new Headers();
  headers.set("X-RateLimit-Limit", limit.toString());
  headers.set("X-RateLimit-Remaining", remaining.toString());
  headers.set("X-RateLimit-Reset", Math.floor(expiresAt / 1000).toString());

  return { allowed, remaining, headers };
}
