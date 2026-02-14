import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'

export const metadata: Metadata = {
    title: 'Catálogo - Ilara Beauty',
    description: 'Descubre nuestros productos de belleza. Haz tu pedido fácilmente por WhatsApp.',
}

export default function CatalogoPage() {
    return <Catalogo />
}
