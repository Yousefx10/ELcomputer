import { createApp, ref, reactive, computed, watch, effectScope, onMounted, onBeforeUnmount, onScopeDispose, getCurrentInstance, nextTick, shallowRef, h, Suspense } from 'vue'
import Component from 'normal-purchase-page'
import { useCart } from '../../app/composables/useCart.js'
import { usePurchaseAccess } from '../../app/composables/usePurchaseAccess.js'
import { useCustomerIdentity } from '../../app/composables/useCustomerIdentity.js'
import { useCustomerScope } from '../../app/composables/useCustomerScope.js'
import { useSupportClient } from '../../app/composables/useSupportClient.js'
import { useReorder } from '../../app/composables/useReorder.js'
import { cartStateKey, accountCartOwner } from '../../app/utils/cartSession.js'

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
const sessionState = ref(session())
const holds = new Map()
window.__hold = key => { let done; const promise = new Promise(resolve => { done = resolve }); holds.set(key, promise); return () => { done(); holds.delete(key) } }
window.__release = key => window.__releases?.[key]?.()
window.__holdPath = key => { window.__releases ||= {}; window.__releases[key] = window.__hold(key) }
const supabase = {
  auth: {
    getSession: async () => ({ data: { session: sessionState.value } }),
    getUser: async () => ({ data: { user: session()?.user || null } })
  },
  from(table) {
    const filters = {}, selections = {}, actor = sessionState.value?.user?.id
    let single = false
    const result = async () => {
      let data
      if (table === 'customer_profiles') {
        data = filters.id === actor ? structuredClone(fixture.profiles?.[actor] || fixture.profile) : null
        await holds.get('profile:' + actor)
      } else if (table === 'customer_orders') {
        data = structuredClone(fixture.ordersByActor?.[actor] || [])
        if (filters.id) data = data.filter(order => order.id === filters.id)
      } else if (table === 'customer_order_items') {
        const ownIds = new Set((fixture.ordersByActor?.[actor] || []).map(order => order.id))
        data = (fixture.orderItems || []).filter(item => ownIds.has(item.order_id))
      } else throw Error('Unexpected browser table: ' + table)
      await holds.get(table)
      const count = Array.isArray(data) ? data.length : 1
      return { data: single && Array.isArray(data) ? data[0] || null : data, count: selections.head ? count : count, error: null }
    }
    const query = { select: (_, options) => { Object.assign(selections, options); return query },
      eq: (column, value) => { filters[column] = value; return query }, in: () => query,
      maybeSingle: () => { single = true; return query }, single: () => { single = true; return query },
      order: () => query, range: () => query, limit: () => query, abortSignal: () => query,
      then: (done, fail) => result().then(done, fail) }
    return query
  }
}
const request = async (path, options = {}) => {
  window.__requests.push({ path, method: options.method || 'GET', body: options.body === undefined ? undefined : JSON.parse(JSON.stringify(options.body)), retry: options.retry })
  await holds.get(path)
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
  if (path === '/api/checkout/coupon') return { coupon: { code: 'ALICE_PRIVATE_COUPON', discountAmount: 1 } }
  if (path === '/api/payments/intentions') {
    if (options.retry !== 0) throw Error('Intention retries must be disabled')
    if (fixture.loseIntention) throw Error('Synthetic uncertain intention')
    return { publicKey: 'pk_live_fixture', clientSecret: 'csk_live_fixture', methods: ['card'] }
  }
  const actor = options.headers?.authorization?.replace('Bearer synthetic-', '')
  if (path.startsWith('/api/account/orders/')) {
    const order = (fixture.ordersByActor?.[actor] || []).find(order => path.endsWith(order.id))
    if (!order) throw Object.assign(Error('Order unavailable'), { statusCode: 404 })
    return { order, items: (fixture.orderItems || []).filter(item => item.order_id === order.id) }
  }
  if (path === '/api/account/messages') return { items: fixture.messagesByActor?.[actor] || [], total: 1, unreadCount: 0 }
  if (path === '/api/payments/status') return { status: 'paid', mode: 'live', orderId: fixture.orderId }
  throw Error('Unexpected browser request: ' + path)
}

Object.assign(globalThis, {
  ref, reactive, computed, watch, effectScope, onMounted, onBeforeUnmount, onScopeDispose, getCurrentInstance, nextTick, shallowRef,
  useCart, usePurchaseAccess, useCustomerIdentity, useCustomerScope, useSupportClient, useReorder, $fetch: request,
  useShipmentUpdates: () => {},
  useAccountAppearance: () => ({ data: ref({ account_dashboard_style: 'modern' }) }),
  useNuxtData: () => ({ data: ref({ settings: {} }) }),
  useAsyncData: async (key, handler) => {
    window.__asyncKeys ||= []; window.__asyncKeys.push(key)
    try { return { data: ref(await handler()), pending: ref(false), error: ref(null) } }
    catch (error) { return { data: ref(null), pending: ref(false), error: ref(error) } }
  },
  useState: (key, initial) => { if (!state.has(key)) state.set(key, ref(initial())); return state.get(key) },
  useNuxtApp: () => nuxt,
  useRuntimeConfig: () => ({ public: { purchasingEnabled: Boolean(fixture.publicAccess), siteUrl: fixture.siteUrl } }),
  useSupabaseClient: () => supabase,
  useSupabaseUser: () => user,
  useSupabaseSession: () => sessionState,
  useSiteContent: () => ({ data: ref({ settings: {
    payment_card_enabled: true, payment_card_fee: 0, payment_cash_enabled: true,
    payment_bank_transfer_enabled: true, payment_instapay_enabled: true
  } }) }),
  useStoreAnalytics: () => ({ trackEvent: () => {} }),
  useI18n: () => ({ locale: ref(fixture.locale), t: translate }),
  useUiLocale: () => ({ intlLocale: ref(fixture.locale === 'ar' ? 'ar-EG' : 'en-EG'), uiLabel: value => value }),
  useCategoryLocale: () => ({ categoryName: category => category?.name || '' }),
  useUiNavigation: () => ({ uiNavigateTo: async value => { window.__navigations.push(value) } }),
  useRoute: () => ({ params: { id: fixture.orderId }, query: { order_id: fixture.orderId }, path: '/checkout/payment-result' }),
  useUiRoute: () => ({ params: { id: fixture.orderId }, query: {}, path: '/account/orders/' + fixture.orderId }),
  useRouter: () => ({ replace: async () => {} }),
  definePageMeta: meta => { window.__pageMeta = meta },
  useHead: () => {}
})

window.__cartKey = id => cartStateKey(accountCartOwner(id || fixture.actorId))
if (fixture.cart && !localStorage.getItem(window.__cartKey())) localStorage.setItem(window.__cartKey(), JSON.stringify({ ...fixture.cart, version: 3, owner: accountCartOwner(fixture.actorId) }))
for (const path of fixture.holdPaths || []) window.__holdPath(path)
window.__switchAccount = (id, staleClaims = false) => { fixture.actorId = id; sessionState.value = session(); if (!staleClaims) user.value = id ? { id } : null }
window.__switchAccountAcrossTabs = id => { window.__switchAccount(id, true); localStorage.setItem('synthetic-auth-session', JSON.stringify({ id, nonce: crypto.randomUUID() })) }
window.addEventListener('storage', event => { if (event.key === 'synthetic-auth-session') window.__switchAccount(JSON.parse(event.newValue).id, true) })
window.__cartMemory = () => ({ items: state.get('cart-items')?.value, coupon: state.get('cart-applied-coupon')?.value, owner: state.get('cart-owner')?.value })
const app = createApp({ setup() { const identity = useCustomerIdentity(); const cart = useCart(); window.__addCartItem = item => cart.addItem(item); return () => h(Suspense, { key: identity.key.value }, { default: () => h(Component, fixture.pageProps || {}), fallback: () => h('p', 'Loading') }) } })
nuxt.vueApp = app
app.component('Icon', { render: () => h('span') })
app.component('NuxtLinkLocale', { props: ['to'], setup: (_, context) => () => h('a', context.slots.default?.()) })
app.component('ClientOnly', { setup: (_, context) => () => context.slots.default?.() })
app.component('PaymentProofUpload', { render: () => h('span') })
app.component('PaymentPaymobPixel', { setup: (_, context) => () => h('button', { 'data-fixture-pixel': 'true', onClick: () => context.emit('complete') }, 'Synthetic secure fields') })
app.config.globalProperties.$t = translate
app.config.globalProperties.$uiLabel = value => value
app.config.globalProperties.$uiMessage = value => value
app.mount('#app')
