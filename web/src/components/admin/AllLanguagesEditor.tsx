import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import { LANGS } from '../../data/i18n';

interface Props {
    value: Record<string, string>;
    onChange: (next: Record<string, string>) => void;
    onTranslate: () => void;
    translating: boolean;
}

// One uniform editor for ALL languages — none is privileged over another (no
// special es/ca/en, no flags). The "✨ Translate" button pre-fills every empty
// language from the first filled one; each field stays editable for manual fixes.
const AllLanguagesEditor = ({ value, onChange, onTranslate, translating }: Props) => {
    const [open, setOpen] = useState(true);
    const filled = LANGS.filter((l) => (value[l.code] || '').trim()).length;
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Idiomas <span className="text-xs font-mono text-slate-400">{filled}/{LANGS.length}</span>
                </button>
                <button type="button" onClick={onTranslate} disabled={translating} className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {translating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />} Traducir
                </button>
            </div>
            {open && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {LANGS.map((l) => (
                        <div key={l.code} className="flex items-center gap-2">
                            <span className="w-24 shrink-0 text-xs font-bold text-slate-500">{l.label}</span>
                            <input value={value[l.code] || ''} onChange={(e) => onChange({ ...value, [l.code]: e.target.value })} className="input-admin flex-1 text-sm py-1.5" placeholder={l.label} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AllLanguagesEditor;
