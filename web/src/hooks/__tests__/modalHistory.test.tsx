// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBackButton } from '../useBackButton';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

function Modal({ name, close, children }: { name: string; close: () => void; children?: React.ReactNode }) {
    useBackButton(close);
    return <div role="dialog" aria-label={name}><button onClick={close}>Close {name}</button>{children}</div>;
}
function Harness() {
    const [parent, setParent] = useState(false);
    const [child, setChild] = useState(false);
    return <><button onClick={() => setParent(true)}>Open product</button>{parent && <Modal name="product" close={() => setParent(false)}>
        <button onClick={() => setChild(true)}>Open category</button>
        {child && <Modal name="category" close={() => setChild(false)} />}
    </Modal>}</>;
}
afterEach(async () => { cleanup(); await new Promise(resolve => setTimeout(resolve, 25)); });

describe('browser modal history under StrictMode', () => {
    it('keeps a new dialog open when React replays its effects', async () => {
        const user = userEvent.setup();
        render(<StrictMode><Harness /></StrictMode>);
        await user.click(screen.getByText('Open product'));
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(screen.getByRole('dialog', { name: 'product' })).toBeTruthy();
        await user.click(screen.getByText('Close product'));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('restores the parent after closing its nested category dialog', async () => {
        const user = userEvent.setup();
        render(<StrictMode><Harness /></StrictMode>);
        await user.click(screen.getByText('Open product'));
        await user.click(screen.getByText('Open category'));
        await user.click(screen.getByText('Close category'));
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(screen.getByRole('dialog', { name: 'product' })).toBeTruthy();
        expect(screen.queryByRole('dialog', { name: 'category' })).toBeNull();
        window.history.back();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
});
