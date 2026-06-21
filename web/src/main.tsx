import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Public shared-list view: served (unauthenticated) at /s/<token>. Rendered in
// place of the main app so the share page carries no auth/store bootstrapping.
const ShareView = lazy(() => import('./ui/share/ShareView.tsx'))
const isShare = window.location.pathname.startsWith('/s/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isShare
      ? <Suspense fallback={null}><ShareView /></Suspense>
      : <App />}
  </StrictMode>,
)
