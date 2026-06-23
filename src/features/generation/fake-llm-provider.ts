import type {
  EnrichmentBatch,
  EnrichmentResult,
  LlmProvider,
} from "./llm-provider";

type FakeHandler = (
  request: EnrichmentBatch,
  signal: AbortSignal,
) => Promise<EnrichmentResult>;

export class FakeLlmProvider implements LlmProvider {
  readonly requests: EnrichmentBatch[] = [];

  constructor(private readonly handler: FakeHandler) {}

  async enrich(
    request: EnrichmentBatch,
    signal: AbortSignal,
  ): Promise<EnrichmentResult> {
    this.requests.push(structuredClone(request));
    return this.handler(request, signal);
  }
}
