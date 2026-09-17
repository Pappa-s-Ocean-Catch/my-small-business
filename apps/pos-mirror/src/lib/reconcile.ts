import {
  isEmptyMirrorOrder,
  parseMirrorOrderSnapshot,
  type MirrorOrderSnapshotV1,
} from '@my-small-business/pos-mirror';

export function reconcileSnapshot(
  current: MirrorOrderSnapshotV1 | null,
  incoming: unknown,
): MirrorOrderSnapshotV1 | null {
  if (isEmptyMirrorOrder(incoming)) return null;

  const parsed = parseMirrorOrderSnapshot(incoming);
  if (!parsed) return current;
  if (!current) return parsed;

  return Date.parse(parsed.updatedAt) >= Date.parse(current.updatedAt) ? parsed : current;
}
