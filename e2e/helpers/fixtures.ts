/**
 * Helpers E2E Stage 4 — datos aislados y limpieza determinista.
 *
 * En CI: E2E_SUPABASE_URL + keys obligatorias (fail, no skip).
 * Local sin config: requireE2E() → skip explícito.
 * Mutaciones: solo loopback (ver urlGuard.ts).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { test } from '@playwright/test'
import { assertAllowedE2ESupabaseUrl } from './urlGuard'

export { isAllowedE2ESupabaseUrl, assertAllowedE2ESupabaseUrl } from './urlGuard'

export function e2eSupabaseConfigured(): boolean {
  const url = process.env.E2E_SUPABASE_URL?.trim()
  const service = process.env.E2E_SERVICE_ROLE_KEY?.trim()
  const anon = process.env.E2E_ANON_KEY?.trim()
  // No usar NEXT_PUBLIC_* : evita .env.local de producción
  return Boolean(url && service && anon)
}

/** @deprecated usar assertAllowedE2ESupabaseUrl — se mantiene el nombre por compat. */
export function assertNotProduction(url: string): void {
  assertAllowedE2ESupabaseUrl(url)
}

/** En CI sin config → fail. Local sin config → skip. */
export function requireE2E(): void {
  if (e2eSupabaseConfigured()) {
    assertAllowedE2ESupabaseUrl(process.env.E2E_SUPABASE_URL!.trim())
    return
  }
  if (process.env.CI) {
    throw new Error(
      'CI E2E requiere E2E_SUPABASE_URL, E2E_ANON_KEY y E2E_SERVICE_ROLE_KEY (Supabase local del runner).'
    )
  }
  test.skip(true, 'Requiere E2E_SUPABASE_URL + E2E_ANON_KEY + E2E_SERVICE_ROLE_KEY (local)')
}

export function getE2EEnv() {
  const url = (process.env.E2E_SUPABASE_URL || '').trim()
  const service = (process.env.E2E_SERVICE_ROLE_KEY || '').trim()
  const anon = (process.env.E2E_ANON_KEY || '').trim()
  const email = (process.env.E2E_USER_EMAIL || 'e2e-admin@example.com').trim()
  const password = (process.env.E2E_USER_PASSWORD || 'E2E-Test-Pass-A1!').trim()
  return { url, service, anon, email, password }
}

export function serviceClient(): SupabaseClient {
  const { url, service } = getE2EEnv()
  if (!url || !service) throw new Error('E2E service client missing env')
  assertAllowedE2ESupabaseUrl(url)
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function anonClient(): SupabaseClient {
  const { url, anon } = getE2EEnv()
  if (!url || !anon) throw new Error('E2E anon client missing env')
  assertAllowedE2ESupabaseUrl(url)
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function ensureE2EAdmin(): Promise<{ email: string; password: string }> {
  const { email, password } = getE2EEnv()
  const admin = serviceClient()
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) throw list.error
  let user = (list.data?.users || []).find((u) => u.email === email)
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (created.error) throw created.error
    user = created.data.user
  }
  const boot = await admin.rpc('bootstrap_first_admin', { p_user_id: user!.id })
  if (boot.error) {
    const upsert = await admin.from('user_roles').upsert(
      { user_id: user!.id, role: 'admin', updated_by: user!.id },
      { onConflict: 'user_id' }
    )
    if (upsert.error) {
      throw new Error(
        `No se pudo asignar rol admin E2E: ${boot.error.message || upsert.error.message}`
      )
    }
  }
  return { email, password }
}

export async function seedCatalogProduct(): Promise<{ id: number; name: string }> {
  const admin = serviceClient()
  const name = `E2E Product ${Date.now()}`
  const { data: cat } = await admin
    .from('categories')
    .select('id')
    .limit(1)
    .maybeSingle()
  let categoryId = cat?.id as number | undefined
  if (!categoryId) {
    const ins = await admin.from('categories').insert({ name: 'E2E Cat' }).select('id').single()
    if (ins.error) throw ins.error
    categoryId = ins.data.id
  }
  const { data, error } = await admin
    .from('products')
    .insert({
      name,
      category_id: categoryId,
      brand: 'E2E',
      sale_price: 2500,
      purchase_price: 1000,
      stock: 20,
      min_stock: 1,
      visible_in_catalog: true,
      discount_percentage: 0,
    })
    .select('id, name')
    .single()
  if (error) throw error
  return { id: data.id as number, name: data.name as string }
}

export async function cleanupProduct(id: number): Promise<void> {
  const admin = serviceClient()
  const { error } = await admin.from('products').delete().eq('id', id)
  if (error) {
    if (process.env.CI) throw error
    // No loguear cuerpos de error (pueden incluir contexto de red)
    console.warn('cleanupProduct failed')
  }
}

export async function seedCoupon(): Promise<{ id: number; code: string }> {
  const admin = serviceClient()
  const code = `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`
  const { data, error } = await admin
    .from('coupons')
    .insert({
      code,
      discount_percentage: 10,
      is_active: true,
    })
    .select('id, code')
    .single()
  if (error) throw error
  return { id: data.id as number, code: data.code as string }
}

export async function cleanupCoupon(id: number): Promise<void> {
  const admin = serviceClient()
  const { error } = await admin.from('coupons').delete().eq('id', id)
  if (error && process.env.CI) throw error
}

export async function seedCustomer(): Promise<{ id: number; label: string }> {
  const admin = serviceClient()
  const stamp = Date.now()
  const first_name = 'E2E'
  const last_name = `BulkMut${stamp}`
  const { data, error } = await admin
    .from('customers')
    .insert({ first_name, last_name, email: null, phone: null })
    .select('id, first_name, last_name')
    .single()
  if (error) throw error
  return {
    id: data.id as number,
    label: `${data.first_name} ${data.last_name}`.trim(),
  }
}

export async function cleanupCustomer(id: number): Promise<void> {
  const admin = serviceClient()
  const { error } = await admin.from('customers').delete().eq('id', id)
  if (error) {
    if (process.env.CI) throw error
    console.warn('cleanupCustomer failed')
  }
}

export async function seedExpense(userId: string): Promise<{ id: number; description: string }> {
  const admin = serviceClient()
  const description = `E2E gasto mut ${Date.now()}`
  const { data, error } = await admin
    .from('expenses')
    .insert({
      date: new Date().toISOString().slice(0, 10),
      category: 'otros',
      description,
      amount: 100,
      payment_method: 'efectivo',
      user_id: userId,
    })
    .select('id, description')
    .single()
  if (error) throw error
  return { id: data.id as number, description: data.description as string }
}

export async function cleanupExpense(id: number): Promise<void> {
  const admin = serviceClient()
  const { error } = await admin.from('expenses').delete().eq('id', id)
  if (error) {
    if (process.env.CI) throw error
    console.warn('cleanupExpense failed')
  }
}

/** user_id del admin E2E (para filas con RLS por user). */
export async function resolveE2EAdminUserId(): Promise<string> {
  const { email } = getE2EEnv()
  const admin = serviceClient()
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) throw list.error
  const user = (list.data?.users || []).find((u) => u.email === email)
  if (!user) throw new Error('E2E admin user missing after ensureE2EAdmin')
  return user.id
}
