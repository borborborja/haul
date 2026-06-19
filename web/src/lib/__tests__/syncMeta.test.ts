import { describe, it, expect } from 'vitest';
import { beginWrite, endWrite, hasPendingWrite, parsePbDate, shouldSkipRemoteUpdate } from '../syncMeta';

describe('pending write tracking', () => {
    it('counts nested writes per record', () => {
        expect(hasPendingWrite('a')).toBe(false);
        beginWrite('a');
        beginWrite('a');
        endWrite('a');
        expect(hasPendingWrite('a')).toBe(true);
        endWrite('a');
        expect(hasPendingWrite('a')).toBe(false);
    });

    it('tolerates unbalanced endWrite', () => {
        endWrite('never-started');
        expect(hasPendingWrite('never-started')).toBe(false);
    });
});

describe('parsePbDate', () => {
    it('parses PocketBase datetime strings', () => {
        expect(parsePbDate('2026-06-11 10:00:00.000Z')).toBe(Date.parse('2026-06-11 10:00:00.000Z'));
    });

    it('returns 0 for empty or invalid input', () => {
        expect(parsePbDate('')).toBe(0);
        expect(parsePbDate(undefined)).toBe(0);
        expect(parsePbDate('not a date')).toBe(0);
    });
});

describe('shouldSkipRemoteUpdate', () => {
    const t1 = '2026-06-11 10:00:00.000Z';
    const t2 = '2026-06-11 10:00:01.000Z';

    it('skips events while a local write is in flight', () => {
        beginWrite('x');
        expect(shouldSkipRemoteUpdate('x', t2, parsePbDate(t1))).toBe(true);
        endWrite('x');
    });

    it('skips stale or duplicate events', () => {
        expect(shouldSkipRemoteUpdate('x', t1, parsePbDate(t1))).toBe(true);
        expect(shouldSkipRemoteUpdate('x', t1, parsePbDate(t2))).toBe(true);
    });

    it('applies newer events', () => {
        expect(shouldSkipRemoteUpdate('x', t2, parsePbDate(t1))).toBe(false);
    });

    it('applies events when no server version is known yet', () => {
        expect(shouldSkipRemoteUpdate('x', t1, undefined)).toBe(false);
    });
});
