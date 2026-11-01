<template>
  <article class="store-product-card">
    <NuxtLinkLocale :to="product.slug ? `/products/${product.slug}` : '/search'" class="store-product-image" :aria-label="product.title">
      <span v-if="discountPercent > 0" class="store-product-badge">{{ $t('common.saveValueVariant2', { value0: (discountPercent) }) }}</span>
      <span v-else-if="product.is_featured" class="store-product-badge store-product-badge-featured">{{ $t('common.featured') }}</span>
      <img v-if="getStoreImageUrl(product.image_url)" :src="product.image_url" :alt="product.title" loading="lazy" />
      <Icon v-else :name="getStoreCategoryIcon(product.category?.name)" size="56" class="store-product-placeholder" />
    </NuxtLinkLocale>
    <div class="store-product-info">
      <div class="store-product-price">
        <strong>{{ priceFormatter.format(numericPrice) }} <small>EGP</small></strong>
        <del v-if="hasDiscount">{{ formatPrice(product.old_price) }}</del>
      </div>
      <p v-if="brandName || categoryName" class="store-product-brand">{{ brandName || categoryName }}</p>
      <NuxtLinkLocale :to="product.slug ? `/products/${product.slug}` : '/search'" class="store-product-title"><h3>{{ product.title }}</h3></NuxtLinkLocale>
      <p v-if="!usesUnrecordedStockSales(product, siteContent?.settings) && !checkingAvailability && !requiresOptionSelection" class="store-product-stock" :class="{ 'store-product-stock-unavailable': isOutOfStock && !isPreorder }">
        <Icon :name="isOutOfStock ? 'lucide:clock-3' : 'lucide:check'" size="13" />
        {{ isComingSoon ? $t('common.comingSoon') : isPreorder ? $t('common.preOrder') : isOutOfStock ? (isPurchasable ? $t('common.availableToOrder') : $t('common.outOfStock')) : $t('common.inStock') }}
      </p>
      <button v-if="checkingAvailability || purchasingAllowed && (isPurchasable || isComingSoon || isPreorder || requiresOptionSelection)" type="button" :disabled="!isPurchasable || actionPending || addedToCart" :aria-label="checkingAvailability ? $t('productPage.checkingPurchase') : !purchasingAllowed ? $t('productPage.buyingHeld') : isComingSoon ? $t('common.comingSoon') : isPreorder ? $t('common.viewPreOrder') : !isPurchasable ? $t('common.outOfStock') : requiresOptionSelection ? $t('cards.ProductCard.chooseOptionsForValue', { value0: (product.title) }) : $t('common.addValueToCart', { value0: (product.title) })" class="store-product-add" :aria-busy="checkingAvailability || actionPending" @click="handleAddToCart">
        <Icon :name="addedToCart ? 'lucide:check' : (requiresOptionSelection || isPreorder ? 'lucide:sliders-horizontal' : 'lucide:plus')" size="15" />
        {{ checkingAvailability ? $t('productPage.checkingPurchase') : !purchasingAllowed ? $t('productPage.buyingHeld') : isComingSoon ? $t('common.comingSoon') : isPreorder ? $t('common.viewPreOrder') : !isPurchasable ? $t('common.outOfStock') : (addedToCart ? $t('common.added') : (requiresOptionSelection ? $t('common.options') : $t('common.addToCart'))) }}
      </button>
      <p v-if="optionsError" class="mt-2 text-xs text-[var(--text-secondary)]" role="status">{{ $t('cards.ProductCard.optionsCheckFailed') }}</p>
      <p v-if="cartError" class="mt-2 text-xs text-[var(--text-secondary)]" role="alert">{{ $uiMessage(cartError) }}</p>
      <span class="sr-only" role="status">{{ $uiMessage(cartFeedback) }}</span>
    </div>
  </article>
</template>

<script setup>
const { categoryName: localizedCategoryName } = useCategoryLocale()

const { intlLocale } = useUiLocale()

const { uiNavigateTo } = useUiNavigation()

import { getStoreCategoryIcon, getStoreImageUrl } from '~/utils/storefront'
import { usesUnrecordedStockSales } from '~/utils/backorder'
import { productCardPurchase } from '~/utils/productCardPurchase'
import { useProductCardVariants } from '~/composables/useProductCardVariants'
const props = defineProps({
  product: {
    type: Object,
    required: true
  }
})

const { data: siteContent } = useSiteContent()
const { t } = useI18n()
const { addItem } = useCart()
const { allowsProduct, scope: purchaseScope, pending: purchasingPending } = usePurchaseAccess()
const addedToCart = ref(false)
const cartFeedback = ref('')
const cartError = ref('')
const actionPending = ref(false)
const { variants: cardVariants, pending: optionsPending, error: optionsError } = useProductCardVariants(computed(() => props.product))
let feedbackTimeout
onBeforeUnmount(() => clearTimeout(feedbackTimeout))
watch(() => props.product.id, () => { clearTimeout(feedbackTimeout); addedToCart.value = false; cartFeedback.value = ''; cartError.value = '' })

const priceFormatter = computed(() => new Intl.NumberFormat(intlLocale.value))

const numericPrice = computed(() => Number(props.product.price || 0))
const numericOldPrice = computed(() => Number(props.product.old_price || 0))
const brandName = computed(() => String(props.product.brand?.name || '').trim())
const categoryName = computed(() => localizedCategoryName(props.product.category))
const purchase = computed(() => productCardPurchase(props.product, siteContent.value?.settings, cardVariants.value, Boolean(purchaseScope.value)))
const isOutOfStock = computed(() => Number(purchase.value.stock ?? props.product.stock_quantity ?? 0) <= 0)
const isPreorder = computed(() => props.product.selling_mode === 'preorder')
const isComingSoon = computed(() => props.product.selling_mode === 'coming_soon')
const allowOutOfStockPurchases = computed(() => purchase.value.allowBackorder)
const purchasingAllowed = computed(() => allowsProduct(props.product.id))
const checkingAvailability = computed(() => purchasingPending.value || optionsPending.value)
const isPurchasable = computed(() => !checkingAvailability.value && purchasingAllowed.value && purchase.value.kind !== 'unavailable')
const requiresOptionSelection = computed(() => purchase.value.kind === 'options')

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
  if (!isPurchasable.value || actionPending.value || addedToCart.value) {
    return
  }

  actionPending.value = true
  cartError.value = ''
  try {
    if (isPreorder.value || requiresOptionSelection.value) { await openProductOptions(); return }
    const selected = purchase.value
    if (!allowsProduct(props.product.id, selected.variant?.id || null)) return
    const result = addItem({
      ...props.product, variant: selected.variant, variant_id: selected.variant?.id || null,
      stock_quantity: selected.stock, variant_stock_quantity: selected.stock,
      allow_out_of_stock_purchases: allowOutOfStockPurchases.value
    }, 1, { source: 'product_card' })
    cartFeedback.value = result.success ? t('common.addedToCart') : result.message
    cartError.value = result.success ? '' : result.message
    addedToCart.value = result.success
    clearTimeout(feedbackTimeout)
    feedbackTimeout = setTimeout(() => { addedToCart.value = false }, 2200)
  } catch {
    cartError.value = t('cards.ProductCard.cartUpdateFailed')
    cartFeedback.value = cartError.value
  } finally { actionPending.value = false }
}
</script>
