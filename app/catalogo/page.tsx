import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'

export const metadata: Metadata = {
    title: 'Catálogo - Ilara Beauty',
    description: 'Descubre nuestros productos de belleza. Haz tu pedido fácilmente por WhatsApp.',
    openGraph: {
        title: 'Catálogo - Ilara Beauty',
        description: 'Descubre nuestros productos de belleza. Haz tu pedido fácilmente por WhatsApp.',
        images: ['/logo_icon.png'],
    },
}

export default function CatalogoPage() {
    return <Catalogo />
}
