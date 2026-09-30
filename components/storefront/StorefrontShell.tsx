import type { ReactNode } from 'react'
import { StorefrontFooter } from './StorefrontFooter'
import styles from './storefront.module.css'

type Props = {
  children: ReactNode
  header?: ReactNode
  footer?: boolean
}

export function StorefrontShell({ children, header, footer = true }: Props) {
  return (
    <div className={`storefront ${styles.root}`}>
      {header}
      {children}
      {footer ? <StorefrontFooter /> : null}
    </div>
  )
}
