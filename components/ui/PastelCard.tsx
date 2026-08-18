import React from 'react';

interface PastelCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    noHover?: boolean;
}

export function PastelCard({ children, className = '', noHover = false, ...props }: PastelCardProps) {
    return (
        <div
            className={`
                bg-white dark:bg-zinc-900/95
                border border-[#EDE8E1] dark:border-white/10
                rounded-[20px]
                shadow-[0_4px_24px_rgba(26,24,30,0.05)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]
                ${!noHover ? 'hover:shadow-[0_16px_40px_-12px_rgba(184,93,111,0.16)] dark:hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all duration-200' : ''}
                ${className}
            `}
            {...props}
        >
            {children}
        </div>
    );
}
