export const catalogWindowPages = 20
export const catalogCacheKey = (path, query = {}, locale = 'en') => JSON.stringify([locale, path, Object.entries(query).sort(([a], [b]) => a.localeCompare(b))])
export function appendCatalogPage(current, next) {
  if (!next || next.page !== current.page + 1 || !Array.isArray(next.products) || next.products.length > 12
    || !Number.isInteger(next.pages) || next.pages < next.page || next.products.some(row => !row?.id || !row.slug)) throw Error('Invalid catalog page')
  const ids = new Set(current.products.map(row => row.id))
  return { ...next, products: [...current.products, ...next.products.filter(row => { if (ids.has(row.id)) return false; ids.add(row.id); return true })] }
}
