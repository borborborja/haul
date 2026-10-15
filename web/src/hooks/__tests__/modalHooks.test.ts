import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    cleanups: [] as Array<() => void>,
    native: false,
    remove: vi.fn(),
    add: vi.fn(),
}));
vi.mock('react', () => ({
    useRef: (value: unknown) => ({ current: value }),
    useLayoutEffect: (effect: () => void) => { effect(); },
    useEffect: (effect: () => (() => void) | undefined) => {
        const cleanup = effect();
        if (cleanup) mocks.cleanups.push(cleanup);
    },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.add } }));
import { useScrollLock } from '../useScrollLock';
import { useBackButton } from '../useBackButton';

beforeEach(() => {
    mocks.native = false;
    vi.clearAllMocks();
    mocks.add.mockResolvedValue({ remove: mocks.remove });
    vi.stubGlobal('document', { body: { style: { overflow: 'auto' } } });
    vi.stubGlobal('window', { history: { pushState: vi.fn(), back: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(async () => {
    mocks.cleanups.splice(0).forEach(cleanup => cleanup());
    await Promise.resolve();
});

describe('nested modal hooks', () => {
    it('keeps scrolling locked until the last modal closes', () => {
        useScrollLock(true);
        useScrollLock(true);
        mocks.cleanups.shift()!();
        expect(document.body.style.overflow).toBe('hidden');
        mocks.cleanups.shift()!();
        expect(document.body.style.overflow).toBe('auto');
    });
    it('uses one native back listener and removes only its own listener', async () => {
        mocks.native = true;
        const parent = vi.fn();
        const child = vi.fn();
        useBackButton(parent);
        useBackButton(child);
        expect(mocks.add).toHaveBeenCalledTimes(1);
        const onBack = mocks.add.mock.calls[0][1];
        onBack();
        expect(child).toHaveBeenCalledTimes(1);
        expect(parent).not.toHaveBeenCalled();
        mocks.cleanups.pop()!();
        onBack();
        expect(parent).toHaveBeenCalledTimes(1);
        expect(mocks.remove).not.toHaveBeenCalled();
        mocks.cleanups.pop()!();
        await Promise.resolve();
        expect(mocks.remove).toHaveBeenCalledTimes(1);
    });
});
