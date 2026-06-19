import { useState } from 'react';
import { Store, Mail, Lock, Loader, ArrowRight, ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { pb } from '../../lib/pocketbase';

interface AdminSetupProps {
    onComplete: () => void;
}

const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) => (
    <button type="button" onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-4 text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
        <span>
            <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
        </span>
        <span className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </span>
    </button>
);

const AdminSetup = ({ onComplete }: AdminSetupProps) => {
    const [step, setStep] = useState(1);
    const [serverName, setServerName] = useState('');
    const [enableWebApp, setEnableWebApp] = useState(true);
    const [enableUsernames, setEnableUsernames] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('La contrasenya ha de tenir almenys 8 caràcters.');
            return;
        }
        if (password !== confirm) {
            setError('Les contrasenyes no coincideixen.');
            return;
        }

        setLoading(true);
        try {
            await pb.send('/api/shoplist/setup', {
                method: 'POST',
                body: {
                    email: email.trim(),
                    password,
                    serverName: serverName.trim(),
                    enableWebApp,
                    enableUsernames,
                },
            });
            await pb.collection('_superusers').authWithPassword(email.trim(), password);
            onComplete();
        } catch (setupError: any) {
            console.error('Setup error:', setupError);
            setError(setupError?.response?.message || setupError?.message || 'No s’ha pogut completar la configuració.');
            setLoading(false);
        }
    };

    return (
        <main className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Configuració inicial</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pas {step} de 2 · {step === 1 ? 'Instància' : 'Administrador'}</p>
                    <div className="flex gap-1.5 mt-3">
                        <span className={`h-1.5 w-10 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        <span className={`h-1.5 w-10 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {step === 1 ? (
                        <>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">
                                Nom de la instància
                                <span className="relative block mt-1">
                                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="La meva llista" className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                                </span>
                            </label>

                            <div className="space-y-2 pt-1">
                                <Toggle checked={enableWebApp} onChange={setEnableWebApp} label="App web activada" hint="Permet l'accés des del navegador" />
                                <Toggle checked={enableUsernames} onChange={setEnableUsernames} label="Noms d'usuari" hint="Permet registre amb nom d'usuari" />
                            </div>

                            <button type="button" onClick={() => setStep(2)} className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2">
                                Continuar <ArrowRight size={18} />
                            </button>
                        </>
                    ) : (
                        <>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">
                                Correu de l'administrador
                                <span className="relative block mt-1">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                                </span>
                            </label>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">
                                Contrasenya
                                <span className="relative block mt-1">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                                </span>
                            </label>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300">
                                Repeteix la contrasenya
                                <span className="relative block mt-1">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full min-h-11 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                                </span>
                            </label>

                            {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}

                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setError(''); setStep(1); }} disabled={loading} className="min-h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    <ArrowLeft size={18} />
                                </button>
                                <button type="submit" disabled={loading} className="flex-1 min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                                    {loading ? <Loader className="animate-spin" size={20} /> : <><Check size={18} /> Finalitzar</>}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </main>
    );
};

export default AdminSetup;
