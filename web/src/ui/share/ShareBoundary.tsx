import { Component, type ReactNode } from 'react';

// Turns a blank screen (failed chunk load or render error on the public share
// page) into a visible, actionable message instead of an empty white page.
export default class ShareBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }

    render() {
        if (this.state.failed) {
            return (
                <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F7F4', fontFamily: 'DM Sans, system-ui, sans-serif', color: '#06231A', padding: 24 }}>
                    <div style={{ textAlign: 'center', maxWidth: 360 }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>No se pudo cargar la lista</div>
                        <div style={{ opacity: 0.6, marginTop: 6, fontSize: 14 }}>Comprueba tu conexión y vuelve a cargar la página.</div>
                        <button onClick={() => window.location.reload()} style={{ marginTop: 16, border: 'none', background: '#10B981', color: '#fff', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Recargar</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
