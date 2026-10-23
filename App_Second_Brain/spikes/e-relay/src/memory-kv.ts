// In-memory stand-in for a Workers KV namespace, with counters for the tests.
import { utf8 } from './bytes.ts';

export interface KVLike {
  get(key: string): Promise<string | null>;
  getBytes(key: string): Promise<{ value: Uint8Array<ArrayBuffer>; metadata: Record<string, unknown> | null } | null>;
  put(
    key: string,
    value: string | Uint8Array<ArrayBuffer>,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<{ name: string; metadata: Record<string, unknown> | null }[]>;
}

interface Entry {
  value: Uint8Array<ArrayBuffer>;
  metadata: Record<string, unknown> | null;
  ttl: number | undefined;
}

export class MemoryKV implements KVLike {
  private readonly entries = new Map<string, Entry>();
  writes = 0;

  get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    return Promise.resolve(entry ? new TextDecoder().decode(entry.value) : null);
  }

  getBytes(key: string) {
    const entry = this.entries.get(key);
    return Promise.resolve(entry ? { value: entry.value, metadata: entry.metadata } : null);
  }

  put(
    key: string,
    value: string | Uint8Array<ArrayBuffer>,
    options: { expirationTtl?: number; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    this.writes += 1;
    const bytes = typeof value === 'string' ? utf8(value) : value;
    this.entries.set(key, { value: bytes, metadata: options.metadata ?? null, ttl: options.expirationTtl });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  list(prefix: string) {
    return Promise.resolve(
      [...this.entries]
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, entry]) => ({ name, metadata: entry.metadata })),
    );
  }

  ttlOf(key: string): number | undefined {
    return this.entries.get(key)?.ttl;
  }

  /** Every stored value and metadata as bytes, to search for leaked plaintext. */
  *allBytes(): Iterable<Uint8Array> {
    for (const [name, entry] of this.entries) {
      yield utf8(name);
      yield entry.value;
      yield utf8(JSON.stringify(entry.metadata));
    }
  }
}
