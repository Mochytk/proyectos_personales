// Candidate multilingual embedding models (ONNX weights for transformers.js).
// Chosen by the golden set, not by popularity. Licenses are re-read from Hugging Face at download.

export interface ModelSpec {
  id: string;
  repo: string;
  dtype: 'q8' | 'fp32';
  queryPrefix: string;
  passagePrefix: string;
  note: string;
}

export const MODELS: ModelSpec[] = [
  {
    id: 'e5-small',
    repo: 'Xenova/multilingual-e5-small',
    dtype: 'q8',
    queryPrefix: 'query: ',
    passagePrefix: 'passage: ',
    note: '118M parámetros, 384 dimensiones; ONNX de intfloat/multilingual-e5-small',
  },
  {
    id: 'minilm-l12',
    repo: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    dtype: 'q8',
    queryPrefix: '',
    passagePrefix: '',
    note: '118M parámetros, 384 dimensiones; sentence-transformers',
  },
];

// Heavier or with licenses to review before adopting; only run with --extra.
export const EXTRA_MODELS: ModelSpec[] = [
  {
    id: 'bge-m3',
    repo: 'Xenova/bge-m3',
    dtype: 'q8',
    queryPrefix: '',
    passagePrefix: '',
    note: '568M parámetros, 1024 dimensiones; más lento y pesado para 8 GB',
  },
  {
    id: 'embeddinggemma',
    repo: 'onnx-community/embeddinggemma-300m-ONNX',
    dtype: 'fp32',
    queryPrefix: 'task: search result | query: ',
    passagePrefix: 'title: none | text: ',
    note: '300M parámetros, 768 dimensiones; licencia Gemma (términos propios de Google)',
  },
];

export function filesFor(spec: ModelSpec): string[] {
  const weights = spec.dtype === 'q8' ? 'onnx/model_quantized.onnx' : 'onnx/model.onnx';
  return ['config.json', 'tokenizer.json', 'tokenizer_config.json', weights];
}
