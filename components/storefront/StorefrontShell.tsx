import type { ReactNode } from 'react'
import { StorefrontFooter } from './StorefrontFooter'
import styles from './storefront.module.css'
import { buildIlaraOrganization } from '@/lib/storefrontIdentity'
import { getShareSiteOrigin } from '@/lib/site'
import { serializeJsonLd } from '@/lib/security/serializeJsonLd'

type Props = {
  children: ReactNode
  header?: ReactNode
  footer?: boolean
}

export function StorefrontShell({ children, header, footer = true }: Props) {
  return (
    <div className={`storefront ${styles.root}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildIlaraOrganization(getShareSiteOrigin())) }} />
      {header}
      {children}
      {footer ? <StorefrontFooter /> : null}
    </div>
  )
}
