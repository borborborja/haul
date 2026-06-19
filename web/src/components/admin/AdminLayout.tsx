import { useEffect, useState } from 'react';
import { pb } from '../../lib/pocketbase';
import AdminLogin from './AdminLogin';
import AdminSetup from './AdminSetup';
import AdminDashboard from './AdminDashboard';

const AdminLayout = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(
        pb.authStore.isValid && pb.authStore.record?.collectionName === '_superusers'
    );
    // null = unknown (still checking), true = first-run wizard, false = normal login
    const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

    useEffect(() => pb.authStore.onChange(() => {
        setIsAuthenticated(pb.authStore.isValid && pb.authStore.record?.collectionName === '_superusers');
    }), []);

    useEffect(() => {
        if (isAuthenticated) return;
        let active = true;
        pb.send('/api/shoplist/setup', { method: 'GET', cache: 'no-store' })
            .then((res: { needsSetup?: boolean }) => { if (active) setNeedsSetup(!!res?.needsSetup); })
            .catch(() => { if (active) setNeedsSetup(false); });
        return () => { active = false; };
    }, [isAuthenticated]);

    const handleLogout = () => {
        pb.authStore.clear();
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        if (needsSetup === null) {
            return (
                <main className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                </main>
            );
        }
        if (needsSetup) {
            return <AdminSetup onComplete={() => setIsAuthenticated(true)} />;
        }
        return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
    }
    return <AdminDashboard onLogout={handleLogout} />;
};

export default AdminLayout;
