// Haul design tokens — single source of truth for the new UI shells.
// Mirrors DESIGN.md and the two prototypes (mobile + desktop).
import { useEffect, useState } from 'react';

export interface Palette {
    bg: string;
    surface: string;
    surface2: string;
    text: string;
    muted: string;
    line: string;
    seg: string;
    sidebar: string;
}

// Light uses the desktop prototype's slightly brighter bg; both protos share the rest.
export const lightPalette: Palette = {
    bg: '#FBFCFA',
    surface: '#FFFFFF',
    surface2: '#F4F5F1',
    text: '#0E1B16',
    muted: '#9AA8A0',
    line: 'rgba(0,0,0,.07)',
    seg: '#EFF1ED',
    sidebar: '#F6F7F3',
};

export const darkPalette: Palette = {
    bg: '#0A1512',
    surface: '#13261F',
    surface2: '#0E1D17',
    text: '#EAF2EC',
    muted: '#7E938A',
    line: 'rgba(255,255,255,.07)',
    seg: '#13261F',
    sidebar: '#0E1D17',
};

// Brand
export const ACCENT = '#10B981';
export const ACCENT_INK = '#06231A';
export const AMBER = '#F5B700';
export const DANGER = '#EF4444';

export const FONT_DISPLAY = "'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif";
export const FONT_SANS = "'DM Sans', ui-sans-serif, system-ui, sans-serif";
export const FONT_MONO = "'DM Mono', ui-monospace, SFMono-Regular, monospace";

export const palette = (isDark: boolean): Palette => (isDark ? darkPalette : lightPalette);

// Per-category accent colors keyed by the store's category keys.
export const CATEGORY_COLORS: Record<string, string> = {
    fruit: '#EF4444',
    veg: '#22C55E',
    meat: '#B45309',
    dairy: '#60A5FA',
    pantry: '#FB923C',
    cleaning: '#A78BFA',
    home: '#64748B',
    snacks: '#FB7185',
    frozen: '#06B6D4',
    processed: '#F43F5E',
    drinks: '#6366F1',
    spices: '#F59E0B',
    other: '#94A3B8',
};

export const catColor = (key: string, fallback?: string): string =>
    CATEGORY_COLORS[key] || fallback || ACCENT;

// Active Plan/Shop segment: green gradient + subtle ring (matches the look-and-feel refs).
export const segActive = (isDark: boolean): React.CSSProperties => ({
    background: 'linear-gradient(145deg, #13D08F 0%, #0B9A64 100%)',
    color: isDark ? ACCENT_INK : '#FFFFFF',
    boxShadow: '0 5px 14px rgba(16,185,129,.30), 0 0 0 1.5px rgba(5,32,23,.32)',
});

// Rounded, inset category color bar for item cards/rows.
export const colorBar = (color: string): React.CSSProperties => ({
    position: 'absolute', left: 5, top: 9, bottom: 9, width: 5, borderRadius: 3, background: color,
});

export const alpha = (hex: string, a: number): string => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Apply the active palette as CSS variables on a root element's style object.
export const cssVars = (p: Palette): React.CSSProperties => ({
    ['--bg' as any]: p.bg,
    ['--surface' as any]: p.surface,
    ['--surface2' as any]: p.surface2,
    ['--text' as any]: p.text,
    ['--muted' as any]: p.muted,
    ['--line' as any]: p.line,
    ['--seg' as any]: p.seg,
    ['--sidebar' as any]: p.sidebar,
});

// Responsive: desktop layout at >= 900px, mobile below.
export const DESKTOP_MIN = 900;

export function useIsDesktop(): boolean {
    const [isDesktop, setIsDesktop] = useState(
        typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_MIN : true,
    );
    useEffect(() => {
        const mq = window.matchMedia(`(min-width:${DESKTOP_MIN}px)`);
        const on = () => setIsDesktop(mq.matches);
        on();
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return isDesktop;
}
