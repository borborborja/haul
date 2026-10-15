import { useEffect, useLayoutEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

type BackEntry = { close: () => void; fromBack: boolean };
const backHandlingStack: BackEntry[] = [];
let nativeListener: Promise<PluginListenerHandle> | undefined;
const abandonedFrames = new Set<string>();
let cleanupListener = false;

function unwindClosedFrames() {
    const token = window.history.state?.haulModalToken as string | undefined;
    if (token && abandonedFrames.has(token)) {
        abandonedFrames.delete(token);
        window.history.back();
    } else if (!abandonedFrames.size && cleanupListener) {
        window.removeEventListener('popstate', unwindClosedFrames);
        cleanupListener = false;
    }
}

export function useBackButton(handler: () => void) {
    const handlerRef = useRef(handler);
    const frameRef = useRef<{ token: string; timer?: ReturnType<typeof setTimeout> }>({ token: '' });
    useLayoutEffect(() => { handlerRef.current = handler; }, [handler]);

    useEffect(() => {
        const entry: BackEntry = { close: () => handlerRef.current(), fromBack: false };
        backHandlingStack.push(entry);
        const handleBack = () => {
            const top = backHandlingStack[backHandlingStack.length - 1];
            if (top) {
                top.fromBack = true;
                top.close();
            }
        };
        const isNative = Capacitor.isNativePlatform();
        const frame = frameRef.current;
        if (!frame.token) frame.token = crypto.randomUUID();
        if (isNative) {
            // Remove only our listener; removeAllListeners also broke unrelated
            // app-state and resume handlers installed by the application.
            nativeListener ??= App.addListener('backButton', handleBack);
        } else {
            // StrictMode replays effects. Reuse its frame instead of popping it
            // asynchronously and accidentally closing the remounted dialog.
            if (frame.timer) clearTimeout(frame.timer);
            abandonedFrames.delete(frame.token);
            if (window.history.state?.haulModalToken !== frame.token) {
                window.history.pushState({ modalOpen: true, haulModalToken: frame.token }, '', null);
            }
            window.addEventListener('popstate', onPopState);
        }
        function onPopState() {
            // Closing a child programmatically restores the parent's frame;
            // that transition should leave the parent open.
            if (backHandlingStack[backHandlingStack.length - 1] === entry && window.history.state?.haulModalToken !== frame.token) handleBack();
        }
        return () => {
            const index = backHandlingStack.indexOf(entry);
            if (index !== -1) backHandlingStack.splice(index, 1);
            if (isNative) {
                if (!backHandlingStack.length && nativeListener) {
                    const listener = nativeListener;
                    nativeListener = undefined;
                    void listener.then(handle => handle.remove());
                }
            } else {
                window.removeEventListener('popstate', onPopState);
                if (!entry.fromBack) frame.timer = setTimeout(() => {
                    abandonedFrames.add(frame.token);
                    if (!cleanupListener) {
                        window.addEventListener('popstate', unwindClosedFrames);
                        cleanupListener = true;
                    }
                    unwindClosedFrames();
                }, 0);
            }
        };
    }, []);
}
