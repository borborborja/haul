import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ShareBoundary from './ui/share/ShareBoundary.tsx'

// Public shared-list view: served (unauthenticated) at /s/<token>. Rendered in
// place of the main app so the share page carries no auth/store bootstrapping.
const ShareView = lazy(() => import('./ui/share/ShareView.tsx'))
const isShare = window.location.pathname.startsWith('/s/')

const loader = (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F7F4' }}>
    <div style={{ width: 28, height: 28, border: '3px solid #10B981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isShare
      ? <Suspense fallback={loader}><ShareBoundary><ShareView /></ShareBoundary></Suspense>
      : <App />}
  </StrictMode>,
)
