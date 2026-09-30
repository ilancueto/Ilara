/** Read every public row even when the Data API caps a response below our page size. */
export async function readAllCatalogRows<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: unknown
    count: number | null
  }>,
): Promise<{ data: T[]; error: null } | { data: null; error: unknown }> {
  const rows: T[] = []
  const pageSize = 200
  for (;;) {
    const result = await page(rows.length, rows.length + pageSize - 1)
    if (result.error) return { data: null, error: result.error }
    if (result.count == null || !result.data) {
      return { data: null, error: new Error('catalog_count_unavailable') }
    }
    rows.push(...result.data)
    if (rows.length >= result.count) return { data: rows, error: null }
    if (result.data.length === 0) {
      return { data: null, error: new Error('catalog_incomplete_response') }
    }
  }
}
