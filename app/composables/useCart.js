const CART_STORAGE_KEY = 'elcomputer-cart'
const CART_COUPON_STORAGE_KEY = 'elcomputer-cart-coupon'
const CART_ID_STORAGE_KEY = 'elcomputer-cart-id'
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

const getMaximumCartQuantity = (stockQuantity, allowOutOfStockPurchases = false) => {
  if (allowOutOfStockPurchases) {
    return 99
  }

  const normalizedStockQuantity = Number.parseInt(stockQuantity, 10)

  if (!Number.isFinite(normalizedStockQuantity) || normalizedStockQuantity < 1) {
    return 99
  }

  return Math.max(1, normalizedStockQuantity)
}

const normalizeCartItem = (item) => {
  if (!item?.id) {
    return null
  }

  const allowOutOfStockPurchases = Boolean(item.allow_out_of_stock_purchases)
  const maximumQuantity = getMaximumCartQuantity(item.stock_quantity, allowOutOfStockPurchases)

  return {
    id: String(item.id),
    slug: String(item.slug || ''),
    title: String(item.title || 'Product'),
    image_url: String(item.image_url || ''),
    price: Number(item.price || 0),
    old_price: Number(item.old_price || 0),
    stock_quantity: Number(item.stock_quantity || 0),
    cost_price: Number(item.cost_price || 0),
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

  return {
    code: String(coupon.code || '').trim().toUpperCase(),
    description: String(coupon.description || ''),
    discountType: String(coupon.discountType || coupon.discount_type || ''),
    discountValue: Number(coupon.discountValue ?? coupon.discount_value ?? 0),
    discountAmount: Number(coupon.discountAmount ?? coupon.discount_amount ?? 0)
  }
}

export const useCart = () => {
  const items = useState('cart-items', () => [])
  const appliedCoupon = useState('cart-applied-coupon', () => null)
  const cartId = useState('cart-id', () => '')
  const isReady = useState('cart-is-ready', () => false)
  const syncStarted = useState('cart-sync-started', () => false)
  const { trackEvent } = useStoreAnalytics()

  const persistCart = () => {
    if (!import.meta.client) {
      return
    }

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items.value))

      if (items.value.length && cartId.value) {
        window.localStorage.setItem(CART_ID_STORAGE_KEY, cartId.value)
      } else {
        window.localStorage.removeItem(CART_ID_STORAGE_KEY)
      }

      if (appliedCoupon.value) {
        window.localStorage.setItem(CART_COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon.value))
      } else {
        window.localStorage.removeItem(CART_COUPON_STORAGE_KEY)
      }
    } catch {
      // Keep the in-memory cart usable when browser storage is unavailable.
    }
  }

  const loadCart = () => {
    if (!import.meta.client || isReady.value) {
      return
    }

    try {
      const storedItems = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]')
      const storedCoupon = JSON.parse(window.localStorage.getItem(CART_COUPON_STORAGE_KEY) || 'null')
      const storedCartId = String(window.localStorage.getItem(CART_ID_STORAGE_KEY) || '').trim()

      items.value = Array.isArray(storedItems)
        ? storedItems.map(normalizeCartItem).filter(Boolean)
        : []
      appliedCoupon.value = normalizeAppliedCoupon(storedCoupon)
      cartId.value = items.value.length
        ? (UUID_PATTERN.test(storedCartId) ? storedCartId : createCartIdentifier())
        : ''
    } catch {
      items.value = []
      appliedCoupon.value = null
      cartId.value = ''
    }

    isReady.value = true
    persistCart()
  }

  if (import.meta.client) {
    loadCart()

    if (!syncStarted.value) {
      syncStarted.value = true

      watch(items, persistCart, { deep: true })
      watch(appliedCoupon, persistCart, { deep: true })
      watch(cartId, persistCart)
    }
  }

  const ensureCartId = () => {
    if (!cartId.value) {
      cartId.value = createCartIdentifier()
    }

    return cartId.value
  }

  const trackCartEvent = (eventName, payload = {}) => {
    try {
      trackEvent(eventName, payload)
    } catch {
      // Cart actions must never fail because analytics is unavailable.
    }
  }

  const resetCoupon = () => {
    appliedCoupon.value = null
  }

  const setAppliedCoupon = (coupon) => {
    appliedCoupon.value = normalizeAppliedCoupon(coupon)
  }

  const clearCart = (options = {}) => {
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
    resetCoupon()
    cartId.value = ''
  }

  const removeItem = (productId, options = {}) => {
    const productIdValue = String(productId)
    const existingItem = items.value.find((item) => item.id === productIdValue)

    if (!existingItem) {
      return
    }

    const previousCartId = cartId.value
    items.value = items.value.filter((item) => item.id !== productIdValue)
    resetCoupon()

    trackCartEvent('remove_from_cart', {
      productId: existingItem.id,
      cartId: previousCartId,
      quantity: normalizePositiveInteger(existingItem.quantity, 1),
      resultingQuantity: 0,
      source: String(options?.source || 'cart')
    })

    if (!items.value.length) {
      cartId.value = ''
    }
  }

  const setQuantity = (productId, nextQuantity, options = {}) => {
    const productIdValue = String(productId)
    const existingItem = items.value.find((item) => item.id === productIdValue)

    if (!existingItem) {
      return
    }

    const maximumQuantity = getMaximumCartQuantity(
      existingItem.stock_quantity,
      existingItem.allow_out_of_stock_purchases
    )
    const normalizedQuantity = Math.min(normalizePositiveInteger(nextQuantity, 1), maximumQuantity)
    const previousQuantity = normalizePositiveInteger(existingItem.quantity, 1)

    if (normalizedQuantity === previousQuantity) {
      return
    }

    items.value = items.value.map((item) => {
      if (item.id !== productIdValue) {
        return item
      }

      return {
        ...item,
        quantity: normalizedQuantity
      }
    })

    resetCoupon()
    trackCartEvent('cart_quantity_changed', {
      productId: existingItem.id,
      cartId: cartId.value,
      quantity: Math.abs(normalizedQuantity - previousQuantity),
      resultingQuantity: normalizedQuantity,
      source: String(options?.source || 'cart')
    })
  }

  const incrementItem = (productId, options = {}) => {
    const existingItem = items.value.find((item) => item.id === String(productId))

    if (!existingItem) {
      return
    }

    setQuantity(existingItem.id, existingItem.quantity + 1, options)
  }

  const decrementItem = (productId, options = {}) => {
    const existingItem = items.value.find((item) => item.id === String(productId))

    if (!existingItem) {
      return
    }

    if (existingItem.quantity <= 1) {
      removeItem(existingItem.id, options)
      return
    }

    setQuantity(existingItem.id, existingItem.quantity - 1, options)
  }

  const addItem = (product, quantity = 1, options = {}) => {
    const normalizedProduct = normalizeCartItem({
      ...product,
      quantity
    })

    if (
      !normalizedProduct ||
      (
        normalizedProduct.stock_quantity === 0 &&
        !normalizedProduct.allow_out_of_stock_purchases
      )
    ) {
      return {
        success: false,
        message: 'This product is currently out of stock.'
      }
    }

    const existingItem = items.value.find((item) => item.id === normalizedProduct.id)

    if (existingItem) {
      const maximumQuantity = getMaximumCartQuantity(
        normalizedProduct.stock_quantity,
        normalizedProduct.allow_out_of_stock_purchases
      )
      const nextQuantity = Math.min(existingItem.quantity + normalizedProduct.quantity, maximumQuantity)
      const addedQuantity = Math.max(0, nextQuantity - existingItem.quantity)

      items.value = items.value.map((item) => {
        if (item.id !== normalizedProduct.id) {
          return item
        }

        return {
          ...item,
          ...normalizedProduct,
          quantity: nextQuantity
        }
      })
      resetCoupon()

      if (addedQuantity > 0) {
        trackCartEvent('add_to_cart', {
          productId: normalizedProduct.id,
          cartId: ensureCartId(),
          quantity: addedQuantity,
          resultingQuantity: nextQuantity,
          source: String(options?.source || 'storefront')
        })
      }

      return {
        success: true,
        message: 'Cart updated.'
      }
    }

    const nextCartId = ensureCartId()
    items.value = [...items.value, normalizedProduct]
    resetCoupon()
    trackCartEvent('add_to_cart', {
      productId: normalizedProduct.id,
      cartId: nextCartId,
      quantity: normalizedProduct.quantity,
      resultingQuantity: normalizedProduct.quantity,
      source: String(options?.source || 'storefront')
    })

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

  return {
    items,
    appliedCoupon,
    cartId,
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
}
