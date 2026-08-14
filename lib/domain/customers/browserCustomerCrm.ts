'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { customerCrmError, mapCustomerCrmProfile, mapCustomerCrmTag } from './crmMappers'
import type { CustomerCrmProfile, CustomerCrmTag } from './crmTypes'

const fail = (message?: string) => { throw customerCrmError(message || '') }

export async function loadCustomerCrmProfile(customerId: number): Promise<CustomerCrmProfile> {
  const { data, error } = await getBrowserSupabase().rpc('customer_crm_profile', { p_customer_id: customerId })
  if (error) fail(error.message)
  return mapCustomerCrmProfile(data)
}

export async function loadCustomerCrmTags(): Promise<CustomerCrmTag[]> {
  const { data, error } = await getBrowserSupabase().rpc('customer_crm_tags')
  if (error) fail(error.message)
  return (Array.isArray(data) ? data : []).map(mapCustomerCrmTag)
}

export async function createCustomerCrmTag(name: string, color = '#ec4899') {
  const { data, error } = await getBrowserSupabase().rpc('customer_crm_upsert_tag', {
    p_id: null, p_name: name, p_color: color,
  })
  if (error) fail(error.message)
  return mapCustomerCrmTag(data)
}

export async function setCustomerCrmTags(customerId: number, tagIds: number[]) {
  const { error } = await getBrowserSupabase().rpc('customer_crm_set_tags', {
    p_customer_id: customerId, p_tag_ids: tagIds,
  })
  if (error) fail(error.message)
}

export async function addCustomerCrmNote(customerId: number, body: string) {
  const { error } = await getBrowserSupabase().rpc('customer_crm_add_note', {
    p_customer_id: customerId, p_body: body,
  })
  if (error) fail(error.message)
}

export async function archiveCustomerCrmNote(noteId: number) {
  const { error } = await getBrowserSupabase().rpc('customer_crm_archive_note', { p_note_id: noteId })
  if (error) fail(error.message)
}

export async function recordCustomerConsent(
  customerId: number,
  granted: boolean,
  source: string,
  evidenceNote: string
) {
  const { error } = await getBrowserSupabase().rpc('customer_crm_record_consent', {
    p_customer_id: customerId,
    p_granted: granted,
    p_source: source,
    p_evidence_note: evidenceNote || null,
  })
  if (error) fail(error.message)
}
