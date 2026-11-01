import { CATALOG_PAGE_SIZE, CATALOG_SORT_DEFAULT } from '@/lib/domain/catalog/catalogView'

/** Paginación del grid del catálogo público */
export const PRODUCTOS_POR_PAGINA = CATALOG_PAGE_SIZE

/** Orden inicial: más vendidos (ver CATALOG_SORT_DEFAULT). */
export const ORDEN_DEFAULT = CATALOG_SORT_DEFAULT

export const ORDEN_OPTIONS: { value: string; label: string }[] = [
    { value: 'vendidos-desc', label: 'Más vendidos' },
    { value: 'nuevo-desc', label: 'Más nuevo primero' },
    { value: 'nuevo-asc', label: 'Más viejo primero' },
    { value: 'nombre-asc', label: 'Nombre (A-Z)' },
    { value: 'nombre-desc', label: 'Nombre (Z-A)' },
    { value: 'precio-asc', label: 'Precio: menor a mayor' },
    { value: 'precio-desc', label: 'Precio: mayor a menor' },
]
