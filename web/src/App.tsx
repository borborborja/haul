import { lazy, Suspense, useState, useEffect } from 'react';
import { useShopStore } from './store/shopStore';
import { pb } from './lib/pocketbase';
import { Capacitor } from '@capacitor/core';
import AuthGate from './ui/shared/AuthGate';
import InvitesGate from './ui/shared/InvitesGate';
import HaulApp from './ui/HaulApp';
import SettingsModal from './components/modals/SettingsModal';
import { detectLang } from './data/i18n';
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

import { useGuestAuth } from './hooks/useGuestAuth';
import { useListSync } from './hooks/useListSync';
import { useAutoSync } from './hooks/useAutoSync';
import { useAccountLists } from './hooks/useAccountLists';
import { usePresence } from './hooks/usePresence';
import { useStatusBarSync } from './hooks/useStatusBarSync';
import { isConfigEnabled } from './utils/config';
import { isAccountSession } from './utils/auth';

function App() {
  const checkAdmin = () => window.location.hash.startsWith('#/admin') || window.location.pathname.startsWith('/admin');

  const [isAdmin, setIsAdmin] = useState(checkAdmin());
  const { isDark, isAmoled } = useShopStore();
  const [showSettings, setShowSettings] = useState(false);
  const [deepLinkCode, setDeepLinkCode] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- Custom Hooks ---
  const { ensureGuestAuth } = useGuestAuth();
  const { refreshList } = useListSync();
  useAutoSync();
  useAccountLists();
  usePresence(ensureGuestAuth);
  useStatusBarSync();

  // Language follows the browser locale unless the user picked one in Settings.
  useEffect(() => {
    if (!useShopStore.getState().langManual) {
      useShopStore.getState().setLang(detectLang(navigator.language));
    }
  }, []);

  // --- Route Handlers ---
  useEffect(() => {
    const handleRoute = () => setIsAdmin(checkAdmin());
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  // --- Auto Theme Listener ---
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      useShopStore.getState().updateSystemTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Ensure correct initial state if in auto mode on mount
    if (useShopStore.getState().theme === 'auto') {
      useShopStore.getState().updateSystemTheme(mediaQuery.matches);
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // --- Global Theme Sync ---
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (isAmoled) {
      document.documentElement.classList.add('amoled');
    } else {
      document.documentElement.classList.remove('amoled');
    }

    // Also set meta theme-color for mobile browsers (Haul palette).
    // Drop the media-scoped tags so this single value wins at runtime.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m, i) => {
      if (i === 0) {
        m.setAttribute('content', isDark ? '#0A1512' : '#FBFCFA');
        m.removeAttribute('media');
      } else m.remove();
    });
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', isDark ? '#0A1512' : '#FBFCFA');
  }, [isDark, isAmoled]);

  // --- Global Lifecycle & updates ---
  useEffect(() => {
    // Restore connection if configured for native
    if (import.meta.env.VITE_PLATFORM !== 'web') { // Optimization: check env first if possible, or use isNativePlatform helper
      // We use the helper from lib/pocketbase inside the effect
    }

    // Initialize Catalog
    useShopStore.getState().loadCatalog();

    // Re-connect to custom server if needed (Native)
    const { serverUrl } = useShopStore.getState();
    if (serverUrl) {
      // Dynamic import or direct usage if imported at top
      import('./lib/pocketbase').then(({ reinitializePocketBase, isNativePlatform }) => {
        if (isNativePlatform()) {
          reinitializePocketBase(serverUrl);
        }
      });
    }

    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // Proactive SW update check & Sync check
    const checkUpdates = async () => {
      try {
        if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistration === 'function') {
          const registration = await navigator.serviceWorker.getRegistration();
          await registration?.update();
        }
      } catch { /* a failed update check must not prevent list synchronization */ }
      try {
        await ensureGuestAuth();
        await refreshList();
        await useShopStore.getState().checkAndAutoClear();
      } catch (error) { console.error('Resume sync failed', error); }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkUpdates();
    };

    // touchstart fires constantly while using the app; only let it trigger
    // a check occasionally (focus/visibility/online still fire immediately)
    let lastActivityCheck = 0;
    const handleActivity = () => {
      if (Date.now() - lastActivityCheck < 60000) return;
      lastActivityCheck = Date.now();
      checkUpdates();
    };

    window.addEventListener('focus', checkUpdates);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkUpdates);
    window.addEventListener('touchstart', handleActivity, { passive: true });

    const updateInterval = setInterval(checkUpdates, 1000 * 60 * 30); // Every 30 mins

    return () => {
      window.removeEventListener('focus', checkUpdates);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkUpdates);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(updateInterval);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []); // Dependencies empty to run once on mount (hooks handle their own stale closures if well designed, or we use refs)

  // --- Deep Link Handling ---
  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;
    let cancelled = false;
    let removeListener: (() => Promise<void>) | undefined;
    import('@capacitor/app').then(async ({ App: CapApp }) => {
      if (cancelled) return;
      const listener = await CapApp.addListener('appUrlOpen', async (data) => {
        try {
          const url = new URL(data.url);

          // Handle Custom Scheme: shoppinglist://open?server=...&c=...
          if (url.protocol.includes('shoppinglist')) {
            const server = url.searchParams.get('server');
            const code = url.searchParams.get('c');

            if (server) {
              // If a server is specified in the link, we switch to it (Dynamic!)
              // Use the store properly outside of component if needed or via hook
              useShopStore.getState().setServerUrl(server);
              // Re-init PB
              const { reinitializePocketBase } = await import('./lib/pocketbase');
              reinitializePocketBase(server);
            }

            if (code) {
              // Trigger the sync modal flow
              // We can set a temporary storage or state that the modal checks
              // For now, let's assume we want to open settings
              setDeepLinkCode(code);
              setShowSettings(true);
              // We can emit a custom event or set a global state for the modal to pick up
            }
          } else {
            // Handle standard web links (https://domain.com/?c=XYZ) if intercepted
            const code = url.searchParams.get('c');
            if (code) {
              setDeepLinkCode(code);
              setShowSettings(true);
              // Slight delay to ensure modal mounts handling the event
            }
          }
        } catch (e) {
          console.error('Deep Link Error', e);
        }
      });
      if (cancelled) await listener.remove();
      else removeListener = () => listener.remove();
    }).catch(error => console.error('Deep link listener failed', error));
    return () => { cancelled = true; void removeListener?.(); };
  }, []);

  // --- Web App Status Check ---
  const [isWebAppEnabled, setIsWebAppEnabled] = useState(true);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const requireAccount = useShopStore((s) => s.requireAccount);
  const configuredServerUrl = useShopStore((s) => s.serverUrl);
  const registrationOpen = useShopStore((s) => s.registrationOpen);
  // Whether the current session is a real account (not guest) — drives the auth wall.
  const isAccountNow = () => isAccountSession(pb.authStore);
  const [isAccount, setIsAccount] = useState(isAccountNow);
  useEffect(() => {
    setIsAccount(isAccountNow());
    return pb.authStore.onChange(() => setIsAccount(isAccountNow()));
  }, [configuredServerUrl]);



  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    const checkConfig = async () => {
      // First check if we are in native platform - if so, always enabled
      if (Capacitor.getPlatform() !== 'web' && !useShopStore.getState().serverUrl) {
        setIsConfigLoaded(true);
        return;
      }

      // Check URL for admin - if admin, always enabled
      if (checkAdmin()) {
        setIsConfigLoaded(true);
        return;
      }

      try {
        const { pb } = await import('./lib/pocketbase');

        // Initial fetch
        const config = await pb.collection('app_config').getFullList();
        if (cancelled) return;
        const updateState = (records: any[]) => {
          const enabledRecord = records.find((c: any) => c.key === 'enable_web_app');
          const isEnabled = enabledRecord ? isConfigEnabled(enabledRecord.value, true) : true;
          setIsWebAppEnabled(isEnabled);
          const reqRecord = records.find((c: any) => c.key === 'require_account');
          const regRecord = records.find((c: any) => c.key === 'registration_open');
          useShopStore.setState({
            requireAccount: reqRecord ? isConfigEnabled(reqRecord.value, false) : false,
            registrationOpen: regRecord ? isConfigEnabled(regRecord.value, true) : true,
          });
        };
        updateState(config);

        // Real-time subscription
        pb.collection('app_config').subscribe('*', async (e) => {
          // Reload all config to be safe/simple, or just check event
          if (cancelled) return;
          if (e.action === 'update' || e.action === 'create' || e.action === 'delete') {
            try {
              const newConfig = await pb.collection('app_config').getFullList();
              if (!cancelled) updateState(newConfig);
            } catch (error) { console.warn('Failed to refresh config', error); }
          }
        }).then(u => { if (cancelled) u(); else unsub = u; }).catch(error => console.warn('Config subscription failed', error));

      } catch (e) {
        console.warn('Failed to fetch config, assuming enabled', e);
      } finally {
        if (!cancelled) setIsConfigLoaded(true);
      }
    };

    checkConfig();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [isAdmin, configuredServerUrl]);

  if (!isConfigLoaded && !isAdmin && Capacitor.getPlatform() === 'web') {
    // Optional: Render simple loading or just wait (to avoid flash)
    // For now we render nothing or a spinner if preferred, but existing app skeleton is fine.
    // To avoid layout shift, let's just let it fall through to render but maybe show a skeleton?
    // Actually, let's just wait to render content.
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  // Blocking Screen for Web Users if Disabled (Simulate 404)
  if (!isWebAppEnabled && !isAdmin && Capacitor.getPlatform() === 'web') {
    return (
      <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '2rem' }}>
        <h1>404 Not Found</h1>
      </div>
    );
  }

  // Account wall: the instance requires a logged-in account (no guest use).
  if (requireAccount && !isAccount && !isAdmin) {
    return (
      <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
        <AuthGate registrationOpen={registrationOpen} />
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
      <div className="min-h-screen bg-appbg dark:bg-darkBg transition-colors duration-500">
        {isAdmin ? (
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <AdminLayout />
          </Suspense>
        ) : (
          <>
            <HaulApp openSettings={() => setShowSettings(true)} />
            <InvitesGate />

            {showSettings && <SettingsModal
              onClose={() => { setShowSettings(false); setDeepLinkCode(null); }}
              initialSyncCode={deepLinkCode}
              installPrompt={deferredPrompt}
              onInstall={() => setDeferredPrompt(null)}
            />}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
