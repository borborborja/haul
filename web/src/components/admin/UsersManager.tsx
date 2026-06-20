import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Loader, RefreshCw, User, Clock, Ghost, KeyRound, UserPlus } from 'lucide-react';

interface UserRecord {
    id: string;
    email: string;
    username: string;
    display_name: string;
    account_type: string;
    last_active_at: string;
}

const UsersManager = ({ onOpenList }: { onOpenList?: (listId: string) => void }) => {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [listsByUser, setListsByUser] = useState<Record<string, { id: string; name: string }[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [u, members] = await Promise.all([
                pb.collection('users').getFullList<UserRecord>({ sort: '-last_active_at' }),
                pb.collection('list_members').getFullList({ expand: 'list' }),
            ]);
            const map: Record<string, { id: string; name: string }[]> = {};
            members.forEach((m: any) => {
                const l = m.expand?.list;
                if (!l) return;
                (map[m.user] ||= []).push({ id: l.id, name: l.data?.listName || l.name || l.invite_code });
            });
            setUsers(u);
            setListsByUser(map);
        } catch (e) {
            console.error(e);
            alert('Error cargando usuarios');
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (u: UserRecord) => {
        if (!confirm(`¿Borrar a ${u.email || u.display_name || u.id}? Esta acción es irreversible.`)) return;
        try { await pb.collection('users').delete(u.id); loadAll(); }
        catch (e: any) { alert(e?.response?.message || 'Error borrando'); }
    };

    const changePassword = async (u: UserRecord) => {
        const pwd = window.prompt(`Nueva contraseña para ${u.email || u.display_name || u.id} (mín. 8):`);
        if (!pwd) return;
        if (pwd.length < 8) { alert('La contraseña debe tener al menos 8 caracteres'); return; }
        try { await pb.collection('users').update(u.id, { password: pwd, passwordConfirm: pwd }); alert('Contraseña actualizada'); }
        catch (e: any) { alert(e?.response?.message || 'Error'); }
    };

    const createAccount = async () => {
        const email = window.prompt('Email de la nueva cuenta:');
        if (!email) return;
        const pwd = window.prompt('Contraseña (mín. 8):');
        if (!pwd) return;
        if (pwd.length < 8) { alert('La contraseña debe tener al menos 8 caracteres'); return; }
        try {
            await pb.collection('users').create({ email: email.trim().toLowerCase(), password: pwd, passwordConfirm: pwd, account_type: 'account', display_name: email.split('@')[0] });
            loadAll();
        } catch (e: any) { alert(e?.response?.message || 'Error creando la cuenta'); }
    };

    const formatTime = (s: string) => s ? new Date(s).toLocaleString() : 'Nunca';
    const isActive = (u: UserRecord) => !!u.last_active_at && new Date(u.last_active_at).getTime() > Date.now() - 5 * 60 * 1000;
    const isStale = (u: UserRecord) => !u.last_active_at || new Date(u.last_active_at).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000;

    if (loading && users.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader className="animate-spin text-emerald-500" size={32} />
            <p className="text-slate-500 font-medium">Cargando usuarios...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center gap-3">
                        Gestor de Usuarios
                        <button onClick={loadAll} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Recargar">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Total: <span className="font-bold">{users.length}</span> · Cuentas: <span className="font-bold">{users.filter(u => u.account_type === 'account').length}</span> · Activos ahora: <span className="font-bold text-green-500">{users.filter(isActive).length}</span>
                    </p>
                </div>
                <button onClick={createAccount} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-sm">
                    <UserPlus size={18} /> Crear cuenta
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500">Usuario</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500">Listas</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500">Última actividad</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users.map(user => {
                                const active = isActive(user);
                                const stale = isStale(user);
                                const lists = listsByUser[user.id] || [];
                                return (
                                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {active ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> : stale ? <Ghost size={14} className="text-orange-500/50" /> : <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />}
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-2">
                                                        {user.email || user.display_name || '—'}
                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${user.account_type === 'account' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{user.account_type === 'account' ? 'Cuenta' : 'Invitado'}</span>
                                                    </span>
                                                    {user.display_name && user.email && <span className="text-[11px] text-slate-400">{user.display_name}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {lists.length ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {lists.map(l => (
                                                        <button key={l.id} onClick={() => onOpenList?.(l.id)} title="Ver en Listas"
                                                            className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                                                            {l.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : <span className="text-slate-300 dark:text-slate-700 text-xs italic">Ninguna</span>}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Clock size={14} className="opacity-50" /><span className="text-sm">{formatTime(user.last_active_at)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => changePassword(user)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="Cambiar contraseña"><KeyRound size={18} /></button>
                                                <button onClick={() => deleteUser(user)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Borrar"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {users.length === 0 && (
                                <tr><td colSpan={4} className="p-16 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><User size={40} className="opacity-20" /><p className="font-bold">No hay usuarios.</p></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UsersManager;
