// Brute-force cosine search over normalized vectors. 10,000 notes x 384 dims is ~15 MB of floats.

export class VectorIndex {
  private readonly ids: string[] = [];
  private readonly vectors: Float32Array[] = [];

  add(id: string, vector: Float32Array): void {
    this.ids.push(id);
    this.vectors.push(vector);
  }

  search(query: Float32Array, k: number): string[] {
    const scored = this.vectors.map((vector, index) => {
      let dot = 0;
      for (let i = 0; i < vector.length; i += 1) dot += (vector[i] ?? 0) * (query[i] ?? 0);
      return [index, dot] as const;
    });
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, k).map(([index]) => this.ids[index] ?? '');
  }
}
