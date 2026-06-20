// Advanced settings shared by the desktop + mobile in-app Settings:
// server URL, JSON backup (export/import/reset) and sync-code actions.
// Ported from components/modals/SettingsModal.tsx so the new tabbed settings
// keep every feature.
import { useState } from 'react';
import PocketBase from 'pocketbase';
import { pb, reinitializePocketBase, ensureGuestSession } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';

export function useSettingsExtras() {
    const serverUrl = useShopStore((s) => s.serverUrl);
    const sync = useShopStore((s) => s.sync);
    const [status, setStatus] = useState('');

    // ---- Server ----
    const testAndSave = async (url: string) => {
        const u = url.trim();
        if (!u) { setStatus('error'); return false; }
        setStatus('testing');
        try {
            await new PocketBase(u).health.check();
            useShopStore.getState().setServerUrl(u);
            reinitializePocketBase(u);
            await ensureGuestSession();
            setStatus('ok');
            return true;
        } catch {
            setStatus('error');
            return false;
        }
    };

    // ---- Backup ----
    const exportJson = () => {
        const { items, categories, listName } = useShopStore.getState();
        const blob = new Blob([JSON.stringify({ items, categories, listName }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `haul-${(listName || 'list').replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const importJson = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(String(reader.result));
                    if (data && Array.isArray(data.items)) {
                        useShopStore.getState().importData(data.items, data.categories || useShopStore.getState().categories, data.listName ?? null);
                    }
                } catch { /* ignore malformed */ }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    const reset = () => useShopStore.getState().resetDefaults();

    // ---- Sync code ----
    const rotateCode = async () => {
        const recordId = useShopStore.getState().sync.recordId;
        if (!recordId) return;
        try {
            const res = await pb.send<{ inviteCode: string }>(`/api/shoplist/lists/${recordId}/rotate-code`, { method: 'POST' });
            useShopStore.getState().setSyncState({ code: res.inviteCode, msg: '', msgType: 'success' });
            localStorage.setItem('shopListSyncCode', res.inviteCode);
        } catch { /* only owner can rotate */ }
    };
    const shareCode = async () => {
        const code = useShopStore.getState().sync.code;
        if (!code) return;
        const url = `${window.location.origin}/?c=${code}`;
        try {
            if (navigator.share) await navigator.share({ title: 'Haul', text: code, url });
            else await navigator.clipboard.writeText(url);
        } catch { /* dismissed */ }
    };
    const removeFromSyncHistory = useShopStore((s) => s.removeFromSyncHistory);

    return {
        serverUrl, status, testAndSave,
        exportJson, importJson, reset,
        rotateCode, shareCode,
        syncHistory: sync.syncHistory, removeFromSyncHistory,
    };
}
