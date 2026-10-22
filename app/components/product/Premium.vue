<script setup>
import { normalizeProductPageConfig, formatProductPagePrice, premiumSpecificationContent } from '~/utils/productPage'
import { productHighlights } from '~/utils/specificationLibrary'
import { normalizeProductWarranty } from '~/utils/warranty'
const { product, pending, error, productAppearance, premiumPurchasingEnabled, categoryName, intlLocale,
  productVariants, selectedVariant, selectedVariantId, selectedImage, galleryImages, markImageBroken,
  showVariantChoices, hasColorChoices, meaningfulVariantName, getVariantPreview, getVariantColor, getVariantMeta,
  selectVariant, variantStockLabel, selectedVariantStockLabel, hasPurchasableVariants, visibleSpecifications,
  specificationGroups, descriptionContent, relatedProducts, reviewSummary, reviewsSection, reviewsComponent,
  updateReviewSummary, goToReviews, hasDiscount, savings, discountPercent, isOutOfStock, isPreorder, isComingSoon,
  stockLabel, expectedAvailabilityLabel, preorderAmounts, preorderAvailability, selectedQuantity, maximumQuantity,
  decreaseQuantity, increaseQuantity, canPurchaseProduct, handleAddToCart, addToCartLabel, cartMessage } = useProductDetailContext()
const { locale } = useI18n()
const { uiLabel } = useUiLocale()
const config = computed(() => normalizeProductPageConfig(productAppearance.value?.config))
const price = value => formatProductPagePrice(value, intlLocale.value)
const topHighlights = computed(() => config.value.sections.highlights ? productHighlights(visibleSpecifications.value, { minimum: 1, maximum: 4 }) : [])
const specificationContent = computed(() => premiumSpecificationContent(visibleSpecifications.value))
const premiumGroups = computed(() => specificationContent.value.groups)
const includedItems = computed(() => config.value.sections.included ? specificationContent.value.included : [])
const quickSpecifications = computed(() => premiumGroups.value.flatMap(group => group.items).filter(row => !row.is_highlight).slice(0, 4))
const policies = computed(() => config.value.policy_links.map(row => ({ ...row, label: locale.value === 'ar' ? row.label_ar.trim() || row.label.trim() : row.label.trim() || row.label_ar.trim() })))
const warranty = computed(() => normalizeProductWarranty(product.value || {}))
const canOrder = computed(() => premiumPurchasingEnabled.value && canPurchaseProduct.value)
const currentSku = computed(() => selectedVariant.value?.sku || product.value?.sku || '')
const variantsElement = ref(null)
const variantKeydown = async event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const choices = productVariants.value, current = choices.findIndex(item => item.id === selectedVariantId.value)
  const forward = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1
  const direction = ['ArrowLeft', 'ArrowRight'].includes(event.key) && locale.value === 'ar' ? -forward : forward
  const position = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (Math.max(0, current) + direction + choices.length) % choices.length
  if (choices[position]) { selectVariant(choices[position]); await nextTick(); variantsElement.value?.querySelectorAll('[role="radio"]')[position]?.focus() }
}

// These authored relationships/videos are optional additions, not inferred data.
const { data: presentation, error: presentationError } = await useAsyncData(`product-presentation-${product.value?.id}`, async () => {
  if (!product.value) return { videos: [], related: [], compatible: [] }
  return $fetch(`/api/storefront/products/${product.value.id}/presentation`, { retry: 0 })
})
const videos = computed(() => (presentation.value?.videos || []).filter(item => !item.variant_id || item.variant_id === selectedVariantId.value))
const media = computed(() => {
  const imageOrder = new Map((product.value?.images || []).map(item => [item.image_url, Number(item.sort_order || 0)]))
  return [...galleryImages.value.map((item, index) => ({ ...item, type: 'image', sort_order: item.url === product.value?.image_url ? -1 : imageOrder.get(item.url) ?? index })), ...videos.value.map(item => ({ url: item.url, alt: locale.value === 'ar' ? item.label_ar || item.label : item.label || item.label_ar, type: 'video', sort_order: item.sort_order }))].sort((a, b) => a.sort_order - b.sort_order)
})
const curatedRelated = computed(() => presentation.value?.related_curated ? presentation.value.related || [] : relatedProducts.value)
const compatible = computed(() => presentation.value?.compatible || [])
const hasOverview = computed(() => config.value.sections.overview && descriptionContent.value.length > 0)
const hasSpecifications = computed(() => config.value.sections.specifications && premiumGroups.value.length > 0)
const hasFeatures = computed(() => config.value.sections.features && product.value?.features?.length > 0)
const hasRelated = computed(() => config.value.sections.related && curatedRelated.value.length > 0)
const jumpLinks = computed(() => [hasOverview.value && { id: 'pdp-overview', label: 'overview' }, includedItems.value.length && { id: 'pdp-included', label: 'included' }, hasSpecifications.value && { id: 'pdp-specifications', label: 'specifications' }, config.value.sections.reviews && { id: 'pdp-reviews', label: 'reviews' }, hasRelated.value && { id: 'pdp-related', label: 'related' }].filter(Boolean))
</script>

<template>
  <div class="product-premium">
    <div class="pdp-container">
      <LayoutPageLoading v-if="pending" :label="$t('common.loadingProduct')" />
      <p v-else-if="error" role="alert">{{ $uiMessage(error.message) }}</p>
      <p v-else-if="!product" class="pdp-empty">{{ $t('common.productNotFound') }}</p>
      <article v-else>
        <nav class="pdp-breadcrumb" :aria-label="$t('common.productLocation')"><NuxtLinkLocale to="/">{{ $t('common.home') }}</NuxtLinkLocale><Icon name="lucide:chevron-right" class="directional-icon" size="13" aria-hidden="true" /><NuxtLinkLocale v-if="product.category?.slug" :to="{ path: '/search', query: { category: product.category.slug } }">{{ categoryName(product.category) }}</NuxtLinkLocale><span v-else>{{ $t('common.products') }}</span></nav>
        <div class="pdp-main-grid" :class="{ 'pdp-main-minimal': !topHighlights.length && !quickSpecifications.length && !showVariantChoices }">
          <ProductPremiumGallery :items="media" v-model="selectedImage" :title="product.title" @image-error="markImageBroken" />
          <section class="pdp-information" :aria-label="product.title">
            <NuxtLinkLocale v-if="product.brand?.slug" :to="`/brand/${product.brand.slug}`" class="pdp-brand"><img v-if="product.brand.logo_url" :src="product.brand.logo_url" alt="" width="64" height="32" loading="lazy">{{ product.brand.name }}</NuxtLinkLocale>
            <h1>{{ product.title }}</h1>
            <div v-if="config.sections.reviews || currentSku || specificationContent.model" class="pdp-product-meta">
              <button v-if="config.sections.reviews" type="button" class="pdp-review-summary" @click="goToReviews"><span v-if="reviewSummary.total" class="pdp-stars" aria-hidden="true"><Icon v-for="star in 5" :key="star" name="lucide:star" :class="star <= Math.round(reviewSummary.average) ? 'fill-current' : ''" size="14" /></span><span>{{ reviewSummary.total === null ? $t('common.viewReviews') : reviewSummary.total ? `${reviewSummary.average.toFixed(1)} (${reviewSummary.total})` : $t('common.noReviewsYet') }}</span></button>
              <span v-if="specificationContent.model" class="pdp-sku">{{ $t('productPage.model') }} <bdi>{{ specificationContent.model }}</bdi></span>
              <span v-if="currentSku" class="pdp-sku">{{ $t('productPage.sku') }} <bdi>{{ currentSku }}</bdi></span>
            </div>
            <dl v-if="topHighlights.length" class="pdp-highlights"><div v-for="item in topHighlights" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
            <div v-if="showVariantChoices" class="pdp-variants">
              <div class="pdp-variant-heading"><h2>{{ hasColorChoices ? $t('common.color') : $t('common.chooseAnOption') }}<span v-if="selectedVariant">: {{ hasColorChoices ? selectedVariant.color_name : selectedVariant.name }}</span></h2></div>
              <div ref="variantsElement" class="pdp-variant-options" role="radiogroup" :aria-label="hasColorChoices ? $t('common.availableColors') : $t('common.productOptions')" @keydown="variantKeydown">
                <button v-for="(variant, position) in productVariants" :key="variant.id" type="button" role="radio" :aria-checked="selectedVariantId === variant.id" :tabindex="selectedVariantId === variant.id || !selectedVariantId && position === 0 ? 0 : -1" @click="selectVariant(variant)">
                  <span v-if="getVariantPreview(variant)" class="pdp-variant-image"><img :src="getVariantPreview(variant)" alt="" width="52" height="52" loading="lazy" @error="markImageBroken(getVariantPreview(variant))"></span><span v-else-if="getVariantColor(variant)" class="pdp-swatch" :style="{ backgroundColor: getVariantColor(variant) }" /><Icon v-else name="lucide:package" size="20" aria-hidden="true" />
                  <span><strong>{{ hasColorChoices ? variant.color_name : variant.name }}</strong><small>{{ $uiLabel(variantStockLabel(variant)) }}</small></span><Icon v-if="selectedVariantId === variant.id" name="lucide:check" size="16" aria-hidden="true" />
                </button>
              </div>
              <p v-if="!selectedVariant && hasPurchasableVariants" class="pdp-hint">{{ $t('products.slug.selectAValueBeforeAddingToCart', { value0: hasColorChoices ? $t('common.color') : $t('product.option') }) }}</p>
            </div>
            <p v-else-if="selectedVariant && meaningfulVariantName" class="pdp-single-option">{{ $t('common.option') }} <strong>{{ selectedVariant.name }}</strong></p>
            <div v-if="quickSpecifications.length && config.sections.specifications" class="pdp-quick-specifications"><h2>{{ $t('common.specifications') }}</h2><dl><div v-for="row in quickSpecifications" :key="row.id"><dt>{{ row.definition?.name || row.label }}</dt><dd>{{ row.value }}</dd></div></dl><a href="#pdp-specifications">{{ $t('productPage.viewSpecs') }}<Icon name="lucide:arrow-down" size="14" aria-hidden="true" /></a></div>
          </section>
          <aside class="pdp-purchase" :aria-label="$t('productPage.purchaseTitle')">
            <div class="pdp-purchase-summary"><div class="pdp-price"><bdi>{{ price(product.price) }}</bdi><del v-if="hasDiscount"><bdi>{{ price(product.old_price) }}</bdi></del></div>
            <p v-if="hasDiscount" class="pdp-saving">{{ $t('product.saveAmount', { value0: price(savings) }) }}<span v-if="discountPercent"> ({{ discountPercent }}%)</span></p>
            <div class="pdp-stock" :data-available="!isOutOfStock && !isPreorder && !isComingSoon"><Icon :name="isOutOfStock || isPreorder || isComingSoon ? 'lucide:clock-3' : 'lucide:circle-check'" size="18" aria-hidden="true" /><strong>{{ $uiLabel(stockLabel) }}</strong></div>
            <div v-if="isPreorder || isComingSoon" class="pdp-availability-note"><p v-if="product.expected_availability_date">{{ $t('products.slug.expectedAvailabilityValue', { value0: expectedAvailabilityLabel(product.expected_availability_date) }) }}</p><p v-if="product.availability_message">{{ product.availability_message }}</p><p>{{ $t('products.slug.thisItemIsNotReadyForNormalDelivery') }}</p><template v-if="isPreorder"><p>{{ $t('common.requiredNow') }} <strong>{{ price(preorderAmounts.due) }}</strong></p><p v-if="preorderAmounts.balance">{{ $t('common.remainingBalance') }} <strong>{{ price(preorderAmounts.balance) }}</strong></p></template></div>
            </div><div class="pdp-purchase-controls"><div v-if="premiumPurchasingEnabled && !isComingSoon" class="pdp-quantity" :aria-label="$t('common.quantity')"><button type="button" :disabled="!canPurchaseProduct || selectedQuantity <= 1" :aria-label="$t('common.decreaseQuantity')" @click="decreaseQuantity">−</button><output :aria-label="$t('common.selectedQuantity')">{{ selectedQuantity }}</output><button type="button" :disabled="!canPurchaseProduct || selectedQuantity >= maximumQuantity" :aria-label="$t('common.increaseQuantity')" @click="increaseQuantity">+</button></div>
            <button v-if="!isComingSoon" type="button" class="pdp-purchase-action" :disabled="!canOrder" @click="handleAddToCart"><Icon name="lucide:shopping-cart" size="18" aria-hidden="true" />{{ premiumPurchasingEnabled ? $uiLabel(addToCartLabel) : $t('productPage.buyingHeld') }}</button>
            <p v-if="cartMessage" class="pdp-cart-status" role="status">{{ $uiMessage(cartMessage) }}</p>
            </div><div class="pdp-purchase-policies"><ProductWarranty :product="product" /><nav v-if="policies.length" :aria-label="$t('productPage.support')"><NuxtLinkLocale v-for="item in policies" :key="item.id" :to="item.url">{{ item.label }}<Icon name="lucide:arrow-up-right" size="14" aria-hidden="true" /></NuxtLinkLocale></nav></div>
          </aside>
        </div>
        <p v-if="presentationError" class="pdp-hint" role="status">{{ $t('productPage.detailsUnavailable') }}</p>
        <nav v-if="jumpLinks.length > 1" class="pdp-section-navigation" :aria-label="$t('productPage.jumpTo')"><a v-for="link in jumpLinks" :key="link.id" :href="`#${link.id}`">{{ $t(`productPage.sections.${link.label}`) }}</a></nav>
        <div class="pdp-details">
          <section v-if="hasOverview" id="pdp-overview" class="pdp-content-section"><div class="pdp-section-title"><span>{{ $t('common.aboutThisProduct') }}</span><h2>{{ $t('productPage.sections.overview') }}</h2></div><ProductPremiumDescription :blocks="descriptionContent" /></section>
          <section v-if="hasFeatures" class="pdp-content-section"><div class="pdp-section-title"><h2>{{ $t('productPage.sections.features') }}</h2></div><ul class="pdp-feature-list"><li v-for="item in product.features" :key="item.id"><Icon name="lucide:check" size="17" aria-hidden="true" />{{ item.body }}</li></ul></section>
          <section v-if="includedItems.length" id="pdp-included" class="pdp-content-section"><div class="pdp-section-title"><h2>{{ $t('productPage.included') }}</h2></div><dl class="pdp-included"><div v-for="row in includedItems" :key="row.id"><dt>{{ row.displayLabel }}</dt><dd>{{ row.value }}</dd></div></dl></section>
          <section v-if="hasSpecifications" id="pdp-specifications" class="pdp-content-section"><div class="pdp-section-title"><h2>{{ $t('productPage.sections.specifications') }}</h2></div><div class="pdp-specification-groups"><div v-for="(group, groupIndex) in premiumGroups" :key="groupIndex"><h3 v-if="group.name">{{ group.name }}</h3><dl><div v-for="row in group.items" :key="row.id"><dt :title="row.definition?.help_text || undefined">{{ row.displayLabel }}</dt><dd>{{ row.value }}</dd></div></dl></div></div></section>
          <section v-if="config.sections.reviews" id="pdp-reviews" ref="reviewsSection" class="pdp-content-section pdp-reviews"><div class="pdp-section-title"><h2>{{ $t('productPage.sections.reviews') }}</h2></div><ProductReviews ref="reviewsComponent" :product-id="product.id" :product-name="product.title" @summary-change="updateReviewSummary" /></section>
          <section v-if="config.sections.related && compatible.length" class="pdp-recommendations"><h2>{{ $t('productPage.compatibility') }}</h2><div class="pdp-product-cards"><CardsProductCard v-for="item in compatible" :key="item.id" :product="item" /></div></section>
          <section v-if="hasRelated" id="pdp-related" class="pdp-recommendations"><h2>{{ $t('productPage.related') }}</h2><div class="pdp-product-cards"><CardsProductCard v-for="item in curatedRelated" :key="item.id" :product="item" /></div></section>
        </div>
      </article>
    </div>
  </div>
</template>
