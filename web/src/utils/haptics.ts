import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNativePlatform } from '../lib/pocketbase';

/**
 * Trigger a haptic feedback or vibration
 * @param duration Duration in ms (only for fallback web vibration)
 */
export const triggerHaptic = async (duration: number = 20) => {
    try {
        if (isNativePlatform()) {
            // Use native haptics if on mobile
            await Haptics.impact({
                style: duration > 50 ? ImpactStyle.Heavy : ImpactStyle.Light
            });
        } else if (navigator.vibrate) {
            // Fallback to web vibration
            navigator.vibrate(duration);
        }
    } catch (e) {
        // Silently fail if haptics are not supported or blocked
        console.debug('Haptic feedback not available', e);
    }
};
