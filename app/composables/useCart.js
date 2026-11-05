import {emitMetaEvent} from '~/utils/metaTracking'
import { acknowledgeCart, acknowledgePurchasedCart, restoreCart, cartCompletionPrefix } from '~/utils/checkoutRecovery'
import { accountCartOwner, cartStateKey, cartStatePrefix, guestCartSessionKey, readOwnedCart } from '~/utils/cartSession'
import { allowsCartBackorder } from '~/utils/backorder'
import { validOptionValues } from '~/utils/productOptions'
import { useCustomerIdentity } from './useCustomerIdentity'
import {createCartSync, cartWriteBody} from '~/utils/accountCartSync'

const carts = new WeakMap()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const createCartIdentifier = () => {
  if (import.meta.client && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16)
    const value = character === 'x' ? randomValue : ((randomValue & 0x3) | 0x8)
    return value.toString(16)
  })
}

const normalizePositiveInteger = (value, fallback = 1) => {
  const parsedValue = Number.parseInt(value, 10)

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback
  }

  return parsedValue
}

const normalizeOptionalIdentifier = (value) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue || null
}

const buildCartKey = (productId, variantId = null) => {
  return `${String(productId)}:${variantId || 'default'}`
}

const getMaximumCartQuantity = (stockQuantity, allowOutOfStockPurchases = false, preorderLimit = null) => {
  if (preorderLimit != null) {
    const limit = Number(preorderLimit)
    return Number.isFinite(limit) ? Math.max(1, Math.min(99, limit)) : 99
  }
  if (allowOutOfStockPurchases) {
    return 99
  }

  const normalizedStockQuantity = Number.parseInt(stockQuantity, 10)

  if (!Number.isFinite(normalizedStockQuantity) || normalizedStockQuantity < 1) {
    return 99
  }

  return Math.max(1, normalizedStockQuantity)
}

const normalizeCartItem = (item, settings = {}) => {
  if (!item?.id) {
    return null
  }

  const productId = String(item.id)
  const variant = item.variant && typeof item.variant === 'object'
    ? item.variant
    : null
  const variantId = normalizeOptionalIdentifier(item.variant_id || variant?.id)
  const stockQuantity = Number(
    variantId
      ? (item.variant_stock_quantity ?? variant?.stock_quantity ?? item.stock_quantity ?? 0)
      : (item.stock_quantity || 0)
  )
  const isSerialized = Boolean(item.is_serialized)
  const sellingMode = ['normal', 'coming_soon', 'preorder'].includes(item.selling_mode) ? item.selling_mode : 'normal'
  const allowOutOfStockPurchases = allowsCartBackorder(item, settings)
  const preorderLimit = sellingMode === 'preorder' ? Math.min(
    Number(item.preorder_customer_limit || 99), Number(item.preorder_remaining ?? 99)
  ) : null
  const maximumQuantity = getMaximumCartQuantity(stockQuantity, allowOutOfStockPurchases, preorderLimit)

  return {
    id: productId,
    eligible: item.eligible !== false,
    cart_line_id: UUID_PATTERN.test(item.cart_line_id || '') ? item.cart_line_id : null,
    cart_key: buildCartKey(productId, variantId),
    variant_id: variantId,
    variant_name: String(item.variant_name ?? variant?.name ?? ''),
    variant_code: String(item.variant_code ?? variant?.code ?? ''),
    variant_sku: String(item.variant_sku ?? variant?.sku ?? ''),
    variant_color_name: String(item.variant_color_name ?? variant?.color_name ?? ''),
    variant_color_hex: String(item.variant_color_hex ?? variant?.color_hex ?? ''),
    variant_options: validOptionValues(item.variant_options ?? variant?.option_values)
      ? { ...(item.variant_options ?? variant.option_values) } : {},
    is_serialized: isSerialized,
    selling_mode: sellingMode,
    expected_availability_date: item.expected_availability_date || null,
    availability_message: String(item.availability_message || ''),
    preorder_payment_mode: item.preorder_payment_mode === 'deposit' ? 'deposit' : 'full',
    preorder_deposit_percent: Number(item.preorder_deposit_percent || 0),
    preorder_customer_limit: item.preorder_customer_limit || null,
    preorder_remaining: item.preorder_remaining ?? null,
    slug: String(item.slug || ''),
    title: String(item.title || 'Product'),
    image_url: String(item.image_url || ''),
    price: Number(item.price || 0),
    old_price: Number(item.old_price || 0),
    stock_quantity: stockQuantity,
    brand_name: String(item.brand_name || item.brand?.name || ''),
    category_name: String(item.category_name || item.category?.name || ''),
    allow_out_of_stock_purchases: allowOutOfStockPurchases,
    quantity: Math.min(normalizePositiveInteger(item.quantity, 1), maximumQuantity)
  }
}

const normalizeAppliedCoupon = (coupon) => {
  if (!coupon?.code) {
    return null
  }

  const total = Number(coupon.discountAmount ?? coupon.discount_amount ?? 0)
  const delivery = Number(coupon.deliveryDiscountAmount ?? coupon.delivery_discount_amount ?? 0)
  const discountAmount = Number.isFinite(total) ? Math.max(0, total) : 0

  return {
    code: String(coupon.code || '').trim().toUpperCase(),
    description: String(coupon.description || ''),
    discountType: String(coupon.discountType || coupon.discount_type || ''),
    discountValue: Number(coupon.discountValue ?? coupon.discount_value ?? 0),
    discountAmount,
    deliveryDiscountAmount: Number.isFinite(delivery) ? Math.min(discountAmount, Math.max(0, delivery)) : 0
  }
}

export const useCart = () => {
  const { data: siteContent } = useNuxtData('site-content')
  const normalizeItem = item => normalizeCartItem(item, siteContent.value?.settings)
  const app = useNuxtApp()
  if (carts.has(app)) {
    const cart = carts.get(app)
    if (import.meta.client) onMounted(cart.loadCart)
    return cart
  }
  const identity = useCustomerIdentity()
  const items = useState('cart-items', () => [])
  const appliedCoupon = useState('cart-applied-coupon', () => null)
  const cartId = useState('cart-id', () => '')
  const revision = useState('cart-revision', () => '')
  const isReady = useState('cart-is-ready', () => false)
  const owner = useState('cart-owner', () => '')
  const guestId = useState('cart-guest-id', () => '')
  const { trackEvent } = useStoreAnalytics()
  const supabase = useSupabaseClient()
  const syncState = useState('account-cart-sync', () => 'idle')
  const syncNotice = useState('account-cart-notice', () => '')
  let remote = null, remoteKey = '', remoteLoading = null, importCart = null
  const snapshot = () => ({id:cartId.value,revision:revision.value,items:items.value,coupon:appliedCoupon.value})
  const requestCart = async (body, key = identity.key.value) => {
    const {data,error} = await supabase.auth.getSession()
    if (error || identity.key.value !== key || data.session?.user?.id !== identity.accountId.value || !data.session?.access_token) throw Error('Session changed.')
    const result = await $fetch('/api/account/cart', {method:body ? 'POST' : 'GET',
      headers:{authorization:'Bearer ' + data.session.access_token},...(body ? {body} : {}),retry:0,timeout:10000})
    if (identity.key.value !== key) throw Error('Session changed.')
    return result
  }
  const applyRemote = cart => {
    items.value = cart.items.map(item => ({...normalizeItem(item),quantity:item.quantity}))
    appliedCoupon.value = normalizeAppliedCoupon(cart.coupon)
    cartId.value = cart.id || ''; revision.value = cart.revision || createCartIdentifier()
  }
  const loadRemote = async () => {
    if (remoteLoading) return remoteLoading
    const key = identity.key.value
    if (!identity.accountId.value) return
    syncState.value = 'loading'
    remoteLoading = (async () => {
      try {
        const result = await requestCart(undefined,key)
        remote = createCartSync({request:body => requestCart(body,key),current:() => identity.key.value === key,
          apply:applyRemote,status:value => {if(identity.key.value === key) syncState.value=value},uuid:createCartIdentifier})
        if (importCart?.items?.length) {
          const imported = importCart
          const merged = await requestCart({command_id:UUID_PATTERN.test(imported.revision || '') ? imported.revision : imported.id,
            expected_version:0,body:cartWriteBody({...imported,items:imported.items.map(item => ({...item,cart_line_id:item.cart_line_id || createCartIdentifier()}))},'merge')},key)
          remote.initialize(merged.cart)
          if(merged.skipped) syncNotice.value='cartSync.skipped'
          try {window.localStorage.removeItem(cartStateKey(imported.owner))} catch {}
          importCart = null
        } else remote.initialize(result.cart)
      } catch {if(identity.key.value === key) syncState.value='error'}
      finally {if(identity.key.value === key) remoteLoading=null}
    })()
    return remoteLoading
  }
  const retrySync = async () => {if (!remote || importCart) await loadRemote(); else await remote.retry()}
  const reviewServerCart = async () => {
    try {await remote?.review();importCart=null} catch {syncState.value='error'}
  }
  const waitForSync = async () => {await remoteLoading;await remote?.retry();return !identity.accountId.value || syncState.value === 'ready' && remote?.clean}
  const writable = () => !identity.accountId.value || !!remote && ['ready','saving'].includes(syncState.value)

  const currentOwner = () => {
    if (identity.accountId.value) {
      // A later sign-out starts a fresh anonymous basket in this tab.
      guestId.value = ''
      try { window.sessionStorage.removeItem(guestCartSessionKey) } catch {}
      return accountCartOwner(identity.accountId.value)
    }
    if (!guestId.value) {
      try { guestId.value = window.sessionStorage.getItem(guestCartSessionKey) || '' } catch {}
      if (!UUID_PATTERN.test(guestId.value)) guestId.value = createCartIdentifier()
      try { window.sessionStorage.setItem(guestCartSessionKey, guestId.value) } catch {}
    }
    return 'guest:' + guestId.value
  }
  const resetMemory = () => {
    items.value = []; appliedCoupon.value = null; cartId.value = ''; revision.value = ''
  }
  const persistCart = () => {
    if (!import.meta.client) {
      return
    }

    try {
      if (!owner.value || owner.value !== currentOwner() || owner.value.startsWith('account:')) return
      window.localStorage.setItem(cartStateKey(owner.value), JSON.stringify({ version: 3, owner: owner.value,
        id: cartId.value, revision: revision.value, items: items.value, coupon: appliedCoupon.value }))
    } catch {
      // Keep the in-memory cart usable when browser storage is unavailable.
    }
  }

  const syncCart = () => {
    if (!import.meta.client) return
    const expected = currentOwner()
    if (expected !== owner.value) {
      const previousOwner = owner.value
      if (previousOwner.startsWith('guest:') && expected.startsWith('account:')) {
        importCart = {...snapshot(),owner:previousOwner}
      } else importCart = null
      if (previousOwner.startsWith('account:')) {
        try {window.localStorage.removeItem(cartStateKey(previousOwner))} catch {}
      }
      if (expected.startsWith('account:') && !importCart) {
        try {importCart=readOwnedCart(window.localStorage,expected)} catch {}
      }
      remote=null;remoteLoading=null;remoteKey=identity.key.value;syncNotice.value=''
      // Clear first, even if storage is unavailable or the next envelope is bad.
      resetMemory()
      owner.value = expected
    }
    if (expected.startsWith('account:')) {
      if (remoteKey !== identity.key.value) {remote=null;remoteLoading=null;remoteKey=identity.key.value}
      if (!remote && !remoteLoading) void loadRemote()
      return
    }
    syncState.value='idle'
    try {
      const stored = readOwnedCart(window.localStorage, expected)
      const storedItems = stored?.items, storedId = stored?.id
      const restored = restoreCart(window.localStorage, {
        id: Array.isArray(storedItems) && storedItems.length ? (UUID_PATTERN.test(storedId || '') ? storedId : createCartIdentifier()) : '',
        revision: stored?.revision || createCartIdentifier(),
        items: Array.isArray(storedItems) ? storedItems.map(normalizeItem).filter(Boolean) : [],
        coupon: normalizeAppliedCoupon(stored?.coupon)
      }, expected)
      items.value = restored.items
      appliedCoupon.value = restored.coupon
      cartId.value = restored.id
      revision.value = restored.revision
    } catch { /* Preserve the current cart when browser storage is unavailable. */ }
  }
  const commitCart = () => {
    items.value = items.value.map(item => item.cart_line_id ? item : {...item, cart_line_id:createCartIdentifier()})
    // An acknowledgement may arrive while this tab is editing in memory.
    // Fork the committed identity without replacing those edited items.
    if (import.meta.client && cartId.value) {
      try {
        const restored = restoreCart(window.localStorage, {id:cartId.value, revision:createCartIdentifier(), items:items.value, coupon:appliedCoupon.value}, owner.value)
        cartId.value = restored.id; items.value = restored.items; appliedCoupon.value = restored.coupon
      }
      catch { /* Server receipts still reject incompatible command reuse. */ }
    }
    revision.value = createCartIdentifier()
    persistCart()
    if (identity.accountId.value && remote) remote.write(snapshot())
  }
  const loadCart = () => {
    if (!import.meta.client || isReady.value) return
    syncCart()
    isReady.value = true
    try { if (!window.localStorage.getItem(cartStateKey(owner.value))) persistCart() }
    catch { /* Keep the in-memory cart usable without browser storage. */ }
  }
  if (import.meta.client) {
    onMounted(loadCart)
    const scope = effectScope(true)
    scope.run(() => watch(identity.key, syncCart, { flush: 'sync' }))
    const storageChanged = event => {
      if (event.key?.startsWith(cartStatePrefix) || event.key?.startsWith(cartCompletionPrefix) || event.key === null) syncCart()
    }
    const visibilityChanged = () => { if (!document.hidden) syncCart() }
    window.addEventListener('storage', storageChanged)
    window.addEventListener('focus', syncCart)
    document.addEventListener('visibilitychange', visibilityChanged)
    const refreshRemote = () => {if (identity.accountId.value && remote?.clean && !document.hidden) void remote.review().catch(() => {syncState.value='error'})}
    const poll = window.setInterval(refreshRemote,15000)
    window.addEventListener('focus',refreshRemote)
    app.vueApp?.onUnmount(() => {
      clearInterval(poll);window.removeEventListener('focus',refreshRemote)
      scope.stop()
      window.removeEventListener('storage', storageChanged)
      window.removeEventListener('focus', syncCart)
      document.removeEventListener('visibilitychange', visibilityChanged)
    })
  }
  const renewCart = () => {
    syncCart()
    cartId.value = items.value.length ? createCartIdentifier() : ''
    commitCart()
  }
  const completeCart = snapshot => {
    syncCart()
    if (!snapshot?.owner || snapshot.owner !== owner.value) return
    if (identity.accountId.value) {
      if (snapshot.id === cartId.value && snapshot.revision === revision.value) {items.value=[];appliedCoupon.value=null;cartId.value='';commitCart()}
      return
    }
    acknowledgeCart(window.localStorage, snapshot, createCartIdentifier(), snapshot.owner)
    syncCart()
  }
  const ensurePurchaseLineIdentities = () => {
    syncCart()
    if (items.value.some(item => !item.cart_line_id)) commitCart()
  }
  const completePurchasedCart = async (snapshot, receipt) => {
    syncCart()
    if (!snapshot?.owner || snapshot.owner !== owner.value) return false
    if (identity.accountId.value) {
      if (!await waitForSync()) return false
      try {const result=await requestCart({purchase_session_id:receipt});remote.initialize(result.cart);return true}
      catch {syncState.value='error';return false}
    }
    const done = acknowledgePurchasedCart(window.localStorage, snapshot, createCartIdentifier(), receipt, snapshot.owner)
    syncCart()
    return done
  }

  const ensureCartId = () => {
    if (!cartId.value) {
      cartId.value = createCartIdentifier()
    }

    return cartId.value
  }

  const findCartItem = (identifier) => {
    const identifierValue = String(identifier || '')

    return items.value.find((item) => item.cart_key === identifierValue)
      || items.value.find((item) => item.id === identifierValue)
  }

  const trackCartEvent = (eventName, payload = {}) => {
    try {
      trackEvent(eventName, payload)
      if(eventName==='add_to_cart')emitMetaEvent('AddToCart',payload)
    } catch {
      // Cart actions must never fail because analytics is unavailable.
    }
  }

  const resetCoupon = (persist = true) => {
    if (persist) syncCart()
    appliedCoupon.value = null
    if (persist) commitCart()
  }

  const setAppliedCoupon = (coupon) => {
    if (!writable()) return
    syncCart()
    appliedCoupon.value = normalizeAppliedCoupon(coupon)
    commitCart()
  }

  const clearCart = (options = {}) => {
    if (!writable()) return
    syncCart()
    const previousCartId = cartId.value
    const previousQuantity = items.value.reduce((total, item) => {
      return total + normalizePositiveInteger(item.quantity, 1)
    }, 0)
    const shouldTrack = options?.track !== false

    if (shouldTrack && previousCartId && previousQuantity > 0) {
      trackCartEvent('cart_cleared', {
        cartId: previousCartId,
        quantity: previousQuantity,
        resultingQuantity: 0,
        source: String(options?.reason || 'manual')
      })
    }

    items.value = []
    resetCoupon(false)
    cartId.value = ''
    commitCart()
  }

  const removeItem = (cartKey, options = {}) => {
    if (!writable()) return
    syncCart()
    const existingItem = findCartItem(cartKey)

    if (!existingItem) {
      return
    }

    const previousCartId = cartId.value
    items.value = items.value.filter((item) => item.cart_key !== existingItem.cart_key)
    resetCoupon(false)

    trackCartEvent('remove_from_cart', {
      productId: existingItem.id,
      variantId: existingItem.variant_id,
      cartKey: existingItem.cart_key,
      cartId: previousCartId,
      quantity: normalizePositiveInteger(existingItem.quantity, 1),
      resultingQuantity: 0,
      source: String(options?.source || 'cart')
    })

    if (!items.value.length) {
      cartId.value = ''
    }
    commitCart()
  }

  const setQuantity = (cartKey, nextQuantity, options = {}) => {
    if (!writable()) return
    syncCart()
    const existingItem = findCartItem(cartKey)

    if (!existingItem) {
      return
    }

    const maximumQuantity = getMaximumCartQuantity(
      existingItem.stock_quantity,
      existingItem.allow_out_of_stock_purchases,
      existingItem.selling_mode === 'preorder' ? Math.min(Number(existingItem.preorder_customer_limit || 99), Number(existingItem.preorder_remaining ?? 99)) : null
    )
    const normalizedQuantity = Math.min(normalizePositiveInteger(nextQuantity, 1), maximumQuantity)
    const previousQuantity = normalizePositiveInteger(existingItem.quantity, 1)

    if (normalizedQuantity === previousQuantity) {
      return
    }

    items.value = items.value.map((item) => {
      if (item.cart_key !== existingItem.cart_key) {
        return item
      }

      return {
        ...item,
        quantity: normalizedQuantity
      }
    })

    resetCoupon(false)
    trackCartEvent('cart_quantity_changed', {
      productId: existingItem.id,
      variantId: existingItem.variant_id,
      cartKey: existingItem.cart_key,
      cartId: cartId.value,
      quantity: Math.abs(normalizedQuantity - previousQuantity),
      resultingQuantity: normalizedQuantity,
      source: String(options?.source || 'cart')
    })
    commitCart()
  }

  const incrementItem = (cartKey, options = {}) => {
    syncCart()
    const existingItem = findCartItem(cartKey)

    if (!existingItem) {
      return
    }

    setQuantity(existingItem.cart_key, existingItem.quantity + 1, options)
  }

  const decrementItem = (cartKey, options = {}) => {
    syncCart()
    const existingItem = findCartItem(cartKey)

    if (!existingItem) {
      return
    }

    if (existingItem.quantity <= 1) {
      removeItem(existingItem.cart_key, options)
      return
    }

    setQuantity(existingItem.cart_key, existingItem.quantity - 1, options)
  }

  const addItem = (product, quantity = 1, options = {}) => {
    if (!writable()) return {success:false,message:'Wait for your saved cart to load.'}
    syncCart()
    const normalizedProduct = normalizeItem({
      ...product,
      quantity
    })

    if (normalizedProduct?.selling_mode === 'coming_soon') return { success: false, message: 'This product is Coming Soon.' }
    if (normalizedProduct && items.value.some(item => (item.selling_mode === 'preorder') !== (normalizedProduct.selling_mode === 'preorder'))) {
      return { success: false, message: 'Place preorders and ready-to-ship products in separate orders.' }
    }
    if (
      !normalizedProduct ||
      (
        normalizedProduct.stock_quantity <= 0 &&
        !normalizedProduct.allow_out_of_stock_purchases
      )
    ) {
      return {
        success: false,
        message: 'This product is currently out of stock.'
      }
    }

    const existingItem = items.value.find((item) => {
      return item.cart_key === normalizedProduct.cart_key
    })

    if (existingItem) {
      const maximumQuantity = getMaximumCartQuantity(
        normalizedProduct.stock_quantity,
        normalizedProduct.allow_out_of_stock_purchases,
        normalizedProduct.selling_mode === 'preorder' ? Math.min(Number(normalizedProduct.preorder_customer_limit || 99), Number(normalizedProduct.preorder_remaining ?? 99)) : null
      )
      const nextQuantity = Math.min(existingItem.quantity + normalizedProduct.quantity, maximumQuantity)
      const addedQuantity = Math.max(0, nextQuantity - existingItem.quantity)

      items.value = items.value.map((item) => {
        if (item.cart_key !== normalizedProduct.cart_key) {
          return item
        }

        return {
          ...item,
          ...normalizedProduct,
          quantity: nextQuantity
        }
      })
      resetCoupon(false)

      if (addedQuantity > 0) {
        trackCartEvent('add_to_cart', {
          productId: normalizedProduct.id,
          variantId: normalizedProduct.variant_id,
          cartKey: normalizedProduct.cart_key,
          cartId: ensureCartId(),
          quantity: addedQuantity,
          resultingQuantity: nextQuantity,
          source: String(options?.source || 'storefront')
        })
      }

      commitCart()
      return {
        success: true,
        message: 'Cart updated.'
      }
    }

    const nextCartId = ensureCartId()
    items.value = [...items.value, normalizedProduct]
    resetCoupon(false)
    trackCartEvent('add_to_cart', {
      productId: normalizedProduct.id,
      variantId: normalizedProduct.variant_id,
      cartKey: normalizedProduct.cart_key,
      cartId: nextCartId,
      quantity: normalizedProduct.quantity,
      resultingQuantity: normalizedProduct.quantity,
      source: String(options?.source || 'storefront')
    })

    commitCart()
    return {
      success: true,
      message: 'Added to cart.'
    }
  }

  const itemCount = computed(() => {
    return items.value.reduce((total, item) => total + normalizePositiveInteger(item.quantity, 1), 0)
  })

  const subtotal = computed(() => {
    return items.value.reduce((total, item) => {
      return total + (Number(item.price || 0) * normalizePositiveInteger(item.quantity, 1))
    }, 0)
  })

  const distinctItemsCount = computed(() => items.value.length)
  const isEmpty = computed(() => !items.value.length)

  const cart = {
    items,
    syncState, syncNotice, retrySync, reviewServerCart, waitForSync,
    owner,
    appliedCoupon,
    cartId,
    revision,
    syncCart,
    renewCart,
    completeCart,
    completePurchasedCart,
    ensurePurchaseLineIdentities,
    isReady,
    itemCount,
    distinctItemsCount,
    subtotal,
    isEmpty,
    addItem,
    removeItem,
    setQuantity,
    incrementItem,
    decrementItem,
    clearCart,
    setAppliedCoupon,
    resetCoupon,
    loadCart
  }
  carts.set(app, cart)
  return cart
}
