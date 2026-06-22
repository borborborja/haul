// Small avatar: shows the photo if present, else a colored circle with the
// initial. Used for the current user's chips and anywhere a person is shown.
export default function Avatar({ name, url, color, size = 30 }: { name?: string | null; url?: string | null; color?: string | null; size?: number }) {
    const initial = (name || 'H').charAt(0).toUpperCase();
    if (url) {
        return <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    }
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: color || '#10B981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.42), fontFamily: '"Bricolage Grotesque", sans-serif', flexShrink: 0 }}>
            {initial}
        </div>
    );
}
