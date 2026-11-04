import { DurableObject } from 'cloudflare:workers';

const KEY = 'version';

// One per user (ADR 0006): remembers the user's highest server_seq, so a device can ask
// "anything new?" every 15 s without waking Neon. SQLite-backed, as the free plan needs;
// the synchronous KV API keeps the read-modify-write in a single turn.
export class SyncNotifier extends DurableObject<Env> {
  bump(seq: number): Promise<void> {
    const current = this.ctx.storage.kv.get<number>(KEY) ?? 0;
    if (seq > current) this.ctx.storage.kv.put(KEY, seq);
    return Promise.resolve();
  }

  version(): Promise<number> {
    return Promise.resolve(this.ctx.storage.kv.get<number>(KEY) ?? 0);
  }
}
