import { ACCENT } from '../theme';

interface Props {
    size: number;
    stroke: number;
    frac: number;
    track: string;
    children?: React.ReactNode;
}

export default function ProgressRing({ size, stroke, frac, track, children }: Props) {
    const r = (size - stroke) / 2 - 1;
    const c = 2 * Math.PI * r;
    const center = size / 2;
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={center} cy={center} r={r} fill="none" stroke={track} strokeWidth={stroke} />
                <circle
                    cx={center} cy={center} r={r} fill="none" stroke={ACCENT} strokeWidth={stroke}
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.16,1,.3,1)' }}
                />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {children}
            </div>
        </div>
    );
}
