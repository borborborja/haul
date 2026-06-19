import { useShopStore } from '../store/shopStore';
import { useIsDesktop, palette, cssVars, FONT_SANS } from './theme';
import PhoneApp from './mobile/PhoneApp';
import DesktopApp from './desktop/DesktopApp';

// Responsive Haul shell: same engine, two layouts (desktop >= 900px, else mobile).
export default function HaulApp({ openSettings }: { openSettings: () => void }) {
    const isDark = useShopStore((s) => s.isDark);
    const isDesktop = useIsDesktop();
    const p = palette(isDark);

    return (
        <div style={{ ...cssVars(p), fontFamily: FONT_SANS, background: p.bg, minHeight: '100dvh' }}>
            {isDesktop ? <DesktopApp openSettings={openSettings} /> : <PhoneApp openSettings={openSettings} />}
        </div>
    );
}
