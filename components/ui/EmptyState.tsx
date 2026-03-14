'use client'

import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`
        text-center py-16 px-6 rounded-3xl border-2 border-dashed border-pink-100
        bg-gradient-to-b from-pink-50/50 to-white/80
        ${className}
      `}
    >
      <div className="w-20 h-20 rounded-full bg-white/90 border border-pink-100 shadow-sm flex items-center justify-center mx-auto mb-6 text-pink-400">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      {description && <p className="text-gray-500 max-w-sm mx-auto mb-6">{description}</p>}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}
