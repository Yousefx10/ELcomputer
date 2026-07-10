const CART_STORAGE_KEY = 'elcomputer-cart'
const CART_COUPON_STORAGE_KEY = 'elcomputer-cart-coupon'

const normalizePositiveInteger = (value, fallback = 1) => {
  const parsedValue = Number.parseInt(value, 10)

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback
  }

  return parsedValue
}

const getMaximumCartQuantity = (stockQuantity) => {
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

  const maximumQuantity = getMaximumCartQuantity(item.stock_quantity)

  return {
    id: String(item.id),
    slug: String(item.slug || ''),
    title: String(item.title || 'Product'),
    image_url: String(item.image_url || ''),
    price: Number(item.price || 0),
    old_price: Number(item.old_price || 0),
    stock_quantity: Number(item.stock_quantity || 0),
    brand_name: String(item.brand_name || item.brand?.name || ''),
    category_name: String(item.category_name || item.category?.name || ''),
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
  const isReady = useState('cart-is-ready', () => false)
  const syncStarted = useState('cart-sync-started', () => false)

  const persistCart = () => {
    if (!import.meta.client) {
      return
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items.value))

    if (appliedCoupon.value) {
      window.localStorage.setItem(CART_COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon.value))
      return
    }

    window.localStorage.removeItem(CART_COUPON_STORAGE_KEY)
  }

  const loadCart = () => {
    if (!import.meta.client || isReady.value) {
      return
    }

    try {
      const storedItems = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]')
      const storedCoupon = JSON.parse(window.localStorage.getItem(CART_COUPON_STORAGE_KEY) || 'null')

      items.value = Array.isArray(storedItems)
        ? storedItems.map(normalizeCartItem).filter(Boolean)
        : []
      appliedCoupon.value = normalizeAppliedCoupon(storedCoupon)
    } catch {
      items.value = []
      appliedCoupon.value = null
    }

    isReady.value = true
  }

  if (import.meta.client) {
    loadCart()

    if (!syncStarted.value) {
      syncStarted.value = true

      watch(items, persistCart, { deep: true })
      watch(appliedCoupon, persistCart, { deep: true })
    }
  }

  const resetCoupon = () => {
    appliedCoupon.value = null
  }

  const setAppliedCoupon = (coupon) => {
    appliedCoupon.value = normalizeAppliedCoupon(coupon)
  }

  const clearCart = () => {
    items.value = []
    resetCoupon()
  }

  const removeItem = (productId) => {
    items.value = items.value.filter((item) => item.id !== String(productId))
    resetCoupon()
  }

  const setQuantity = (productId, nextQuantity) => {
    const productIdValue = String(productId)
    const existingItem = items.value.find((item) => item.id === productIdValue)

    if (!existingItem) {
      return
    }

    const maximumQuantity = getMaximumCartQuantity(existingItem.stock_quantity)
    const normalizedQuantity = Math.min(normalizePositiveInteger(nextQuantity, 1), maximumQuantity)

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
  }

  const incrementItem = (productId) => {
    const existingItem = items.value.find((item) => item.id === String(productId))

    if (!existingItem) {
      return
    }

    setQuantity(existingItem.id, existingItem.quantity + 1)
  }

  const decrementItem = (productId) => {
    const existingItem = items.value.find((item) => item.id === String(productId))

    if (!existingItem) {
      return
    }

    if (existingItem.quantity <= 1) {
      removeItem(existingItem.id)
      return
    }

    setQuantity(existingItem.id, existingItem.quantity - 1)
  }

  const addItem = (product, quantity = 1) => {
    const normalizedProduct = normalizeCartItem({
      ...product,
      quantity
    })

    if (!normalizedProduct || normalizedProduct.stock_quantity === 0) {
      return {
        success: false,
        message: 'This product is currently out of stock.'
      }
    }

    const existingItem = items.value.find((item) => item.id === normalizedProduct.id)

    if (existingItem) {
      setQuantity(existingItem.id, existingItem.quantity + normalizedProduct.quantity)

      return {
        success: true,
        message: 'Cart updated.'
      }
    }

    items.value = [...items.value, normalizedProduct]
    resetCoupon()

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
