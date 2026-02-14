import React from 'react';

interface NeonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function NeonCard({ children, className = '', hoverEffect = true, ...props }: NeonCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden
        bg-[#130a1a]/90 backdrop-blur-xl 
        border border-white/5 
        rounded-2xl
        ${hoverEffect ? 'hover:border-pink-500/50 hover:shadow-[0_0_30px_rgba(255,110,180,0.15)] transition-all duration-500' : ''}
        ${className}
      `}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 pointer-events-none" />
      <div className="relative z-10" style={{ height: '100%' }}>
        {children}
      </div>
    </div>
  );
}
