import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import { LANGS } from '../../data/i18n';

// Languages beyond the three base inputs (es/ca/en) the forms already have.
const EXTRA = LANGS.filter((l) => !['es', 'ca', 'en'].includes(l.code));

interface Props {
    value: Record<string, string>;
    onChange: (next: Record<string, string>) => void;
    onTranslate: () => void;
    translating: boolean;
}

// Manual + AI editor for the catalog translations. The "✨ Translate" button
// pre-fills every language; each field stays editable so the admin can correct
// any translation by hand.
const AllLanguagesEditor = ({ value, onChange, onTranslate, translating }: Props) => {
    const [open, setOpen] = useState(false);
    const filled = EXTRA.filter((l) => (value[l.code] || '').trim()).length;
    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Más idiomas <span className="text-xs font-mono text-slate-400">{filled}/{EXTRA.length}</span>
                </button>
                <button type="button" onClick={onTranslate} disabled={translating} className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {translating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />} Traducir a todos
                </button>
            </div>
            {open && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {EXTRA.map((l) => (
                        <div key={l.code} className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-xs font-bold text-slate-500 flex items-center gap-1"><span>{l.flag}</span>{l.code.toUpperCase()}</span>
                            <input value={value[l.code] || ''} onChange={(e) => onChange({ ...value, [l.code]: e.target.value })} className="input-admin flex-1 text-sm py-1.5" placeholder={l.label} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AllLanguagesEditor;
