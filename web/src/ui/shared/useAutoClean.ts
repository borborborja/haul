import { useEffect, useState } from 'react';
import { useShopStore } from '../../store/shopStore';

// Live auto-clean countdown that mirrors the prototype's "58:12" timer.
// The completed items are cleared ~autoClearMinutes after they were checked;
// we count down from the most recent completion so the pill resets on each check.
export function useAutoClean() {
    const items = useShopStore((s) => s.items);
    const enabled = useShopStore((s) => s.autoClearEnabled);
    const minutes = useShopStore((s) => s.autoClearMinutes);
    const [, tick] = useState(0);

    const completed = items.filter((i) => i.checked && i.inList !== false);
    const active = enabled && completed.length > 0;

    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [active]);

    let label = '';
    if (active) {
        const lastChecked = Math.max(...completed.map((i) => i.updatedAt || Date.now()));
        const remainMs = Math.max(0, lastChecked + minutes * 60000 - Date.now());
        const mm = Math.floor(remainMs / 60000);
        const ss = Math.floor((remainMs % 60000) / 1000);
        label = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    return { active, label };
}
