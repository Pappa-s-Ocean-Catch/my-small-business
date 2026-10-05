import { isEmptyMirrorOrder, parseMirrorOrderSnapshot, type MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';

export type MirrorStateRow = { register_id: string; current_order: unknown };
type RegisterState = { snapshot: MirrorOrderSnapshotV1 | null; revision: number; firstSeen: number; updatedAt: number };

/** One register owns the display until its cart clears. Waiting carts retain only their latest state. */
export class MirrorSession {
  private registers = new Map<string, RegisterState>();
  private owner: string | null = null;
  revision = 0;

  constructor(private readonly now: () => number = Date.now) {}

  get registerId() { return this.owner; }
  get snapshot() { return this.owner ? this.registers.get(this.owner)?.snapshot ?? null : null; }

  apply(registerId: string, incoming: unknown) {
    this.update(registerId, incoming);
    this.expire();
  }

  /** Only replace rows untouched since the request began, including rows missing from the response. */
  refresh(rows: readonly MirrorStateRow[], startedAtRevision: number) {
    const present = new Set(rows.map(row => row.register_id));
    for (const [id, state] of this.registers) {
      if (!present.has(id) && state.revision <= startedAtRevision) this.update(id, {});
    }
    const ordered = [...rows].sort((a, b) => {
      const left = parseMirrorOrderSnapshot(a.current_order);
      const right = parseMirrorOrderSnapshot(b.current_order);
      return (left ? Date.parse(left.updatedAt) : Infinity) - (right ? Date.parse(right.updatedAt) : Infinity)
        || a.register_id.localeCompare(b.register_id);
    });
    for (const row of ordered) {
      if ((this.registers.get(row.register_id)?.revision ?? 0) <= startedAtRevision) {
        this.update(row.register_id, row.current_order);
      }
    }
    this.expire();
  }

  private update(id: string, incoming: unknown) {
    if (!id.trim()) return;
    const previous = this.registers.get(id);
    const snapshot = isEmptyMirrorOrder(incoming) ? null : parseMirrorOrderSnapshot(incoming);
    if (!snapshot && !isEmptyMirrorOrder(incoming)) return;
    const updatedAt = snapshot ? Date.parse(snapshot.updatedAt) : previous?.updatedAt ?? 0;
    // Retain the timestamp after clearing, so old payloads cannot revive the finished cart.
    if (snapshot && previous && updatedAt <= previous.updatedAt) {
      previous.revision = ++this.revision;
      return;
    }
    const revision = ++this.revision;
    this.registers.set(id, {
      snapshot, revision, updatedAt,
      firstSeen: previous?.snapshot ? previous.firstSeen : revision,
    });
  }

  /** Runs independently of network success, retaining timestamp watermarks for expired carts. */
  expire() {
    const now = this.now();
    for (const state of this.registers.values()) {
      if (state.snapshot && now - state.updatedAt > 5 * 60 * 1000) {
        state.snapshot = null;
        state.revision = ++this.revision;
      }
    }
    this.selectOwner();
  }

  private selectOwner() {
    if (this.owner && this.registers.get(this.owner)?.snapshot) return;
    this.owner = [...this.registers.entries()]
      .filter(([, state]) => state.snapshot)
      .sort((a, b) => a[1].firstSeen - b[1].firstSeen)[0]?.[0] ?? null;
  }
}
