// Module-level sync coordination state. Deliberately NOT persisted: it only
// describes network operations in flight during the current page session.

// itemId -> number of writes in flight for that record.
const pendingWrites = new Map<string, number>();

export function beginWrite(id: string) {
    pendingWrites.set(id, (pendingWrites.get(id) || 0) + 1);
}

export function endWrite(id: string) {
    const count = pendingWrites.get(id) || 0;
    if (count <= 1) pendingWrites.delete(id);
    else pendingWrites.set(id, count - 1);
}

export function hasPendingWrite(id: string): boolean {
    return pendingWrites.has(id);
}

// Temp ("local_") ids whose create request is currently in flight, so the
// reconnect push doesn't create them a second time.
export const pendingCreates = new Set<string>();

export function parsePbDate(s: string | undefined | null): number {
    if (!s) return 0;
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
}

// A realtime update event must be ignored when we have our own write in
// flight for the record (our optimistic state is newer and the in-flight
// write will supersede the event) or when the event's server timestamp is
// not newer than the version we already applied (stale/out-of-order event).
export function shouldSkipRemoteUpdate(
    id: string,
    recordUpdated: string | undefined,
    knownServerUpdated: number | undefined
): boolean {
    if (hasPendingWrite(id)) return true;
    const incoming = parsePbDate(recordUpdated);
    return incoming > 0 && knownServerUpdated !== undefined && incoming <= knownServerUpdated;
}
