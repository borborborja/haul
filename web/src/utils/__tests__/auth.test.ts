import { describe, expect, it } from 'vitest';
import { isAccountSession } from '../auth';

describe('account controls', () => {
    it.each([
        { isValid: true, record: { collectionName: 'users', account_type: 'guest' } },
        { isValid: false, record: { collectionName: 'users', account_type: 'account' } },
        { isValid: true, record: { collectionName: '_superusers' } },
        { isValid: true, record: null },
    ])('keeps sign-in available without an authenticated permanent account', session => {
        expect(isAccountSession(session)).toBe(false);
    });
    it('shows account controls for a signed-in permanent user', () => {
        expect(isAccountSession({ isValid: true, record: { collectionName: 'users', account_type: 'account' } })).toBe(true);
    });
});
