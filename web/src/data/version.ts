// Single source of truth for the app version + GitHub repo used by the
// "update available" checker. Keep APP_VERSION in sync with android versionName
// and the release tag.
export const APP_VERSION = '1.10.3';
export const GITHUB_REPO = 'borborborja/haul';
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// Compare two semver-ish strings ("v1.4.0" / "1.4.0"). >0 if a>b, <0 if a<b.
export function compareVersions(a: string, b: string): number {
    const parse = (s: string) => s.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
}
