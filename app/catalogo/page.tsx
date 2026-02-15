import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'

const ogImageUrl = 'https://raw.githubusercontent.com/ilancueto/Ilara/main/public/logo_icon.png';

export const metadata: Metadata = {
    title: 'Catálogo - Ilara Beauty',
    description: 'Descubre nuestros productos de belleza. Haz tu pedido fácilmente por WhatsApp.',
    openGraph: {
        title: 'Catálogo - Ilara Beauty',
        description: 'Descubre nuestros productos de belleza. Haz tu pedido fácilmente por WhatsApp.',
        images: [ogImageUrl],
    },
}

export default function CatalogoPage() {
    return <Catalogo />
}
