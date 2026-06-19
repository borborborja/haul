import { useEffect } from 'react';

export const useScrollLock = (lock: boolean) => {
    useEffect(() => {
        if (lock) {
            // Save the inline value (usually empty) rather than the computed
            // one. Restoring the computed value would pin an inline
            // `overflow: hidden auto` on <body>, turning it into a scroll
            // container and breaking vertical touch scrolling on mobile after
            // a modal closes.
            const originalInline = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalInline;
            };
        }
    }, [lock]);
};
