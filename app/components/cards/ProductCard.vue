<template>
  <article class="store-product-card">
    <NuxtLinkLocale :to="product.slug ? `/products/${product.slug}` : '/search'" class="store-product-image" :aria-label="product.title">
      <span v-if="hasDiscount" class="store-product-badge">{{ $t('common.saveValueVariant2', { value0: (discountPercent) }) }}</span>
      <span v-else-if="product.is_featured" class="store-product-badge store-product-badge-featured">{{ $t('common.featured') }}</span>
      <img v-if="getStoreImageUrl(product.image_url)" :src="product.image_url" :alt="product.title" loading="lazy" />
      <Icon v-else :name="getStoreCategoryIcon(categoryName)" size="56" class="store-product-placeholder" />
    </NuxtLinkLocale>
    <div class="store-product-info">
      <div class="store-product-price">
        <strong>{{ priceFormatter.format(numericPrice) }} <small>EGP</small></strong>
        <del v-if="hasDiscount">{{ formatPrice(product.old_price) }}</del>
      </div>
      <p v-if="brandName || categoryName" class="store-product-brand">{{ brandName || categoryName }}</p>
      <NuxtLinkLocale :to="product.slug ? `/products/${product.slug}` : '/search'" class="store-product-title"><h3>{{ product.title }}</h3></NuxtLinkLocale>
      <p class="store-product-stock" :class="{ 'store-product-stock-unavailable': isOutOfStock && !isPreorder }">
        <Icon :name="isOutOfStock ? 'lucide:clock-3' : 'lucide:check'" size="13" />
        {{ isComingSoon ? $t('common.comingSoon') : isPreorder ? $t('common.preOrder') : isOutOfStock ? (isPurchasable ? $t('common.availableToOrder') : $t('common.outOfStock')) : $t('common.inStock') }}
      </p>
      <button type="button" :disabled="!isPurchasable" :aria-label="requiresOptionSelection ? $t('cards.ProductCard.chooseOptionsForValue', { value0: (product.title) }) : $t('common.addValueToCart', { value0: (product.title) })" class="store-product-add" @click="handleAddToCart">
        <Icon :name="addedToCart ? 'lucide:check' : (requiresOptionSelection ? 'lucide:sliders-horizontal' : 'lucide:plus')" size="15" />
        {{ isComingSoon ? $t('common.comingSoon') : isPreorder ? $t('common.viewPreOrder') : !isPurchasable ? $t('common.outOfStock') : (addedToCart ? $t('common.added') : (requiresOptionSelection ? $t('common.options') : $t('common.addToCart'))) }}
      </button>
      <span class="sr-only" role="status">{{ $uiMessage(cartFeedback) }}</span>
    </div>
  </article>
</template>

<script setup>
const { intlLocale } = useUiLocale()

const { uiNavigateTo } = useUiNavigation()

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

const priceFormatter = computed(() => new Intl.NumberFormat(intlLocale.value))

const numericPrice = computed(() => Number(props.product.price || 0))
const numericOldPrice = computed(() => Number(props.product.old_price || 0))
const brandName = computed(() => String(props.product.brand?.name || '').trim())
const categoryName = computed(() => String(props.product.category?.name || '').trim())
const isOutOfStock = computed(() => Number(props.product.stock_quantity || 0) <= 0)
const isPreorder = computed(() => props.product.selling_mode === 'preorder')
const isComingSoon = computed(() => props.product.selling_mode === 'coming_soon')
const allowOutOfStockPurchases = computed(() => {
  return Boolean(siteContent.value?.settings?.allow_out_of_stock_purchases)
    && !props.product.is_serialized
})
const isPurchasable = computed(() => isComingSoon.value ? false : isPreorder.value ? true : !isOutOfStock.value || allowOutOfStockPurchases.value)
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
  return `${priceFormatter.value.format(Number(value || 0))} EGP`
}

const openProductOptions = async () => {
  if (!props.product.slug) {
    return
  }

  await uiNavigateTo(`/products/${props.product.slug}`)
}

const handleAddToCart = async () => {
  if (!isPurchasable.value) {
    return
  }

  if (isPreorder.value || requiresOptionSelection.value) {
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
