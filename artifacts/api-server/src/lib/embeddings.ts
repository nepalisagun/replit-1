import { pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeatureExtractionPipeline = any;

let extractor: FeatureExtractionPipeline | null = null;
let loading: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;
  if (loading) return loading;
  loading = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  }).then((pipe: FeatureExtractionPipeline) => {
    extractor = pipe;
    loading = null;
    return pipe;
  });
  return loading;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const pipe = await getExtractor();
  const output = await pipe(text.slice(0, 512), { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export function vectorToSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
