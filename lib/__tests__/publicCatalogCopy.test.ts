import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const publicSurfaces = [
  'components/Catalogo/CheckoutPedido.tsx',
  'components/Catalogo/ModalCarrito.tsx',
  'components/Catalogo/ProductoCatalogoRecover.tsx',
  'components/Catalogo/ModalDetalleCombo.tsx',
  'components/Catalogo/CatalogPrice.tsx',
  'lib/domain/payments/labels.ts',
  'lib/domain/shipping/browserShipping.ts',
].map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n')

describe('copy del catálogo público', () => {
  it('no expone detalles técnicos, proveedores ni estados internos', () => {
    const forbiddenCopy = [
      'Calculamos el código postal automáticamente',
      'Origen: Neuquén',
      'Localidades:',
      'OpenStreetMap contributors',
      'El sistema revalida',
      'Total estimado',
      'Tarifa válida por 15 minutos',
      'Solo WhatsApp (sin registrar)',
      'Registramos el pedido',
      'fallo temporal del servidor',
      'Producto #',
      'Envia no pudo',
      'Pedido registrado',
      'Registrando…',
      'Cerrar checkout',
      '>Login<',
      'Acceso al panel',
    ]

    for (const copy of forbiddenCopy) {
      expect(publicSurfaces).not.toContain(copy)
    }
  })
})
