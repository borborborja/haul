// Browser notification permission helper. The app shows notifications when
// other devices add/check items, but nothing ever requested permission, so on
// most browsers Notification.permission stayed "default" and notifications were
// silently dropped. Call this when the user opts into a notify toggle.
export async function ensureNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        const result = await Notification.requestPermission();
        return result === 'granted';
    } catch {
        return false;
    }
}
