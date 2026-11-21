import type { SyncNotifier } from './sync-notifier';

// What the routes need from the change announcer; the Worker uses the Durable Object and
// the tests use memory.
export interface ChangeNotifier {
  bump(userId: string, seq: number): Promise<void>;
  version(userId: string): Promise<number>;
}

export function durableNotifier(namespace: DurableObjectNamespace<SyncNotifier>): ChangeNotifier {
  return {
    bump: (userId, seq) => namespace.getByName(userId).bump(seq),
    version: (userId) => namespace.getByName(userId).version(),
  };
}

export function memoryNotifier(): ChangeNotifier {
  const versions = new Map<string, number>();
  return {
    bump(userId, seq) {
      versions.set(userId, Math.max(versions.get(userId) ?? 0, seq));
      return Promise.resolve();
    },
    version: (userId) => Promise.resolve(versions.get(userId) ?? 0),
  };
}

// After a push has committed. One retry; if both fail the push still stands, and the
// other device finds the change on its next pull.
export async function announce(notifier: ChangeNotifier, userId: string, seq: number) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await notifier.bump(userId, seq);
      return;
    } catch (error) {
      if (attempt === 2) {
        console.error('Sync notify failed', error instanceof Error ? error.message : '');
      }
    }
  }
}
