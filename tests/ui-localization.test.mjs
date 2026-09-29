import { buildOrderPackingDocumentsHtml } from '../app/utils/orderPackingPrint.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createI18n } from 'vue-i18n'
import { baseCompile } from '@intlify/message-compiler'
import { localizedPath, stripLocalePrefix, normalizeTheme, resolveThemeLogos, formatLocale } from '../app/utils/appearance.js'
import { formatAccountMoney } from '../app/utils/accountOrders.js'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const en = JSON.parse(read('i18n/locales/en.json')), ar = JSON.parse(read('i18n/locales/ar.json'))
const flatten = (object, prefix = '') => Object.fromEntries(Object.entries(object).flatMap(([key, value]) => typeof value === 'object' ? Object.entries(flatten(value, prefix + key + '.')) : [[prefix + key, value]]))

test('all Arabic UI keys compile and preserve interpolation parameters', () => {
  const english = flatten(en), arabic = flatten(ar)
  assert.deepEqual(Object.keys(arabic).sort(), Object.keys(english).sort())
  for (const key of Object.keys(english)) assert.ok(key.split('.').every(Boolean), `Invalid translation path: ${key}`)
  for (const file of readdirSync(new URL('../app/', import.meta.url), { recursive: true }).filter(file => /\.(vue|js|ts)$/.test(file))) {
    for (const match of read(`app/${file}`).matchAll(/(?:\$t|uiText)\(['"]([^'"]+)['"]/g)) {
      assert.equal(typeof english[match[1]], 'string', `Missing UI key ${match[1]} in ${file}`)
    }
  }
  for (const key of Object.values(JSON.parse(read('app/utils/uiMessageKeys.json')))) assert.equal(typeof english[key], 'string', key)
  for (const { key } of JSON.parse(read('app/utils/uiMessagePatterns.json'))) assert.equal(typeof english[key], 'string', key)
  for (const [key, value] of Object.entries(english)) {
    for (const text of [value, arabic[key]]) baseCompile(text, { onError: error => assert.fail(`${key}: ${error.message}`) })
    const params = text => [...text.matchAll(/\{(value\d+)\}/g)].map(match => match[1]).sort()
    assert.deepEqual(params(arabic[key]), params(value), key)
  }
})

test('Vue i18n defaults to English and falls back for a missing Arabic key', () => {
  const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', missingWarn: false, fallbackWarn: false, messages: { en, ar: { ...ar, test: undefined } } })
  assert.equal(i18n.global.t('common.home'), 'Home')
  i18n.global.locale.value = 'ar'
  assert.equal(i18n.global.t('common.addToCart'), 'أضف إلى السلة')
  i18n.global.setLocaleMessage('ar', {})
  assert.equal(i18n.global.t('common.addToCart'), 'Add to cart')
})

test('localized destinations preserve queries, hashes, API/media and English URLs', () => {
  assert.equal(localizedPath('/products/usb-c?variant=abc#reviews', 'ar'), '/ar/products/usb-c?variant=abc#reviews')
  assert.equal(localizedPath('/ar/products/usb-c?variant=abc#reviews', 'en'), '/products/usb-c?variant=abc#reviews')
  assert.equal(localizedPath('/', 'ar'), '/ar')
  assert.equal(localizedPath('/uploads/logo.png', 'ar'), '/uploads/logo.png')
  assert.equal(localizedPath('https://example.test/x', 'ar'), 'https://example.test/x')
  assert.equal(localizedPath('/api/checkout', 'ar'), '/api/checkout')
  assert.deepEqual(localizedPath({ path: '/login', query: { redirect: '/account' } }, 'ar'), { path: '/ar/login', query: { redirect: '/account' } })
  assert.equal(stripLocalePrefix('/ar/dashboard/products'), '/dashboard/products')
  assert.equal(stripLocalePrefix('/architecture'), '/architecture')
})

test('theme branding has deterministic safe fallbacks and no mirrored images', () => {
  assert.equal(normalizeTheme('invalid'), 'system')
  assert.equal(normalizeTheme('dark'), 'dark')
  assert.deepEqual(resolveThemeLogos({ site_logo_url: '/uploads/old.png', site_logo_light_url: '/uploads/light.png', site_logo_dark_url: '/uploads/dark.png' }), { light: '/uploads/light.png', dark: '/uploads/dark.png', fallback: '/uploads/old.png' })
  assert.equal(resolveThemeLogos({ site_logo_light_url: '/uploads/light.png' }).dark, '/uploads/light.png')
  assert.equal(resolveThemeLogos({ site_logo_dark_url: 'javascript:alert(1)' }).dark, '/images/dashboard-logo.png')
  assert.doesNotMatch(read('app/components/BrandLogo.vue'), /scaleX|useColorMode/)
})

test('locale formatting keeps EGP and readable Latin digits without converting values', () => {
  const amount = 1234.5
  const text = formatAccountMoney(amount, 'EGP', formatLocale('ar'))
  assert.match(text, /1,234\.50/)
  assert.match(text, /ج\.م/)
  assert.equal(amount, 1234.5)
})

test('branding migration extends existing settings without changing catalog content', async () => {
  const db = await createResetDatabase()
  try {
    const row = (await db.query("insert into public.site_settings(key) values('local-branding-test') returning site_theme_default, site_logo_light_url, site_logo_dark_url")).rows[0]
    assert.equal(row.site_theme_default, 'system')
    assert.equal(row.site_logo_light_url, null)
    await assert.rejects(() => db.exec("update public.site_settings set site_theme_default='invalid' where key='local-branding-test'"))
    assert.doesNotMatch(read('supabase/migrations/20260928130000_ui_appearance.sql'), /update\s+public\.products|title_ar|create table/i)
  } finally { await db.close() }
})

test('catalog labels and authored CMS/review/message values bypass UI translation', () => {
  assert.doesNotMatch(read('app/pages/products/[slug].vue'), /\$uiLabel\((?:highlight|block|row|specification)\.label\)/)
  assert.doesNotMatch(read('app/components/dashboard/products/SpecificationEditor.vue'), /\$uiLabel\((?:row|item)\.label\)/)
  assert.match(read('app/components/layout/NavBar.vue'), /link\.is_default \? \$uiLabel\(link\.label\) : link\.label/)
  assert.match(read('app/middleware/dashboard-auth.global.js'), /stripLocalePrefix\(destination.path\)/)
  assert.match(read('app/components/UiPreferences.vue'), /await setLocale\(next\)/)
  assert.match(read('nuxt.config.ts'), /detectBrowserLanguage: false/)
})

test('localized print documents escape customer data and preserve financial values', () => {
  const html = buildOrderPackingDocumentsHtml({ order: { order_number: 'ORDER-123', first_name: '<script>x</script>', total_amount: 100, currency: 'EGP' }, items: [{ product_title: 'USB-C G502 X', quantity: 1, unit_price: 100 }], locale: 'ar-EG-u-nu-latn', translate: text => text === 'Customer bill' ? 'فاتورة العميل' : text })
  assert.match(html, /lang="ar" dir="rtl"/)
  assert.match(html, /فاتورة العميل/)
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/)
  assert.match(html, /USB-C G502 X/)
  assert.match(html, /100\.00/)
})
