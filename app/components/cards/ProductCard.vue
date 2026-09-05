<template>
  <article class="store-product-card">
    <NuxtLink :to="product.slug ? `/products/${product.slug}` : '/search'" class="store-product-image" :aria-label="product.title">
      <span v-if="hasDiscount" class="store-product-badge">Save {{ discountPercent }}%</span>
      <span v-else-if="product.is_featured" class="store-product-badge store-product-badge-featured">Featured</span>
      <img v-if="getStoreImageUrl(product.image_url)" :src="product.image_url" :alt="product.title" loading="lazy" />
      <Icon v-else :name="getStoreCategoryIcon(categoryName)" size="56" class="store-product-placeholder" />
    </NuxtLink>
    <div class="store-product-info">
      <div class="store-product-price">
        <strong>{{ priceFormatter.format(numericPrice) }} <small>EGP</small></strong>
        <del v-if="hasDiscount">{{ formatPrice(product.old_price) }}</del>
      </div>
      <p v-if="brandName || categoryName" class="store-product-brand">{{ brandName || categoryName }}</p>
      <NuxtLink :to="product.slug ? `/products/${product.slug}` : '/search'" class="store-product-title"><h3>{{ product.title }}</h3></NuxtLink>
      <p class="store-product-stock" :class="{ 'store-product-stock-unavailable': isOutOfStock }">
        <Icon :name="isOutOfStock ? 'lucide:clock-3' : 'lucide:check'" size="13" />
        {{ isOutOfStock ? (isPurchasable ? 'Available to order' : 'Out of stock') : 'In stock' }}
      </p>
      <button type="button" :disabled="!isPurchasable" :aria-label="requiresOptionSelection ? `Choose options for ${product.title}` : `Add ${product.title} to cart`" class="store-product-add" @click="handleAddToCart">
        <Icon :name="addedToCart ? 'lucide:check' : (requiresOptionSelection ? 'lucide:sliders-horizontal' : 'lucide:plus')" size="15" />
        {{ !isPurchasable ? 'Out of stock' : (addedToCart ? 'Added' : (requiresOptionSelection ? 'Options' : 'Add to cart')) }}
      </button>
      <span class="sr-only" role="status">{{ cartFeedback }}</span>
    </div>
  </article>
</template>

<script setup>
import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
const props = defineProps({
  product: {
    type: Object,
    required: true
  }
})

const { data: siteContent } = useSiteContent()
const { addItem } = useCart()
const addedToCart = ref(false)
const cartFeedback = ref('')
let feedbackTimeout
onBeforeUnmount(() => clearTimeout(feedbackTimeout))

const priceFormatter = new Intl.NumberFormat('en-US')

const numericPrice = computed(() => Number(props.product.price || 0))
const numericOldPrice = computed(() => Number(props.product.old_price || 0))
const brandName = computed(() => String(props.product.brand?.name || '').trim())
const categoryName = computed(() => String(props.product.category?.name || '').trim())
const isOutOfStock = computed(() => Number(props.product.stock_quantity || 0) <= 0)
const allowOutOfStockPurchases = computed(() => {
  return Boolean(siteContent.value?.settings?.allow_out_of_stock_purchases)
    && !props.product.is_serialized
})
const isPurchasable = computed(() => !isOutOfStock.value || allowOutOfStockPurchases.value)
const embeddedVariants = computed(() => {
  if (Array.isArray(props.product.variants)) {
    return props.product.variants
  }

  if (Array.isArray(props.product.product_variants)) {
    return props.product.product_variants
  }

  return null
})
const requiresOptionSelection = computed(() => {
  if (props.product.is_serialized) {
    return true
  }

  if (embeddedVariants.value) {
    return embeddedVariants.value.some((variant) => variant?.is_active !== false)
  }

  if (typeof props.product.has_variants === 'boolean') {
    return props.product.has_variants
  }

  if (Number(props.product.variant_count || 0) > 0) {
    return true
  }

  return false
})

const hasDiscount = computed(() => {
  return numericOldPrice.value > numericPrice.value
})

const discountAmount = computed(() => {
  const amount = numericOldPrice.value - numericPrice.value
  return amount > 0 ? amount : 0
})

const discountPercent = computed(() => {
  if (!hasDiscount.value || numericOldPrice.value <= 0) {
    return 0
  }

  return Math.round((discountAmount.value / numericOldPrice.value) * 100)
})

const formatPrice = (value) => {
  return `${priceFormatter.format(Number(value || 0))} EGP`
}

const openProductOptions = async () => {
  if (!props.product.slug) {
    return
  }

  await navigateTo(`/products/${props.product.slug}`)
}

const handleAddToCart = async () => {
  if (!isPurchasable.value) {
    return
  }

  if (requiresOptionSelection.value) {
    await openProductOptions()
    return
  }

  const result = addItem({
    ...props.product,
    allow_out_of_stock_purchases: allowOutOfStockPurchases.value
  }, 1, {
    source: 'product_card'
  })
  cartFeedback.value = result.success ? `${props.product.title} added to cart.` : result.message
  addedToCart.value = result.success
  clearTimeout(feedbackTimeout)
  feedbackTimeout = setTimeout(() => { addedToCart.value = false }, 2200)
}
</script>
