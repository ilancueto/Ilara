import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Easter claim no configurado (falta SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 503 }
    )
  }

  let body: { deviceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : ''
  if (!deviceId || deviceId.length > 128) {
    return NextResponse.json({ error: 'deviceId requerido' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: existing } = await supabase
    .from('easter_claims')
    .select('coupon_code')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      alreadyClaimed: true,
      code: existing.coupon_code,
    })
  }

  const code = `EASTER-${randomCode()}`

  const { error: errCoupon } = await supabase.from('coupons').insert({
    code,
    discount_percentage: 10,
    is_active: true,
  })

  if (errCoupon) {
    return NextResponse.json(
      { error: 'No se pudo crear el cupón' },
      { status: 500 }
    )
  }

  const { error: errClaim } = await supabase.from('easter_claims').insert({
    device_id: deviceId,
    coupon_code: code,
  })

  if (errClaim) {
    return NextResponse.json(
      { error: 'No se pudo registrar el claim' },
      { status: 500 }
    )
  }

  return NextResponse.json({ code, alreadyClaimed: false })
}
