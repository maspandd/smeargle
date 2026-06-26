import { describe, expect, it, beforeEach } from "vitest";
import { GET } from "@/app/api/mock/[routeKey]/[...segments]/route";
import { prisma } from "@/lib/db";
import { resetDatabase } from "../helpers/database";
import { NextRequest } from "next/server";
import { performance } from "node:perf_hooks";

describe("Mock API Performance", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("handles GET collection under load with p95 < 200ms", async () => {
    // 1. Seed 1000 records
    const project = await prisma.project.create({
      data: { name: "Load Test", baseEndpoint: "/api/items", routeKey: "load_key", tokenRequired: false },
    });
    const schema = await prisma.schemaVersion.create({
      data: { projectId: project.id, major: 1, minor: 0, versionLabel: "v1", changeSummary: "Init", snapshot: { fields: [] } },
    });

    const records = Array.from({ length: 1000 }, (_, i) => ({
      projectId: project.id,
      schemaVersionId: schema.id,
      ordinal: i,
      source: "GENERATED" as const,
      value: { id: `id-${i}`, name: `Item ${i}`, price: i * 10 },
    }));
    await prisma.mockRecord.createMany({ data: records });

    // 2. Warm up
    const warmReq = new NextRequest("http://localhost:3000/api/mock/load_key/items?page=1&pageSize=100", { method: "GET" });
    await GET(warmReq, { params: Promise.resolve({ routeKey: "load_key", segments: ["items"] }) });

    // 3. Execute concurrently
    const CONCURRENCY = 20;
    const TOTAL_REQUESTS = 100;
    const latencies: number[] = [];

    const makeRequest = async (i: number) => {
      const page = (i % 10) + 1; // 1 to 10
      const start = performance.now();
      const req = new NextRequest(`http://localhost:3000/api/mock/load_key/items?page=${page}&pageSize=100`, { method: "GET" });
      const res = await GET(req, { params: Promise.resolve({ routeKey: "load_key", segments: ["items"] }) });
      const end = performance.now();
      
      expect(res.status).toBe(200);
      latencies.push(end - start);
    };

    // Process in batches
    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
      const batch = Array.from({ length: CONCURRENCY }, (_, j) => makeRequest(i + j));
      await Promise.all(batch);
    }

    // 4. Calculate metrics
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95 = latencies[p95Index];
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log(`[Load Test] Total: ${TOTAL_REQUESTS} req, p95: ${p95.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    // Assert p95 < 200ms
    expect(p95).toBeLessThan(200);
  });
});
