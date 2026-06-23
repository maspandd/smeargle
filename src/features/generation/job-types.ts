export type GenerationRequest = {
  projectId: string;
  schemaVersionId: string;
  count: number;
  seed: string;
  nullRate: number;
  mode: "FAKER_ONLY" | "HYBRID_LLM";
};
