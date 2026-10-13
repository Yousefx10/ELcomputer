const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const value = input => typeof input === 'string' ? input : ''
export function productListState(query = {}) {
  const pick = (key, choices) => choices.includes(value(query[key])) ? value(query[key]) : choices[0]
  return {
    q: value(query.q).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120),
    status: pick('status', ['all', 'published', 'drafts']),
    category: uuid.test(value(query.category)) ? value(query.category).toLowerCase() : '',
    brand: uuid.test(value(query.brand)) ? value(query.brand).toLowerCase() : '',
    mode: pick('mode', ['all', 'normal', 'coming_soon', 'preorder']),
    stock: pick('stock', ['all', 'in_stock', 'out_of_stock']),
    sort: pick('sort', ['newest', 'oldest', 'title_asc', 'title_desc', 'price_asc', 'price_desc']),
    page: /^[1-9]\d{0,7}$/.test(value(query.page)) && Number(query.page) <= 40000000 ? Number(query.page) : 1
  }
}
export function productListParams(state) {
  return Object.fromEntries(Object.entries(state).filter(([key, val]) => val && val !== 'all' && !(key === 'sort' && val === 'newest') && !(key === 'page' && Number(val) === 1)).map(([key,val]) => [key, String(val)]))
}
export function productListPath(state) {
  const query = new URLSearchParams(productListParams(state)).toString()
  return '/dashboard/products' + (query ? '?' + query : '')
}
export function productListReturnPath(input) {
  if (typeof input !== 'string' || input.length > 1500 || !/^\/dashboard\/products(?:\?|$)/.test(input)) return '/dashboard/products'
  const query = Object.fromEntries(new URLSearchParams(input.split('?')[1] || ''))
  return productListPath(productListState(query))
}
