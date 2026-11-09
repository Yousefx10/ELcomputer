<script setup>
import { normalizeProductPageConfig, formatProductPagePrice, premiumSpecificationContent } from '~/utils/productPage'
import { curatedProductTags, isProductTag, parsePackageEntry } from '~/utils/productFinishing'
import { productHighlights } from '~/utils/specificationLibrary'
import { normalizeProductWarranty, warrantyDurationKey } from '~/utils/warranty'
import { variantSalePrice, productOptionPriceRange } from '~/utils/productOptions'
import { productSavings } from '~/utils/productDetail'
import { usePublicImageUrl } from '~/composables/usePublicImageUrl'
const { stockIndependentSale, allowOutOfStockPurchases, backorderNotice, product, pending, error, productAppearance, premiumPurchasingEnabled, categoryName, intlLocale,
  productVariants, selectedVariant, selectedVariantId, selectedImage, galleryImages, markImageBroken,
  showVariantChoices, hasColorChoices, meaningfulVariantName, getVariantPreview, getVariantColor,
  selectVariant, variantStockLabel, visibleSpecifications, descriptionContent, relatedProducts, reviewSummary, reviewsSection, reviewsComponent,
  updateReviewSummary, goToReviews, isOutOfStock, isPreorder, isComingSoon,
  stockLabel, expectedAvailabilityLabel, preorderAmounts, selectedQuantity, maximumQuantity,
  purchasingPending, decreaseQuantity, increaseQuantity, canPurchaseProduct, handleAddToCart, addToCartLabel, cartMessage } = useProductDetailContext()
const { locale } = useI18n()
const publicImage = usePublicImageUrl()
const config = computed(() => normalizeProductPageConfig(productAppearance.value?.config))
const price = value => formatProductPagePrice(value, intlLocale.value)
const specificationContent = computed(() => premiumSpecificationContent(visibleSpecifications.value))
const groups = computed(() => specificationContent.value.groups.map(group => ({ ...group, items: group.items.filter(row => !isProductTag(row)) })).filter(group => group.items.length))
const topHighlights = computed(() => config.value.sections.highlights ? productHighlights(visibleSpecifications.value.filter(row => !isProductTag(row) && !specificationContent.value.included.some(item => item.id === row.id)), { minimum: 1, maximum: 4 }) : [])
const tags = computed(() => curatedProductTags(visibleSpecifications.value))
const includedItems = computed(() => config.value.sections.included ? specificationContent.value.included : [])
const policies = computed(() => config.value.policy_links.map(row => ({ ...row, label: locale.value === 'ar' ? row.label_ar.trim() || row.label.trim() : row.label.trim() || row.label_ar.trim() })))
const warranty = computed(() => normalizeProductWarranty(product.value || {}))
const canOrder = computed(() => premiumPurchasingEnabled.value && canPurchaseProduct.value)
const currentSku = computed(() => selectedVariant.value?.sku || product.value?.sku || '')
const priceRange = computed(() => productOptionPriceRange(product.value, productVariants.value))
const currentPrice = computed(() => selectedVariant.value ? variantSalePrice(product.value, selectedVariant.value) : priceRange.value.minimum)
const hasPriceRange = computed(() => !selectedVariant.value && priceRange.value.maximum > currentPrice.value)
const savingsInfo = computed(() => hasPriceRange.value ? { amount: 0, percent: 0 } : productSavings(currentPrice.value, product.value?.old_price))
const stockState = computed(() => isComingSoon.value ? 'soon' : isPreorder.value ? 'preorder' : isOutOfStock.value ? 'out' : 'in')

// Authored relationships and videos are optional additions, never inferred data.
const { data: presentation, error: presentationError } = await useAsyncData(`product-presentation-${product.value?.id}`, async () => {
  if (!product.value) return { videos: [], related: [], compatible: [] }
  return $fetch(`/api/storefront/products/${product.value.id}/presentation`, { retry: 0 })
})
const videos = computed(() => (presentation.value?.videos || []).filter(item => !item.variant_id || item.variant_id === selectedVariantId.value))
const media = computed(() => {
  const imageOrder = new Map((product.value?.images || []).map(item => [item.image_url, Number(item.sort_order || 0)]))
  return [...galleryImages.value.map((item, index) => ({ ...item, type: 'image', sort_order: item.url === product.value?.image_url ? -1 : imageOrder.get(item.url) ?? index })), ...videos.value.map(item => ({ url: item.url, alt: locale.value === 'ar' ? item.label_ar || item.label : item.label || item.label_ar, type: 'video', sort_order: item.sort_order }))].sort((a, b) => a.sort_order - b.sort_order)
})
const related = computed(() => presentation.value?.related_curated ? presentation.value.related || [] : relatedProducts.value)
const compatible = computed(() => presentation.value?.compatible || [])
const hasFamily = computed(() => presentation.value?.family?.members?.length > 1)
const sections = computed(() => [
  config.value.sections.overview && descriptionContent.value.length && { id: 'pm-overview', label: 'overview' },
  config.value.sections.features && product.value?.features?.length && { id: 'pm-features', label: 'features' },
  includedItems.value.length && { id: 'pm-included', label: 'included' },
  config.value.sections.specifications && groups.value.length && { id: 'pm-specifications', label: 'specifications' },
  config.value.sections.reviews && { id: 'pm-reviews', label: 'reviews' },
  config.value.sections.related && related.value.length && { id: 'pm-related', label: 'related' }
].filter(Boolean))
const show = id => sections.value.some(row => row.id === id)

// Specification groups stay compact until opened.
const expandedSpecs = ref(false)
const specRows = computed(() => groups.value.reduce((total, group) => total + group.items.length, 0))
const visibleGroups = computed(() => {
  if (expandedSpecs.value || specRows.value <= 12) return groups.value
  let left = 12
  return groups.value.map(group => { const items = group.items.slice(0, Math.max(0, left)); left -= items.length; return { ...group, items } }).filter(group => group.items.length)
})

// A short confirmation after a successful add; the cart keeps the real state.
const added = ref(false)
let addedTimer
const add = () => {
  handleAddToCart()
  if (cartMessage.value === 'Added to cart.' || cartMessage.value === 'Cart updated.') {
    added.value = true; clearTimeout(addedTimer); addedTimer = setTimeout(() => { added.value = false }, 2400)
  }
}

// The quick bar appears once the main buy button scrolls above the screen.
const buyBox = ref(null), quickBar = ref(false), activeSection = ref('')
let observers = [], frame = 0
const checkBar = () => { frame = 0; quickBar.value = !!buyBox.value && buyBox.value.getBoundingClientRect().bottom < 0 }
const onScroll = () => { if (!frame) frame = requestAnimationFrame(checkBar) }
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true }); checkBar()
  if (!('IntersectionObserver' in window)) return
  const spy = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) activeSection.value = entry.target.id
  }, { rootMargin: '-30% 0px -60% 0px' })
  watch(sections, () => nextTick(() => { spy.disconnect(); for (const row of sections.value) { const el = document.getElementById(row.id); if (el) spy.observe(el) } }), { immediate: true })
  observers = [spy]
})
onBeforeUnmount(() => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); observers.forEach(observer => observer.disconnect()); clearTimeout(addedTimer) })
// Open on the first photo of the gallery; option choices still switch photos.
watch(() => product.value?.id, () => { if (media.value[0]) selectedImage.value = media.value[0].url }, { immediate: true })
const thumb = computed(() => { const url = galleryImages.value[0]?.url || product.value?.image_url; return url ? publicImage(url) : '' })
</script>

<template>
  <div class="product-modern">
    <div class="pm-shell">
      <LayoutPageLoading v-if="pending" :label="$t('common.loadingProduct')" />
      <p v-else-if="error" role="alert">{{ $uiMessage(error.message) }}</p>
      <p v-else-if="!product" class="pm-empty">{{ $t('common.productNotFound') }}</p>
      <article v-else>
        <nav class="pm-breadcrumb" :aria-label="$t('common.productLocation')">
          <NuxtLinkLocale to="/">{{ $t('common.home') }}</NuxtLinkLocale><Icon name="lucide:chevron-right" class="directional-icon" size="13" aria-hidden="true" />
          <NuxtLinkLocale v-if="product.category?.slug" :to="{ path: '/search', query: { category: product.category.slug } }">{{ categoryName(product.category) }}</NuxtLinkLocale><span v-else>{{ $t('common.products') }}</span>
          <template v-if="product.brand?.slug"><Icon name="lucide:chevron-right" class="directional-icon" size="13" aria-hidden="true" /><NuxtLinkLocale :to="`/brand/${product.brand.slug}`">{{ product.brand.name }}</NuxtLinkLocale></template>
        </nav>

        <div class="pm-hero">
          <div class="pm-media">
            <div class="pm-badges">
              <span v-if="savingsInfo.percent" class="pm-badge pm-badge-sale">{{ $t('productModern.percentOff', { value: savingsInfo.percent }) }}</span>
              <span v-if="isPreorder" class="pm-badge pm-badge-info">{{ $uiLabel('Pre-order') }}</span>
              <span v-else-if="isComingSoon" class="pm-badge pm-badge-info">{{ $uiLabel('Coming Soon') }}</span>
              <span v-if="product.is_top_seller" class="pm-badge pm-badge-hot">{{ $t('productModern.bestSeller') }}</span>
            </div>
            <ProductPremiumGallery :items="media" v-model="selectedImage" :title="product.title" @image-error="markImageBroken" />
          </div>

          <section class="pm-info" :aria-label="product.title">
            <div class="pm-eyebrow">
              <NuxtLinkLocale v-if="product.brand?.slug" :to="`/brand/${product.brand.slug}`" class="pm-brand"><img v-if="product.brand.logo_url" :src="product.brand.logo_url" alt="" width="56" height="28" loading="lazy"><span>{{ product.brand.name }}</span></NuxtLinkLocale>
              <span v-else-if="product.brand?.name" class="pm-brand"><span>{{ product.brand.name }}</span></span>
            </div>
            <h1 class="pm-title">{{ product.title }}</h1>
            <div class="pm-meta">
              <button v-if="config.sections.reviews" type="button" class="pm-rating" @click="goToReviews">
                <span v-if="reviewSummary.total" class="pm-stars" aria-hidden="true"><Icon v-for="star in 5" :key="star" name="lucide:star" :class="star <= Math.round(reviewSummary.average) ? 'fill-current' : ''" size="14" /></span>
                <span>{{ reviewSummary.total === null ? $t('common.viewReviews') : reviewSummary.total ? `${reviewSummary.average.toFixed(1)} (${reviewSummary.total})` : $t('common.noReviewsYet') }}</span>
              </button>
              <span v-if="specificationContent.model" class="pm-code">{{ $t('productPage.model') }} <bdi>{{ specificationContent.model }}</bdi></span>
              <span v-if="currentSku" class="pm-code">{{ $t('productPage.sku') }} <bdi>{{ currentSku }}</bdi></span>
            </div>

            <div class="pm-price-card">
              <div class="pm-price-row">
                <span class="pm-price"><bdi>{{ price(currentPrice) }}<template v-if="hasPriceRange"> – {{ price(priceRange.maximum) }}</template></bdi></span>
                <del v-if="savingsInfo.amount > 0"><bdi>{{ price(product.old_price) }}</bdi></del>
                <span v-if="savingsInfo.amount > 0" class="pm-save">{{ $t('product.saveAmount', { value0: price(savingsInfo.amount) }) }}</span>
                <p v-if="!showVariantChoices && selectedVariant && meaningfulVariantName" class="pm-single-option">{{ $t('common.option') }} <strong>{{ selectedVariant.name }}</strong></p>
              </div>
              <p v-if="!stockIndependentSale" class="pm-stock" :data-state="stockState"><span class="pm-stock-dot" aria-hidden="true" />{{ $uiLabel(stockLabel) }}</p>
              <p v-if="backorderNotice && !stockIndependentSale" class="pm-note" role="note">{{ backorderNotice }}</p>
              <div v-if="isPreorder || isComingSoon" class="pm-note">
                <p v-if="product.expected_availability_date">{{ $t('products.slug.expectedAvailabilityValue', { value0: expectedAvailabilityLabel(product.expected_availability_date) }) }}</p>
                <p v-if="product.availability_message">{{ product.availability_message }}</p>
                <p>{{ $t('products.slug.thisItemIsNotReadyForNormalDelivery') }}</p>
                <template v-if="isPreorder"><p>{{ $t('common.requiredNow') }} <strong>{{ price(preorderAmounts.due) }}</strong></p><p v-if="preorderAmounts.balance">{{ $t('common.remainingBalance') }} <strong>{{ price(preorderAmounts.balance) }}</strong></p></template>
              </div>
            </div>

            <ul v-if="tags.length" class="pm-tags" :aria-label="$t('productFinishing.productTags')"><li v-for="tag in tags" :key="tag"><bdi>{{ tag }}</bdi></li></ul>

            <ProductFamilyOptions :key="`family-${product.id}`" :family="presentation?.family" :product-id="product.id" />
            <p v-if="hasFamily && showVariantChoices" class="pm-subhead">{{ $t('productFamily.internalOptions') }}</p>
            <ProductVariantOptions v-if="showVariantChoices" :key="product.id" :variants="productVariants" :selected-id="selectedVariantId" :color-choices="hasColorChoices"
              :allow-backorder="allowOutOfStockPurchases" :preorder="isPreorder" :stock-independent="stockIndependentSale"
              :preview="getVariantPreview" :color="getVariantColor" :stock-label="variantStockLabel" @select="selectVariant" />

            <div ref="buyBox" class="pm-buy">
              <div v-if="premiumPurchasingEnabled && !isComingSoon" class="pm-qty" :aria-label="$t('common.quantity')">
                <button type="button" :disabled="!canPurchaseProduct || selectedQuantity <= 1" :aria-label="$t('common.decreaseQuantity')" @click="decreaseQuantity"><Icon name="lucide:minus" size="16" aria-hidden="true" /></button>
                <output :aria-label="$t('common.selectedQuantity')">{{ selectedQuantity }}</output>
                <button type="button" :disabled="!canPurchaseProduct || selectedQuantity >= maximumQuantity" :aria-label="$t('common.increaseQuantity')" @click="increaseQuantity"><Icon name="lucide:plus" size="16" aria-hidden="true" /></button>
              </div>
              <button v-if="!isComingSoon" type="button" class="pm-add" :data-added="added" :aria-busy="purchasingPending" :disabled="!canOrder" @click="add">
                <Icon :name="added ? 'lucide:check' : 'lucide:shopping-bag'" size="19" aria-hidden="true" />
                <span>{{ added ? $t('productModern.added') : purchasingPending ? $t('productPage.checkingPurchase') : premiumPurchasingEnabled ? $uiLabel(addToCartLabel) : $t('productPage.buyingHeld') }}</span>
              </button>
              <ProductPremiumActions :key="product.id" :product="product" mode="favorite" />
            </div>
            <p v-if="cartMessage" class="pm-cart-status" role="status">{{ $uiMessage(cartMessage) }} <NuxtLinkLocale v-if="added" to="/cart">{{ $t('productModern.viewCart') }}</NuxtLinkLocale></p>

            <div class="pm-assurance">
              <div class="pm-assure" data-product-warranty><span class="pm-assure-icon" aria-hidden="true"><Icon name="lucide:shield-check" size="18" /></span><div><strong>{{ $t('warranty.title') }}</strong><span>{{ warranty.warranty_status === 'included' ? $t(warrantyDurationKey({ value: warranty.warranty_duration_value, unit: warranty.warranty_duration_unit }), { value: warranty.warranty_duration_value }) : $t(warranty.warranty_status === 'none' ? 'warranty.none' : 'warranty.unavailable') }}</span></div></div>
              <nav v-if="policies.length" class="pm-policies" :aria-label="$t('productPage.support')"><NuxtLinkLocale v-for="item in policies" :key="item.id" :to="item.url">{{ item.label }}<Icon name="lucide:arrow-up-right" size="14" aria-hidden="true" /></NuxtLinkLocale></nav>
              <ProductPremiumHelp />
              <ProductPremiumActions :key="`share-${product.id}`" :product="product" mode="share" />
            </div>
            <ProductBuyWithIt :key="`buy-${product.id}`" :product-id="product.id" :items="compatible" />
          </section>
        </div>

        <p v-if="presentationError" class="pm-hint" role="status">{{ $t('productPage.detailsUnavailable') }}</p>

        <section v-if="topHighlights.length" class="pm-highlights" :aria-label="$t('productPage.sections.highlights')">
          <div v-for="item in topHighlights" :key="item.label" class="pm-highlight"><span>{{ item.label }}</span><strong><bdi>{{ item.value }}</bdi></strong></div>
        </section>

        <nav v-if="sections.length > 1" class="pm-tabs" :aria-label="$t('productPage.jumpTo')">
          <div class="pm-tabs-links"><a v-for="row in sections" :key="row.id" :href="`#${row.id}`" :aria-current="activeSection === row.id ? 'true' : undefined">{{ $t(`productPage.sections.${row.label}`) }}</a></div>
          <div v-if="quickBar && !isComingSoon && premiumPurchasingEnabled" class="pm-tabs-buy"><bdi>{{ price(currentPrice) }}</bdi><button type="button" :disabled="!canOrder" @click="add">{{ added ? $t('productModern.added') : $uiLabel(addToCartLabel) }}</button></div>
        </nav>

        <div class="pm-sections">
          <section v-if="show('pm-overview')" id="pm-overview" class="pm-section"><h2>{{ $t('productPage.sections.overview') }}</h2><ProductPremiumDescription :blocks="descriptionContent" /></section>
          <section v-if="show('pm-features')" id="pm-features" class="pm-section"><h2>{{ $t('productPage.sections.features') }}</h2><ul class="pm-features"><li v-for="item in product.features" :key="item.id"><span class="pm-feature-mark" aria-hidden="true"><Icon name="lucide:check" size="15" /></span>{{ item.body }}</li></ul></section>
          <section v-if="show('pm-included')" id="pm-included" class="pm-section"><h2>{{ $t('productFinishing.inTheBox') }}</h2>
            <ul class="pm-box"><li v-for="row in includedItems" :key="row.id"><template v-if="parsePackageEntry(row.value)"><bdi>{{ parsePackageEntry(row.value).name }}</bdi><span class="pm-box-qty">×{{ parsePackageEntry(row.value).quantity }}</span></template><template v-else><strong>{{ row.displayLabel }}</strong><span>{{ row.value }}</span></template></li></ul>
          </section>
          <section v-if="show('pm-specifications')" id="pm-specifications" class="pm-section"><h2>{{ $t('productPage.sections.specifications') }}</h2>
            <div class="pm-spec-groups"><div v-for="(group, groupIndex) in visibleGroups" :key="groupIndex" class="pm-spec-group"><h3 v-if="group.name">{{ group.name }}</h3><dl><div v-for="row in group.items" :key="row.id"><dt :title="row.definition?.help_text || undefined">{{ row.displayLabel }}</dt><dd>{{ row.value }}</dd></div></dl></div></div>
            <button v-if="specRows > 12" type="button" class="pm-more" :aria-expanded="expandedSpecs" @click="expandedSpecs = !expandedSpecs">{{ expandedSpecs ? $t('productModern.showLess') : $t('productModern.showAll', { count: specRows }) }}<Icon :name="expandedSpecs ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="16" aria-hidden="true" /></button>
          </section>
          <section v-if="show('pm-reviews')" id="pm-reviews" ref="reviewsSection" class="pm-section"><h2>{{ $t('productPage.sections.reviews') }}</h2><ProductReviews ref="reviewsComponent" :product-id="product.id" :product-name="product.title" @summary-change="updateReviewSummary" /></section>
          <section v-if="show('pm-related')" id="pm-related" class="pm-section pm-related"><h2>{{ $t('productPage.related') }}</h2><div class="pm-related-row"><CardsProductCard v-for="item in related" :key="item.id" :product="item" /></div></section>
        </div>
      </article>
    </div>

    <div v-if="product && !isComingSoon && premiumPurchasingEnabled" class="pm-quickbar" :data-visible="quickBar" :inert="!quickBar || undefined" :aria-hidden="!quickBar || undefined">
      <img v-if="thumb" :src="thumb" alt="" width="44" height="44" loading="lazy">
      <div class="pm-quickbar-text"><span>{{ product.title }}</span><strong><bdi>{{ price(currentPrice) }}</bdi></strong></div>
      <button type="button" :disabled="!canOrder" @click="add"><Icon :name="added ? 'lucide:check' : 'lucide:shopping-bag'" size="17" aria-hidden="true" /><span>{{ added ? $t('productModern.added') : $uiLabel(addToCartLabel) }}</span></button>
    </div>
  </div>
</template>
