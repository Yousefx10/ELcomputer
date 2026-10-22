import test from 'node:test'
import assert from 'node:assert/strict'
import { FAVORITES_KEY, favoriteIds, setFavorite, accountFavoriteSession, persistAccountFavorites, shareProduct, packageEntryValue, parsePackageEntry, curatedProductTags, productContact } from '../app/utils/productFinishing.js'
import { canonicalUrl } from '../app/utils/seo.js'
import { premiumSpecificationContent } from '../app/utils/productPage.js'
const id = '12345678-1234-4234-8234-123456789abc', other = '22345678-1234-4234-8234-123456789abc'

test('favorites bound IDs and preserve explicit saved/removed intent', () => {
  assert.deepEqual(favoriteIds([id, id.toUpperCase(), null, 'draft-title']), [id])
  assert.deepEqual(setFavorite([id], other, true), [id, other])
  assert.deepEqual(setFavorite([id], id, true), [id])
  assert.deepEqual(setFavorite([id, other], id, false), [other])
  assert.throws(() => setFavorite([], 'private-data', true))
  const list = Array.from({ length: 100 }, (_, i) => `${String(i).padStart(8, '0')}-1234-4234-8234-123456789abc`)
  assert.throws(() => setFavorite(list, id, true), /limit/)
  assert.equal(setFavorite(list, list[0], false).length, 99)
})
test('account favorites require the exact non-anonymous identity and fresh Auth state', async () => {
  let tokenUsed
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'frozen', user: { id } } } }), getUser: async token => { tokenUsed = token; return { data: { user: { id, user_metadata: { [FAVORITES_KEY]: [other] } } } } } } }
  assert.deepEqual(await accountFavoriteSession(client, id), { token: 'frozen', ids: [other] })
  assert.equal(tokenUsed, 'frozen')
  await assert.rejects(accountFavoriteSession(client, other), /account/)
  client.auth.getUser = async () => ({ data: { user: { id, is_anonymous: true } } })
  await assert.rejects(accountFavoriteSession(client, id), /account/)
})
test('account writes freeze bearer, patch only one private preference and verify acknowledgement', async () => {
  const request = async (url, options) => {
    assert.equal(url, 'https://configured.example/auth/v1/user')
    assert.equal(options.headers.Authorization, 'Bearer original-account-token')
    assert.equal(options.retry, 0)
    assert.deepEqual(options.body, { data: { [FAVORITES_KEY]: [id] } })
    return { id: other, user_metadata: { [FAVORITES_KEY]: [id] } }
  }
  await assert.rejects(persistAccountFavorites(request, { url: 'https://configured.example/', key: 'public' }, 'original-account-token', id, [id]), /account/)
  await persistAccountFavorites(async () => ({ id, user_metadata: { full_name: 'Unchanged', [FAVORITES_KEY]: [id] } }), { url: 'https://configured.example', key: 'public' }, 'token', id, [id])
})
test('sharing uses localized canonical paths, no query, with native/copy/cancel/error feedback', async () => {
  const url = canonicalUrl('https://shop.example', '/products/real-product', 'ar'), data = { title: 'Authored title', url }
  assert.equal(url, 'https://shop.example/ar/products/real-product')
  let copied = ''
  assert.equal(await shareProduct(data, { share: async value => assert.deepEqual(value, data) }), 'shared')
  assert.equal(await shareProduct(data, { share: async () => { throw Error('denied') }, clipboard: { writeText: async value => { copied = value } } }), 'copied')
  assert.equal(copied, url)
  assert.equal(await shareProduct(data, { share: async () => { throw Object.assign(Error(), { name: 'AbortError' }) } }), 'cancelled')
  await assert.rejects(shareProduct(data, {}))
  await assert.rejects(shareProduct({ ...data, url: 'javascript:alert(1)' }, {}))
})
test('package controls round-trip authored names and quantities without inferring legacy contents', () => {
  assert.equal(packageEntryValue(' Cable ', '2'), '2 × Cable')
  assert.deepEqual(parsePackageEntry('2 × Cable'), { name: 'Cable', quantity: 2 })
  for (const value of ['Mouse\nCable', 'Cable', '0 × Cable']) assert.equal(parsePackageEntry(value), null)
  for (const [name, quantity] of [['', 1], ['Cable', 0], ['Cable', 1000], ['Cable', 1.5], ['Cable\nMouse', 1]]) assert.equal(packageEntryValue(name, quantity), '')
  const content = premiumSpecificationContent([{ id, label: 'Box contents', value: '2 × Cable' }, { label: 'Compatibility', value: 'Windows' }])
  assert.equal(content.included.length, 1)
  assert.equal(content.groups[0].items[0].value, 'Windows')
  assert.equal(premiumSpecificationContent([]).included.length, 0)
})
test('tags and support use bounded authored values and validated existing contact settings', () => {
  assert.deepEqual(curatedProductTags([{ label: 'Tags', value: 'USB-C, Wired\nUSB-C' }, { label: 'Popularity', value: 'Invented' }]), ['USB-C', 'Wired'])
  assert.deepEqual(curatedProductTags([]), [])
  assert.deepEqual(productContact({ footer_email: 'support@example.test', footer_phone: '+20 (123) 456-789' }), { email: 'support@example.test', phone: '+20 (123) 456-789' })
  assert.deepEqual(productContact({ footer_email: 'a@example.test?bcc=secret', footer_phone: 'javascript:evil' }), { email: '', phone: '' })
  assert.deepEqual(productContact({ footer_modern_config: { support: { enabled: true, url: 'tel:+20123456789' } } }), { email: '', phone: '+20123456789' })
  assert.deepEqual(productContact({ footer_modern_config: { support: { enabled: false, url: 'mailto:a@example.test' } } }), { email: '', phone: '' })
  assert.deepEqual(productContact({ footer_phone: '-----' }), { email: '', phone: '' })
})
