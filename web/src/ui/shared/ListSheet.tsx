import { Plus } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel } from './model';
import { ACCENT, FONT_DISPLAY, alpha } from '../theme';

// Mobile bottom sheet: "Les meves llistes" — switch / create lists.
export default function ListSheet({ onClose }: { onClose: () => void }) {
    const m = useHaulModel();
    const switchList = useShopStore((s) => s.switchList);
    const createList = useShopStore((s) => s.createList);

    const pick = (id: string) => { switchList(id); onClose(); };
    const create = () => {
        const name = window.prompt(m.t.enterListName);
        if (name === null) return;
        createList(name.trim() || null, '🛒');
        onClose();
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(6,10,8,.5)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg)', borderRadius: '30px 30px 0 0', padding: '14px 22px 30px', animation: 'slideUp .25s ease' }}>
                <div style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--line)', margin: '0 auto 18px' }} />
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: 'var(--text)', marginBottom: 14 }}>{m.t.myList}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {m.listSummaries.map((l) => (
                        <button key={l.id} onClick={() => pick(l.id)}
                            style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', border: `1px solid ${l.active ? alpha(ACCENT, 0.4) : 'var(--line)'}`, borderRadius: 15, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{l.emoji}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{l.name || m.t.myList}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{l.progress}</div>
                            </div>
                            {l.active && <span style={{ width: 9, height: 9, borderRadius: '50%', background: ACCENT }} />}
                        </button>
                    ))}
                    <button onClick={create} style={{ border: '1.5px dashed var(--line)', background: 'transparent', borderRadius: 15, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: 'var(--muted)', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>
                        <Plus size={16} color="var(--muted)" strokeWidth={2.2} />{m.t.createList}
                    </button>
                </div>
            </div>
        </div>
    );
}
