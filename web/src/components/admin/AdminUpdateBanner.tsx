import { useState } from 'react';
import { Download, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useLatestRelease } from '../../ui/shared/useLatestRelease';

// "Update available" banner for the admin panel. Shows the new version +
// changelog and links to the GitHub release (where the new image/APK live).
const AdminUpdateBanner = () => {
    const { release, updateAvailable } = useLatestRelease();
    const [open, setOpen] = useState(false);
    if (!updateAvailable || !release) return null;

    return (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-900/20 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-800 dark:text-white">Actualización disponible</span>
                    <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{release.version}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setOpen((o) => !o)} className="text-sm font-bold text-slate-500 dark:text-slate-300 flex items-center gap-1">
                        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Novedades
                    </button>
                    <a href={release.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 rounded-lg">
                        <Download size={16} /> Actualizar
                    </a>
                </div>
            </div>
            {open && (
                <pre className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-sans">{release.body || '—'}</pre>
            )}
        </div>
    );
};

export default AdminUpdateBanner;
