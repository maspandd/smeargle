export type SemanticType = "email";

export type EnrichmentItem = {
  recordOrdinal: number;
  fieldId: string;
  semanticType: SemanticType;
  constraints: {
    required: boolean;
  };
  neighboringValues: Record<string, unknown>;
};

export type EnrichmentBatch = {
  locale: "id-ID";
  items: EnrichmentItem[];
};

export type EnrichmentValue = {
  recordOrdinal: number;
  fieldId: string;
  value: unknown;
};

export type EnrichmentResult = {
  values: EnrichmentValue[];
};

export interface LlmProvider {
  enrich(
    request: EnrichmentBatch,
    signal: AbortSignal,
  ): Promise<EnrichmentResult>;
}

export class LlmProviderError extends Error {
  readonly code: string;
  readonly transient: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      transient: boolean;
    },
  ) {
    super(message);
    this.name = "LlmProviderError";
    this.code = options.code;
    this.transient = options.transient;
  }
}
