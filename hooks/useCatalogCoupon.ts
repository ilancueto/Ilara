'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { validarCuponCatalogo } from '@/app/actions/coupons'
type Coupon = { code: string; discount_percentage: number }
const KEY = 'ilara-coupon'

/** Recover by code only: the discount is always revalidated by the server. */
export function useCatalogCoupon() {
  const [appliedCoupon, setCoupon] = useState<Coupon | null>(null)
  const revision = useRef(0)
  useEffect(() => {
    let cancelled = false
    const initialRevision = revision.current
    try {
      const code = sessionStorage.getItem(KEY)
      if (code) void validarCuponCatalogo(code).then(result => {
        if (!cancelled && revision.current === initialRevision && result.ok)
          setCoupon({ code, discount_percentage: result.discount_percentage })
      }).catch(() => { /* No discount is applied when validation is unavailable. */ })
    } catch { /* Storage is optional. */ }
    return () => { cancelled = true }
  }, [])
  const setAppliedCoupon = useCallback((coupon: Coupon | null) => {
    revision.current += 1
    setCoupon(coupon)
    try {
      if (coupon) sessionStorage.setItem(KEY, coupon.code)
      else sessionStorage.removeItem(KEY)
    } catch { /* The current page remains usable without persistence. */ }
  }, [])
  return { appliedCoupon, setAppliedCoupon }
}
