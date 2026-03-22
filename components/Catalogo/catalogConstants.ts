/** Paginación del grid del catálogo público */
export const PRODUCTOS_POR_PAGINA = 15

/** Orden inicial: más recientes arriba */
export const ORDEN_DEFAULT = 'nuevo-desc'

export const ORDEN_OPTIONS: { value: string; label: string }[] = [
    { value: 'nuevo-desc', label: 'Más nuevo primero' },
    { value: 'nuevo-asc', label: 'Más viejo primero' },
    { value: 'nombre-asc', label: 'Nombre (A-Z)' },
    { value: 'nombre-desc', label: 'Nombre (Z-A)' },
    { value: 'vendidos-desc', label: 'Más vendidos' },
    { value: 'precio-asc', label: 'Precio: menor a mayor' },
    { value: 'precio-desc', label: 'Precio: mayor a menor' },
]
