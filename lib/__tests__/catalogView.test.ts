import { describe, expect, it } from 'vitest'
import {
  CATALOG_PAGE_MAX,
  CATALOG_SORT_DEFAULT,
  CATALOG_VIEW_DEFAULT,
  catalogNormalizeRedirectPath,
  catalogViewPath,
  isCatalogViewIndexable,
  parseCatalogView,
  serializeCatalogView,
} from '../domain/catalog/catalogView'

describe('vista de catálogo en URL', () => {
  it('usa valores por defecto y rechaza orden o página inválidos', () => {
    expect(parseCatalogView({})).toEqual(CATALOG_VIEW_DEFAULT)
    expect(parseCatalogView({ sort: 'recomendados', page: '0', min: '-3' })).toEqual(CATALOG_VIEW_DEFAULT)
    expect(parseCatalogView({ sort: 'precio-asc', page: '2', q: 'bálsamo', cat: '12' })).toEqual({
      q: 'bálsamo',
      cat: '12',
      sort: 'precio-asc',
      page: 2,
      min: 0,
      max: 999999,
    })
  })

  it('serializa sólo parámetros distintos del default', () => {
    expect(serializeCatalogView(CATALOG_VIEW_DEFAULT)).toBe('')
    expect(serializeCatalogView({
      ...CATALOG_VIEW_DEFAULT,
      q: 'kit',
      cat: 'combos',
      sort: CATALOG_SORT_DEFAULT,
      page: 1,
    })).toBe('q=kit&cat=combos')
  })

  it('toma el primer valor si el parámetro está repetido', () => {
    expect(parseCatalogView({ page: ['2', '9'], q: ['labial', 'otro'] })).toMatchObject({
      page: 2,
      q: 'labial',
    })
    expect(catalogNormalizeRedirectPath({ page: ['2', '9'] })).toBeNull()
  })

  it('normaliza página 1 e sort inválido hacia la URL canónica', () => {
    expect(catalogNormalizeRedirectPath({ page: '1' })).toBe('/catalogo')
    expect(catalogNormalizeRedirectPath({ sort: 'nope' })).toBe('/catalogo')
    expect(catalogNormalizeRedirectPath({ page: '2' })).toBeNull()
    expect(catalogViewPath({ ...CATALOG_VIEW_DEFAULT, page: 2 })).toBe('/catalogo?page=2')
  })

  it('indexa el listado por defecto y la paginación, no la búsqueda ni filtros', () => {
    expect(isCatalogViewIndexable(CATALOG_VIEW_DEFAULT)).toBe(true)
    expect(isCatalogViewIndexable({ ...CATALOG_VIEW_DEFAULT, page: 2 })).toBe(true)
    expect(isCatalogViewIndexable({ ...CATALOG_VIEW_DEFAULT, q: 'labial' })).toBe(false)
    expect(isCatalogViewIndexable({ ...CATALOG_VIEW_DEFAULT, cat: '12' })).toBe(false)
    expect(isCatalogViewIndexable({ ...CATALOG_VIEW_DEFAULT, sort: 'precio-asc' })).toBe(false)
    expect(isCatalogViewIndexable({ ...CATALOG_VIEW_DEFAULT, min: 1000 })).toBe(false)
  })

  it('no interpreta páginas enormes como página 1', () => {
    expect(parseCatalogView({ page: '9999' }).page).toBeGreaterThan(CATALOG_PAGE_MAX)
  })
})
