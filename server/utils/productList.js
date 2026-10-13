import { createError } from 'h3'

const enums = {
  status: ['all', 'published', 'drafts'],
  mode: ['all', 'normal', 'coming_soon', 'preorder'],
  stock: ['all', 'in_stock', 'out_of_stock'],
  sort: ['newest', 'oldest', 'title_asc', 'title_desc', 'price_asc', 'price_desc']
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const invalid = () => { throw createError({ statusCode: 400, statusMessage: 'Product filters are invalid.' }) }

export function productListQuery(query = {}) {
  if (Object.keys(query).some(key => !['q', 'category', 'brand', 'page', ...Object.keys(enums)].includes(key))) invalid()
  if (Object.values(query).some(value => typeof value !== 'string')) invalid()
  const q = (query.q || '').trim()
  if (q.length > 120 || /[\u0000-\u001f\u007f]/.test(q)) invalid()
  const result = { q }
  for (const [key, options] of Object.entries(enums)) {
    result[key] = query[key] || options[0]
    if (!options.includes(result[key])) invalid()
  }
  for (const key of ['category', 'brand']) {
    result[key] = query[key] || null
    if (result[key] && !uuid.test(result[key])) invalid()
    if (result[key]) result[key] = result[key].toLowerCase()
  }
  if (query.page && (!/^[1-9]\d{0,7}$/.test(query.page) || Number(query.page) > 40000000)) invalid()
  result.page = Number(query.page || 1)
  return result
}

export function throwProductListError(error) {
  const statusCode = error?.code === '42501' ? 403 : error?.code === '22023' ? 400 : 503
  throw createError({ statusCode, statusMessage: statusCode === 403
    ? 'You do not have access to products.' : statusCode === 400
      ? 'Product filters are invalid.' : 'Could not load products. Try again.' })
}
