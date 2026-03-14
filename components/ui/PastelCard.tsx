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
                bg-white/90 dark:bg-gray-800/90 backdrop-blur-md
                border border-pink-100/80 dark:border-gray-600/80
                rounded-[24px]
                shadow-[0_4px_24px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]
                ${!noHover ? 'hover:shadow-[0_8px_32px_rgba(236,72,153,0.12)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-1 transition-all duration-300' : ''}
                ${className}
            `}
            {...props}
        >
            {children}
        </div>
    );
}
