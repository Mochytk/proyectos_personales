// transformers.js (ONNX Runtime) loaded only from local, verified files: no remote downloads at runtime.
import type { ModelSpec } from './models.ts';

export interface Embedder {
  name: string;
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
}

interface Tensor {
  data: Float32Array;
  dims: number[];
}

type Extractor = (texts: string[], options: { pooling: 'mean'; normalize: boolean }) => Promise<Tensor>;

export async function transformersEmbedder(spec: ModelSpec, modelsDir: string): Promise<Embedder> {
  const transformers = await import('@huggingface/transformers');
  transformers.env.localModelPath = `${modelsDir}/`;
  transformers.env.allowRemoteModels = false;
  transformers.env.allowLocalModels = true;
  const extractor = (await transformers.pipeline('feature-extraction', spec.repo, {
    dtype: spec.dtype,
  })) as unknown as Extractor;
  return {
    name: spec.id,
    async embed(texts, kind) {
      const prefix = kind === 'query' ? spec.queryPrefix : spec.passagePrefix;
      const out: Float32Array[] = [];
      for (let start = 0; start < texts.length; start += 16) {
        const batch = texts.slice(start, start + 16).map((text) => prefix + text);
        const tensor = await extractor(batch, { pooling: 'mean', normalize: true });
        const dims = tensor.dims[1] ?? 0;
        for (let row = 0; row < batch.length; row += 1) out.push(tensor.data.slice(row * dims, (row + 1) * dims));
      }
      return out;
    },
  };
}
