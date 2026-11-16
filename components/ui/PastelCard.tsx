import React from 'react';

/** Fondo de la tarjeta: superficie blanca, un pastel (0–5) o el color principal. */
export type PastelTone = 'surface' | 0 | 1 | 2 | 3 | 4 | 5 | 'primary';

const TONE_CLASS: Record<string, string> = {
    surface: 'bg-surface border border-line',
    0: 'bg-tint-0 border border-transparent',
    1: 'bg-tint-1 border border-transparent',
    2: 'bg-tint-2 border border-transparent',
    3: 'bg-tint-3 border border-transparent',
    4: 'bg-tint-4 border border-transparent',
    5: 'bg-tint-5 border border-transparent',
    primary: 'bg-primary border border-transparent text-white',
};

interface PastelCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    noHover?: boolean;
    tone?: PastelTone;
    ref?: React.Ref<HTMLDivElement>;
}

export function PastelCard({ children, className = '', noHover = false, tone = 'surface', ...props }: PastelCardProps) {
    return (
        <div
            className={`
                ${TONE_CLASS[String(tone)]}
                rounded-card
                ${!noHover ? 'hover:shadow-[var(--ui-shadow)] hover:-translate-y-0.5 transition-all duration-200' : ''}
                ${className}
            `}
            {...props}
        >
            {children}
        </div>
    );
}
