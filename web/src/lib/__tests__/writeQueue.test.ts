import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWriteQueue, type WriteOp } from '../writeQueue';

describe('createWriteQueue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('coalesces consecutive updates to the same record', async () => {
        const execute = vi.fn().mockResolvedValue({ ok: true });
        const q = createWriteQueue({ execute, isOnline: () => true });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        q.enqueueUpdate('shopping_items', 'a', { note: 'hi' });
        await vi.advanceTimersByTimeAsync(10);

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][0].body).toEqual({ checked: true, note: 'hi' });
    });

    it('lets a delete supersede queued updates', async () => {
        const execute = vi.fn().mockResolvedValue(null);
        const q = createWriteQueue({ execute, isOnline: () => true });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        q.enqueueDelete('shopping_items', 'a');
        q.enqueueUpdate('shopping_items', 'a', { checked: false }); // ignored after delete
        await vi.advanceTimersByTimeAsync(10);

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][0].kind).toBe('delete');
    });

    it('retries with backoff and eventually succeeds', async () => {
        const execute = vi.fn()
            .mockRejectedValueOnce(new Error('boom'))
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValue({ ok: true });
        const applied: WriteOp[] = [];
        const q = createWriteQueue({
            execute,
            onApplied: (op) => applied.push(op),
            isOnline: () => true,
            retryDelays: [100, 200, 300]
        });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        await vi.advanceTimersByTimeAsync(10);   // first attempt fails
        expect(execute).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(100);  // retry 1 fails
        expect(execute).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(200);  // retry 2 succeeds
        expect(execute).toHaveBeenCalledTimes(3);
        expect(applied).toHaveLength(1);
        expect(q.size()).toBe(0);
    });

    it('gives up after exhausting retries', async () => {
        const execute = vi.fn().mockRejectedValue(new Error('down'));
        const gaveUp = vi.fn();
        const q = createWriteQueue({
            execute,
            onGaveUp: gaveUp,
            isOnline: () => true,
            retryDelays: [50, 50]
        });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        await vi.advanceTimersByTimeAsync(500);

        expect(execute).toHaveBeenCalledTimes(3); // initial + 2 retries
        expect(gaveUp).toHaveBeenCalledTimes(1);
        expect(q.size()).toBe(0);
    });

    it('gives up immediately on non-retriable errors', async () => {
        const execute = vi.fn().mockRejectedValue({ status: 403 });
        const gaveUp = vi.fn();
        const q = createWriteQueue({
            execute,
            onGaveUp: gaveUp,
            shouldRetry: (e: any) => !e?.status || e.status >= 500,
            isOnline: () => true
        });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        await vi.advanceTimersByTimeAsync(10);

        expect(execute).toHaveBeenCalledTimes(1);
        expect(gaveUp).toHaveBeenCalledTimes(1);
    });

    it('waits while offline and flushes on demand', async () => {
        let online = false;
        const execute = vi.fn().mockResolvedValue({ ok: true });
        const q = createWriteQueue({ execute, isOnline: () => online });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        await vi.advanceTimersByTimeAsync(10);
        expect(execute).not.toHaveBeenCalled();
        expect(q.size()).toBe(1);

        online = true;
        q.flush();
        await vi.advanceTimersByTimeAsync(10);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(q.size()).toBe(0);
    });

    it('applies an update enqueued while another is in flight', async () => {
        let resolveFirst!: (v: unknown) => void;
        const execute = vi.fn()
            .mockImplementationOnce(() => new Promise(res => { resolveFirst = res; }))
            .mockResolvedValue({ ok: true });
        const q = createWriteQueue({ execute, isOnline: () => true });

        q.enqueueUpdate('shopping_items', 'a', { checked: true });
        await vi.advanceTimersByTimeAsync(10); // first request in flight

        q.enqueueUpdate('shopping_items', 'a', { checked: false });
        resolveFirst({ ok: true });
        await vi.advanceTimersByTimeAsync(10);

        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute.mock.calls[1][0].body).toEqual({ checked: false });
    });
});
