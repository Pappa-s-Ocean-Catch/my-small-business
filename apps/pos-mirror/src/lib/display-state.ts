import type { CustomerQueueEntry, MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';
import type { IdleMode } from './mirror-settings';

export type DisplayState =
  | { kind: 'cart'; snapshot: MirrorOrderSnapshotV1 }
  | { kind: 'queue'; orders: CustomerQueueEntry[] }
  | { kind: 'image' };

export function selectDisplayState(
  snapshot: MirrorOrderSnapshotV1 | null,
  idleMode: IdleMode,
  queue: CustomerQueueEntry[],
): DisplayState {
  if (snapshot) return { kind: 'cart', snapshot };
  if (idleMode === 'queue' && queue.length > 0) return { kind: 'queue', orders: queue };
  return { kind: 'image' };
}
