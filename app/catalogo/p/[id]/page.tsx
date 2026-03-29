import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchCatalogProductByIdServer } from '@/lib/catalog/serverCatalog'
import { ProductoPublicoClient } from '@/components/Catalogo/ProductoPublicoClient'
import { ProductoCatalogoRecover } from '@/components/Catalogo/ProductoCatalogoRecover'
import { getSiteUrl } from '@/lib/site'

export const revalidate = 120

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id: raw } = await params
    const id = parseInt(raw, 10)
    if (!Number.isFinite(id)) return { title: 'Producto' }

    const supabase = await createSupabaseServerClient()
    const res = await fetchCatalogProductByIdServer(supabase, id)
    if (res.status === 'error') return { title: 'Producto' }
    if (res.status === 'not_found') return { title: 'Producto no encontrado' }
    const p = res.product

    const base = getSiteUrl().replace(/\/$/, '')
    const canonical = `/catalogo/p/${id}`
    const desc =
        (p.notes && p.notes.trim().slice(0, 160)) ||
        `${p.name} — Belleza y cosmética en Neuquén. Pedidos por WhatsApp en Ilara Beauty.`

    return {
        title: p.name,
        description: desc,
        alternates: { canonical },
        openGraph: {
            title: `${p.name} | Ilara`,
            description: desc,
            url: `${base}${canonical}`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${p.name} | Ilara`,
            description: desc,
        },
    }
}

export default async function CatalogoProductoPage({ params }: PageProps) {
    const { id: raw } = await params
    const id = parseInt(raw, 10)
    if (!Number.isFinite(id)) notFound()

    const supabase = await createSupabaseServerClient()
    const res = await fetchCatalogProductByIdServer(supabase, id)
    if (res.status === 'error') {
        return <ProductoCatalogoRecover id={id} canonicalPath={`/catalogo/p/${id}`} />
    }
    if (res.status === 'not_found') notFound()

    return <ProductoPublicoClient producto={res.product} canonicalPath={`/catalogo/p/${id}`} />
}
