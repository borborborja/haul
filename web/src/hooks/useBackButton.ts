import { useEffect, useLayoutEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

type BackEntry = { close: () => void; fromBack: boolean };
const backHandlingStack: BackEntry[] = [];
let nativeListener: Promise<PluginListenerHandle> | undefined;

export function useBackButton(handler: () => void) {
    const handlerRef = useRef(handler);
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
        if (isNative) {
            // Remove only our listener; removeAllListeners also broke unrelated
            // app-state and resume handlers installed by the application.
            nativeListener ??= App.addListener('backButton', handleBack);
        } else {
            window.history.pushState({ modalOpen: true }, '', null);
            window.addEventListener('popstate', onPopState);
        }
        function onPopState() {
            if (backHandlingStack[backHandlingStack.length - 1] === entry) handleBack();
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
                if (!entry.fromBack) window.history.back();
            }
        };
    }, []);
}
