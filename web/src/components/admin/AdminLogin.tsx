import { useState } from 'react';
import { Lock, Loader, Mail } from 'lucide-react';
import { pb } from '../../lib/pocketbase';

interface AdminLoginProps {
    onLogin: () => void;
}

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            await pb.collection('_superusers').authWithPassword(email, password);
            onLogin();
        } catch (loginError) {
            console.error('Admin login error:', loginError);
            setError('Correu o contrasenya incorrectes');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Administració</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Accés de superusuari</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">
                        Correu
                        <span className="relative block mt-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                        </span>
                    </label>
                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">
                        Contrasenya
                        <span className="relative block mt-1">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                        </span>
                    </label>
                    {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader className="animate-spin" size={20} /> : 'Entrar'}
                    </button>
                </form>
            </div>
        </main>
    );
};

export default AdminLogin;
