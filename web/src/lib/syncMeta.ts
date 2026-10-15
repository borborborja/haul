// Module-level sync coordination state. Deliberately NOT persisted: it only
// describes network operations in flight during the current page session.

// Tokens let an old server's finally block finish harmlessly after a reset.
const pendingWrites = new Map<string, Set<number>>();
let nextWriteToken = 0;

export function beginWrite(id: string): number {
    const token = ++nextWriteToken;
    const tokens = pendingWrites.get(id) ?? new Set<number>();
    tokens.add(token);
    pendingWrites.set(id, tokens);
    return token;
}

export function endWrite(id: string, token?: number) {
    const tokens = pendingWrites.get(id);
    if (!tokens) return;
    const completed = token ?? tokens.values().next().value;
    if (completed !== undefined) tokens.delete(completed);
    if (tokens.size === 0) pendingWrites.delete(id);
}

export function resetSyncMeta() {
    pendingWrites.clear();
    pendingCreates.clear();
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
