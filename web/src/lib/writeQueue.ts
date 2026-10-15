// Generic per-record write queue with coalescing and retry/backoff.
// Pure (no app imports) so it can be unit tested; the app wires a concrete
// instance in itemWriteQueue.ts.

export interface WriteOp {
    collection: string;
    recordId: string;
    kind: 'update' | 'delete';
    body?: Record<string, unknown>;
    attempts: number;
}

export interface WriteQueue {
    enqueueUpdate(collection: string, recordId: string, body: Record<string, unknown>): void;
    enqueueDelete(collection: string, recordId: string): void;
    flush(): void;
    clear(): void;
    size(): number;
    has(collection: string, recordId: string): boolean;
}

const DEFAULT_RETRY_DELAYS = [1000, 3000, 9000];

export function createWriteQueue(opts: {
    execute: (op: WriteOp) => Promise<unknown>;
    onApplied?: (op: WriteOp, result: unknown) => void;
    onGaveUp?: (op: WriteOp, error: unknown) => void;
    shouldRetry?: (error: unknown, op: WriteOp) => boolean;
    isOnline?: () => boolean;
    retryDelays?: number[];
}): WriteQueue {
    const retryDelays = opts.retryDelays ?? DEFAULT_RETRY_DELAYS;
    const isOnline = opts.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);

    const ops = new Map<string, WriteOp>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const running = new Set<string>();
    let generation = 0;

    const keyOf = (collection: string, recordId: string) => `${collection}:${recordId}`;

    function schedule(key: string, delay: number) {
        const existing = timers.get(key);
        if (existing) clearTimeout(existing);
        timers.set(key, setTimeout(() => {
            timers.delete(key);
            void run(key);
        }, delay));
    }

    async function run(key: string) {
        // An active run reschedules pending work in its finally block.
        if (running.has(key)) return;
        const op = ops.get(key);
        if (!op) return;
        if (!isOnline()) return; // flush() re-schedules on reconnect

        const startedGeneration = generation;
        running.add(key);
        // Claim the op: anything enqueued while the request is in flight
        // lands in the map as fresh work instead of mutating this op.
        ops.delete(key);
        try {
            const result = await opts.execute(op);
            if (generation === startedGeneration) opts.onApplied?.(op, result);
        } catch (error) {
            if (generation !== startedGeneration) return;
            const retriable = opts.shouldRetry ? opts.shouldRetry(error, op) : true;
            const requeued = ops.get(key);
            // Preserve all unsaved fields even when this attempt exhausted its
            // retries. A newer partial update must not silently drop them.
            if (requeued && op.kind === 'update' && requeued.kind === 'update') {
                requeued.body = { ...op.body, ...requeued.body };
            }
            if (retriable && op.attempts < retryDelays.length) {
                if (!requeued) ops.set(key, { ...op, attempts: op.attempts + 1 });
                schedule(key, retryDelays[Math.min(op.attempts, retryDelays.length - 1)]);
            } else if (!requeued) {
                opts.onGaveUp?.(op, error);
            }
        } finally {
            running.delete(key);
            if (ops.has(key) && !timers.has(key)) schedule(key, 0);
        }
    }

    return {
        enqueueUpdate(collection, recordId, body) {
            const key = keyOf(collection, recordId);
            const existing = ops.get(key);
            if (existing?.kind === 'delete') return; // deletion supersedes updates
            ops.set(key, {
                collection,
                recordId,
                kind: 'update',
                body: { ...(existing?.body || {}), ...body },
                attempts: 0
            });
            schedule(key, 0);
        },
        enqueueDelete(collection, recordId) {
            const key = keyOf(collection, recordId);
            ops.set(key, { collection, recordId, kind: 'delete', attempts: 0 });
            schedule(key, 0);
        },
        flush() {
            for (const [key, op] of ops) {
                op.attempts = 0;
                schedule(key, 0);
            }
        },
        clear() {
            generation++;
            for (const timer of timers.values()) clearTimeout(timer);
            timers.clear();
            ops.clear();
        },
        size: () => ops.size,
        has: (collection, recordId) => ops.has(keyOf(collection, recordId))
    };
}
