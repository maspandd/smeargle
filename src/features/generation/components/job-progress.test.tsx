import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobProgress } from "./job-progress";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("job progress", () => {
  it("polls with backoff and stops after completion", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ jobId: "job-1", status: "RUNNING" }),
      )
      .mockResolvedValueOnce(
        Response.json({ jobId: "job-1", status: "COMPLETED" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<JobProgress jobId="job-1" projectId="project-1" seed="seed-123" />);

    expect(screen.getByRole("status")).toHaveTextContent("Generation queued");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Generating records");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Generation completed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("announces a failed job and stops polling", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ jobId: "job-1", status: "FAILED" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JobProgress jobId="job-1" projectId="project-1" seed="seed-123" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Generation failed. Your previous dataset was not changed.",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
