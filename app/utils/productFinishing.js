// Authored merchandising values only. No catalog inference or generated claims.
const key = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const label = row => row.definition?.name || row.label || ''
export const isProductTag = row => ['tags', 'producttags', 'وسوم', 'وسومالمنتج'].includes(key(label(row)))
export const isPackageEntry = row => ['boxcontents', 'محتوياتالصندوق'].includes(key(label(row))) && !!parsePackageEntry(row.value)
export function parsePackageEntry(value) {
  const match = String(value || '').match(/^([1-9]\d{0,2}) × (.+)$/u)
  return match && match[2].trim() ? { quantity: Number(match[1]), name: match[2].trim() } : null
}
export function packageEntryValue(name, quantity) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 160 || /[\r\n]/u.test(name) || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 999) return ''
  return `${Number(quantity)} × ${name.trim()}`
}
export function curatedProductTags(rows) {
  return [...new Set(rows.filter(isProductTag).flatMap(row => String(row.value || '').split(/[\n,،]/u)).map(value => value.trim()).filter(value => value && value.length <= 64))].slice(0, 12)
}
export const FAVORITES_KEY = 'storefront_favorites_v1'
export const FAVORITES_LIMIT = 100
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const favoriteIds = value => [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === 'string' && uuid.test(id)).map(id => id.toLowerCase()))].slice(0, FAVORITES_LIMIT)
export function setFavorite(ids, productId, saved) {
  const current = favoriteIds(ids), id = String(productId || '').toLowerCase()
  if (!uuid.test(id)) throw new Error('invalid')
  if (!saved) return current.filter(value => value !== id)
  if (!current.includes(id) && current.length >= FAVORITES_LIMIT) throw new Error('limit')
  return current.includes(id) ? current : [...current, id]
}
export async function accountFavoriteSession(client, expected) {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session?.access_token || data.session.user?.id !== expected || data.session.user?.is_anonymous) throw new Error('account')
  const token = data.session.access_token, result = await client.auth.getUser(token)
  if (result.error || result.data.user?.id !== expected || result.data.user?.is_anonymous) throw new Error('account')
  return { token, ids: favoriteIds(result.data.user.user_metadata?.[FAVORITES_KEY]) }
}
export async function persistAccountFavorites(request, config, token, expected, ids) {
  const url = config?.url, apikey = config?.key
  if (!url || !apikey) throw new Error('account')
  const result = await request(`${url.replace(/\/$/u, '')}/auth/v1/user`, {
    method: 'PUT', retry: 0, timeout: 15000,
    headers: { apikey, Authorization: `Bearer ${token}` }, body: { data: { [FAVORITES_KEY]: ids } }
  })
  if (result.id !== expected || JSON.stringify(favoriteIds(result.user_metadata?.[FAVORITES_KEY])) !== JSON.stringify(ids)) throw new Error('account')
}
export function productContact(settings = {}) {
  const support = settings.footer_modern_config?.support
  const configured = support?.enabled !== false && typeof support?.url === 'string' ? support.url.trim() : ''
  const email = String(settings.footer_email || (configured.startsWith('mailto:') ? configured.slice(7) : '')).trim()
  const phone = String(settings.footer_phone || (configured.startsWith('tel:') ? configured.slice(4) : '')).trim()
  return {
    email: /^[^\s@<>?&#]+@[^\s@<>?&#]+\.[^\s@<>?&#]+$/u.test(email) ? email : '',
    phone: /^\+?[\d ()-]{5,35}$/u.test(phone) && phone.replace(/\D/g, '').length >= 5 ? phone : ''
  }
}
export async function shareProduct({ title, url }, browser) {
  if (!url || !/^https?:\/\//u.test(url)) throw new Error('unavailable')
  if (typeof browser.share === 'function') {
    try { await browser.share({ title, url }); return 'shared' }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled' }
  }
  if (!browser.clipboard?.writeText) throw new Error('unavailable')
  await browser.clipboard.writeText(url)
  return 'copied'
}
