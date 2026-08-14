'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, CheckCircle2, History, Plus, RefreshCw, StickyNote, Tags, XCircle } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  addCustomerCrmNote,
  archiveCustomerCrmNote,
  createCustomerCrmTag,
  loadCustomerCrmProfile,
  loadCustomerCrmTags,
  recordCustomerConsent,
  setCustomerCrmTags,
} from '@/lib/domain/customers/browserCustomerCrm'
import type { CustomerCrmProfile, CustomerCrmTag } from '@/lib/domain/customers/crmTypes'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const dateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

export default function CustomerCrmPanel({ customerId }: { customerId: number }) {
  const { showSuccess, showError } = useToast()
  const [profile, setProfile] = useState<CustomerCrmProfile | null>(null)
  const [allTags, setAllTags] = useState<CustomerCrmTag[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set())
  const [note, setNote] = useState('')
  const [tagName, setTagName] = useState('')
  const [consentSource, setConsentSource] = useState('presencial')
  const [consentEvidence, setConsentEvidence] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const [nextProfile, tags] = await Promise.all([
        loadCustomerCrmProfile(customerId),
        loadCustomerCrmTags(),
      ])
      if (current !== requestId.current) return
      setProfile(nextProfile)
      setAllTags(tags)
      setSelectedTags(new Set(nextProfile.tags.map((tag) => tag.id)))
    } catch (cause) {
      if (current === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el CRM.')
      }
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [customerId])

  useEffect(() => { void load() }, [load])

  const tagsChanged = useMemo(() => {
    const original = new Set(profile?.tags.map((tag) => tag.id) ?? [])
    return original.size !== selectedTags.size || [...original].some((id) => !selectedTags.has(id))
  }, [profile, selectedTags])

  const run = async (action: () => Promise<void>, success: string) => {
    if (saving) return
    setSaving(true)
    try {
      await action()
      showSuccess(success)
      await load()
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !profile) {
    return <div className="py-10 grid place-items-center" data-testid="customer-crm-loading"><RefreshCw className="w-5 h-5 text-pink-500 animate-spin" /></div>
  }
  if (error || !profile) {
    return <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4" role="alert"><p className="text-sm text-red-700 dark:text-red-300">{error || 'No se pudo cargar el CRM.'}</p><button type="button" onClick={() => void load()} className="mt-2 text-sm font-bold text-red-700 dark:text-red-300">Reintentar</button></div>
  }

  return (
    <div className="flex flex-col gap-6" data-testid="customer-crm-panel">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-pink-50 dark:bg-pink-950/30 p-3"><p className="text-[10px] uppercase font-bold text-gray-500">Compras</p><p className="font-black text-lg">{profile.metrics.sale_count}</p></div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3"><p className="text-[10px] uppercase font-bold text-gray-500">Neto comprado</p><p className="font-black text-lg">{money.format(profile.metrics.net_spent)}</p></div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3"><p className="text-[10px] uppercase font-bold text-gray-500">Devuelto</p><p className="font-black text-lg">{money.format(profile.metrics.refund_total)}</p></div>
        <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 p-3"><p className="text-[10px] uppercase font-bold text-gray-500">Ticket medio</p><p className="font-black text-lg">{money.format(profile.metrics.average_ticket)}</p></div>
      </div>

      <section aria-labelledby="crm-tags-title">
        <h4 id="crm-tags-title" className="font-extrabold flex items-center gap-2"><Tags className="w-4 h-4 text-pink-500" /> Etiquetas</h4>
        <div className="flex flex-wrap gap-2 mt-3">
          {allTags.map((tag) => {
            const selected = selectedTags.has(tag.id)
            return <button key={tag.id} type="button" aria-pressed={selected} data-testid={`crm-tag-${tag.id}`} onClick={() => setSelectedTags((current) => { const next = new Set(current); if (next.has(tag.id)) next.delete(tag.id); else next.add(tag.id); return next })} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected ? 'text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`} style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color }}>{tag.name}</button>
          })}
          {allTags.length === 0 && <span className="text-xs text-gray-500">Todavía no hay etiquetas.</span>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <input value={tagName} onChange={(event) => setTagName(event.target.value)} maxLength={30} placeholder="Nueva etiqueta" className="form-input rounded-xl px-3 py-2 text-sm flex-1" data-testid="crm-new-tag" />
          <button type="button" disabled={saving || tagName.trim().length < 2} onClick={() => void run(async () => { const created = await createCustomerCrmTag(tagName.trim()); setTagName(''); await setCustomerCrmTags(customerId, [...selectedTags, created.id]) }, 'Etiqueta creada y asignada.')} className="btn-ghost rounded-xl px-3 py-2 text-sm disabled:opacity-50"><Plus className="w-4 h-4" /> Crear</button>
          <button type="button" disabled={saving || !tagsChanged} onClick={() => void run(() => setCustomerCrmTags(customerId, [...selectedTags]), 'Etiquetas actualizadas.')} className="btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50" data-testid="crm-save-tags">Guardar etiquetas</button>
        </div>
      </section>

      <section aria-labelledby="crm-consent-title" className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 id="crm-consent-title" className="font-extrabold">Campañas de marketing</h4>
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${profile.consent.granted ? 'text-emerald-600' : 'text-gray-500'}`} data-testid="crm-consent-status">
            {profile.consent.granted ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {profile.consent.granted ? 'Autorizado' : 'No autorizado'}
          </span>
        </div>
        {profile.consent.created_at && <p className="text-xs text-gray-500 mt-1">Último registro: {dateTime.format(new Date(profile.consent.created_at))} · {profile.consent.source}</p>}
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          <select value={consentSource} onChange={(event) => setConsentSource(event.target.value)} className="form-input rounded-xl px-3 py-2 text-sm" aria-label="Origen del consentimiento">
            <option value="presencial">Presencial</option><option value="whatsapp">WhatsApp</option><option value="web">Web</option><option value="telefono">Teléfono</option><option value="otro">Otro</option>
          </select>
          <input value={consentEvidence} onChange={(event) => setConsentEvidence(event.target.value)} maxLength={500} placeholder="Evidencia o aclaración (opcional)" className="form-input rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" disabled={saving} data-testid="crm-consent-grant" onClick={() => void run(async () => { await recordCustomerConsent(customerId, true, consentSource, consentEvidence); setConsentEvidence('') }, 'Consentimiento registrado.')} className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50">Registrar autorización</button>
          <button type="button" disabled={saving} data-testid="crm-consent-revoke" onClick={() => void run(async () => { await recordCustomerConsent(customerId, false, consentSource, consentEvidence); setConsentEvidence('') }, 'Revocación registrada.')} className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-bold disabled:opacity-50">Registrar rechazo/revocación</button>
        </div>
      </section>

      <section aria-labelledby="crm-notes-title">
        <h4 id="crm-notes-title" className="font-extrabold flex items-center gap-2"><StickyNote className="w-4 h-4 text-pink-500" /> Notas internas</h4>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Información útil para próximas atenciones…" className="form-input rounded-xl p-3 text-sm w-full mt-3" data-testid="crm-note-input" />
        <div className="flex justify-end mt-2"><button type="button" disabled={saving || !note.trim()} onClick={() => void run(async () => { await addCustomerCrmNote(customerId, note.trim()); setNote('') }, 'Nota agregada.')} className="btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50" data-testid="crm-add-note">Agregar nota</button></div>
        <ul className="space-y-2 mt-3">
          {profile.notes.map((item) => <li key={item.id} data-testid={`crm-note-${item.id}`} className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3 flex gap-3 justify-between"><div><p className="text-sm whitespace-pre-wrap break-words">{item.body}</p><p className="text-[11px] text-gray-500 mt-1">{dateTime.format(new Date(item.created_at))}</p></div><button type="button" disabled={saving} onClick={() => void run(() => archiveCustomerCrmNote(item.id), 'Nota archivada.')} className="p-2 self-start text-gray-400 hover:text-red-500" aria-label="Archivar nota"><Archive className="w-4 h-4" /></button></li>)}
          {profile.notes.length === 0 && <li className="text-xs text-gray-500">Sin notas internas.</li>}
        </ul>
      </section>

      <section aria-labelledby="crm-history-title">
        <h4 id="crm-history-title" className="font-extrabold flex items-center gap-2"><History className="w-4 h-4 text-pink-500" /> Historial unificado</h4>
        <ul className="space-y-2 mt-3" data-testid="crm-activity">
          {profile.activity.map((event) => <li key={event.id} className="rounded-xl border border-gray-100 dark:border-gray-700 px-3 py-2 flex justify-between gap-3 text-sm"><div><p className="font-bold">{event.type === 'sale' ? `Venta #${event.sale_id}` : `Devolución NC-${String(event.credit_note_number || '').padStart(6, '0')}`}</p><p className="text-xs text-gray-500">{dateTime.format(new Date(event.event_at))}{event.reason ? ` · ${event.reason}` : ''}</p></div><span className={`font-black shrink-0 ${event.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money.format(event.amount)}</span></li>)}
          {profile.activity.length === 0 && <li className="text-xs text-gray-500">Sin actividad registrada.</li>}
        </ul>
      </section>
    </div>
  )
}
