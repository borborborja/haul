import { useState, useEffect } from 'react';
import { APP_VERSION, GITHUB_REPO, compareVersions } from '../../data/version';

export interface ReleaseInfo {
    version: string;
    name: string;
    body: string;
    url: string;
}

const CACHE_KEY = 'haul-latest-release';
const TTL = 1000 * 60 * 60 * 3; // re-check at most every 3h (GitHub API is rate-limited)

// Checks the latest GitHub release and reports whether it's newer than the
// running app. Result is cached in localStorage to avoid hammering the API.
export function useLatestRelease() {
    const [release, setRelease] = useState<ReleaseInfo | null>(null);

    useEffect(() => {
        let active = true;
        const apply = (info: ReleaseInfo) => { if (active) setRelease(info); };

        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (cached?.info && Date.now() - cached.t < TTL) { apply(cached.info); return () => { active = false; }; }
        } catch { /* ignore */ }

        fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((d: any) => {
                if (!d?.tag_name) return;
                const info: ReleaseInfo = { version: d.tag_name, name: d.name || d.tag_name, body: d.body || '', url: d.html_url };
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), info })); } catch { /* ignore */ }
                apply(info);
            })
            .catch(() => { /* offline / rate-limited — silently ignore */ });

        return () => { active = false; };
    }, []);

    const updateAvailable = !!release && compareVersions(release.version, APP_VERSION) > 0;
    return { release, updateAvailable, currentVersion: APP_VERSION };
}
