import { createApp, ref, reactive, computed, watch, onMounted, onBeforeUnmount, onScopeDispose, getCurrentInstance, nextTick, shallowRef, h, Suspense } from 'vue'
import Component from 'normal-purchase-page'
import { useCart } from '../../app/composables/useCart.js'
import { usePurchaseAccess } from '../../app/composables/usePurchaseAccess.js'

const fixture = window.__fixture
const state = new Map()
const nuxt = {}
const user = ref(fixture.actorId ? { id: fixture.actorId, email: 'fixture@example.invalid' } : null)
window.__requests = []
window.__navigations = []
window.__pageMeta = null
const translate = (key, values = {}) => {
  let value = key.split('.').reduce((v, part) => v?.[part], fixture.messages)
  if (typeof value !== 'string') throw Error('Missing translation: ' + key)
  for (const [name, replacement] of Object.entries(values)) value = value.replaceAll('{' + name + '}', String(replacement))
  return value
}
const session = () => fixture.actorId ? { access_token: 'synthetic-' + fixture.actorId, user: { id: fixture.actorId } } : null
const supabase = {
  auth: {
    getSession: async () => ({ data: { session: session() } }),
    getUser: async () => ({ data: { user: session()?.user || null } })
  },
  from(table) {
    if (table !== 'customer_profiles') throw Error('Unexpected browser table')
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: structuredClone(fixture.profile), error: null }) }) }) }
  }
}
const request = async (path, options = {}) => {
  window.__requests.push({ path, method: options.method || 'GET', body: options.body === undefined ? undefined : JSON.parse(JSON.stringify(options.body)), retry: options.retry })
  if (path === '/api/payments/capabilities') {
    if (fixture.publicAccess) return { card: { available: true, initiationAvailable: true, mode: 'live' }, purchase: { available: true, restricted: false } }
    if (options.headers?.authorization !== 'Bearer synthetic-' + fixture.allowedId) return { card: { available: false }, purchase: { available: false } }
    return { card: { available: true, initiationAvailable: fixture.paymentEnabled !== false, mode: 'live' }, purchase: {
      available: true, restricted: true, productId: fixture.productId, variantId: fixture.variantId,
      shippingCompanyId: fixture.companyId, expiresAt: fixture.expiresAt, paymentEnabled: fixture.paymentEnabled !== false
    } }
  }
  if (path === '/api/checkout/shipping') return { options: [{ id: fixture.companyId, name: 'Synthetic PDC', price: 10, governorates: ['Cairo'] }] }
  if (path === '/api/checkout/quote') return {
    quoteId: fixture.quoteId, reviewToken: '55'.repeat(32), expiresAt: new Date(Date.now() + 60000).toISOString(),
    totalAmount: 110, orderValue: 100, discountAmount: 0, paymentFee: 0, shippingFee: 10,
    shipping: { id: fixture.companyId, name: 'Synthetic PDC' }, isPreorder: false,
    lines: [{ productId: fixture.productId, variantId: fixture.variantId, quantity: 1, title: 'Synthetic physical item', total: 100 }]
  }
  if (path === '/api/checkout') {
    if (fixture.loseOrderAck && !fixture.orderLost) { fixture.orderLost = true; throw Error('Synthetic lost acknowledgement') }
    return { order: { id: fixture.orderId, paymentMethod: 'card' } }
  }
  if (path === '/api/payments/intentions') {
    if (options.retry !== 0) throw Error('Intention retries must be disabled')
    if (fixture.loseIntention) throw Error('Synthetic uncertain intention')
    return { publicKey: 'pk_live_fixture', clientSecret: 'csk_live_fixture', methods: ['card'] }
  }
  throw Error('Unexpected browser request: ' + path)
}

Object.assign(globalThis, {
  ref, reactive, computed, watch, onMounted, onBeforeUnmount, onScopeDispose, getCurrentInstance, nextTick, shallowRef,
  useCart, usePurchaseAccess, $fetch: request,
  useState: (key, initial) => { if (!state.has(key)) state.set(key, ref(initial())); return state.get(key) },
  useNuxtApp: () => nuxt,
  useRuntimeConfig: () => ({ public: { purchasingEnabled: Boolean(fixture.publicAccess), siteUrl: fixture.siteUrl } }),
  useSupabaseClient: () => supabase,
  useSupabaseUser: () => user,
  useSiteContent: () => ({ data: ref({ settings: {
    payment_card_enabled: true, payment_card_fee: 0, payment_cash_enabled: true,
    payment_bank_transfer_enabled: true, payment_instapay_enabled: true
  } }) }),
  useStoreAnalytics: () => ({ trackEvent: () => {} }),
  useI18n: () => ({ locale: ref(fixture.locale), t: translate }),
  useUiLocale: () => ({ intlLocale: ref(fixture.locale === 'ar' ? 'ar-EG' : 'en-EG'), uiLabel: value => value }),
  useCategoryLocale: () => ({ categoryName: category => category?.name || '' }),
  useUiNavigation: () => ({ uiNavigateTo: async value => { window.__navigations.push(value) } }),
  useRoute: () => ({ params: { id: fixture.orderId } }),
  definePageMeta: meta => { window.__pageMeta = meta },
  useHead: () => {}
})

if (fixture.cart) localStorage.setItem('elcomputer-cart-state-v2', JSON.stringify(fixture.cart))
window.__switchAccount = id => { fixture.actorId = id; user.value = id ? { id } : null }
const app = createApp({ render: () => h(Suspense, null, { default: () => h(Component, fixture.pageProps || {}), fallback: () => h('p', 'Loading') }) })
app.component('Icon', { render: () => h('span') })
app.component('NuxtLinkLocale', { props: ['to'], setup: (_, context) => () => h('a', context.slots.default?.()) })
app.component('ClientOnly', { setup: (_, context) => () => context.slots.default?.() })
app.component('PaymentProofUpload', { render: () => h('span') })
app.component('PaymentPaymobPixel', { setup: (_, context) => () => h('button', { 'data-fixture-pixel': 'true', onClick: () => context.emit('complete') }, 'Synthetic secure fields') })
app.config.globalProperties.$t = translate
app.config.globalProperties.$uiLabel = value => value
app.config.globalProperties.$uiMessage = value => value
app.mount('#app')
