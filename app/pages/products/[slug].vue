<template>
  <div class="bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
    <LayoutPageLoading v-if="pending" :label="$t('common.loadingProduct')" class="mx-auto max-w-7xl" />
    <div v-else-if="error" class="mx-auto max-w-7xl rounded-lg bg-red-50 p-8 text-red-700" role="alert">{{ $uiMessage(error.message) }}</div>
    <div v-else-if="!product" class="mx-auto max-w-7xl py-16 text-center text-slate-600">{{ $t('common.productNotFound') }}</div>

    <main v-else class="mx-auto max-w-7xl">
      <nav class="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500" :aria-label="$t('common.productLocation')">
        <NuxtLinkLocale to="/" class="hover:text-blue-700">{{ $t('common.home') }}</NuxtLinkLocale><span aria-hidden="true">/</span>
        <NuxtLinkLocale v-if="product.category" :to="{ path: '/search', query: { category: product.category.slug } }" class="hover:text-blue-700">{{ product.category.name }}</NuxtLinkLocale>
        <span v-else>{{ $t('common.products') }}</span>
      </nav>

      <div class="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:gap-8 xl:gap-12">
        <div class="flex min-w-0 flex-col lg:grid lg:grid-cols-[76px_minmax(0,1fr)] lg:items-start lg:gap-4">
          <div class="order-2 mt-3 flex gap-2 overflow-x-auto pb-2 lg:order-1 lg:mt-0 lg:max-h-[580px] lg:flex-col lg:overflow-y-auto lg:pb-0" :aria-label="$t('common.productImages')">
            <button v-for="(image, index) in galleryImages" :key="image.url" type="button"
              class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-white p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 lg:h-[76px] lg:w-[76px]"
              :class="activeImage?.url === image.url ? 'border-blue-700 ring-1 ring-blue-700' : 'border-slate-200 hover:border-slate-400'"
              :aria-label="$t('products.slug.showProductImageValueOfValue', { value0: (index + 1), value1: (galleryImages.length) })"
              :aria-current="activeImage?.url === image.url ? 'true' : undefined" @click="selectedImage = image.url">
              <img :src="image.url" :alt="image.alt" class="h-full w-full object-contain" @error="markImageBroken(image.url)">
            </button>
          </div>
          <div class="order-1 flex min-h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-white p-4 sm:min-h-[420px] lg:min-h-[540px] lg:p-5">
            <button v-if="activeImage" type="button" class="flex h-full min-h-[230px] w-full cursor-zoom-in items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 sm:min-h-[380px]" :aria-label="$t('products.slug.openImageGalleryImageValueOfValue', { value0: (activeImageIndex + 1), value1: (galleryImages.length) })" @click="openLightbox">
              <img :src="activeImage.url" :alt="activeImage.alt" class="max-h-[230px] w-full object-contain sm:max-h-[390px] lg:max-h-[500px]" @error="markImageBroken(activeImage.url)">
            </button>
            <div v-else class="flex flex-col items-center gap-3 text-slate-400"><Icon name="lucide:image-off" size="42" /><span>{{ $t('common.noImageAvailable') }}</span></div>
          </div>
        </div>

        <div class="min-w-0">
          <NuxtLinkLocale v-if="product.brand" :to="{ path: '/search', query: { brand: product.brand.slug } }" class="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
            <img v-if="product.brand.logo_url" :src="product.brand.logo_url" :alt="''" class="h-7 w-7 object-contain">
            {{ product.brand.name }}
          </NuxtLinkLocale>
          <h1 class="mt-2 break-words text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl xl:text-[2.1rem]">{{ product.title }}</h1>
          <button type="button" class="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" @click="goToReviews">
            <span v-if="reviewSummary.total" class="inline-flex text-amber-500" aria-hidden="true"><Icon v-for="star in 5" :key="star" name="lucide:star" :class="star <= Math.round(reviewSummary.average) ? 'fill-current' : ''" size="16" /></span>
            <span>{{ reviewSummary.total === null ? $t('common.viewReviews') : reviewSummary.total ? `${reviewSummary.average.toFixed(1)} (${reviewSummary.total} ${reviewSummary.total === 1 ? $t('common.review') : $t('common.reviews')})` : $t('common.noReviewsYet') }}</span>
            <Icon name="lucide:arrow-right" size="14" aria-hidden="true" class="directional-icon" />
          </button>

          <div class="mt-6 border-y border-slate-200 py-5">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong class="text-3xl font-bold tracking-tight text-blue-800 sm:text-4xl">{{ formatPrice(product.price) }}</strong>
              <del v-if="hasDiscount" class="text-base text-slate-500">{{ formatPrice(product.old_price) }}</del>
            </div>
            <p v-if="hasDiscount" class="mt-1 text-sm font-semibold text-emerald-700">{{ $t('product.saveAmount', { value0: (formatPrice(savings)) }) }}<span v-if="discountPercent"> ({{ discountPercent }}%)</span></p>
            <p class="mt-4 inline-flex items-center gap-2 text-sm font-semibold" :class="isOutOfStock || isPreorder || isComingSoon ? 'text-amber-700' : 'text-emerald-700'"><Icon :name="isOutOfStock || isPreorder || isComingSoon ? 'lucide:clock-3' : 'lucide:circle-check'" size="18" />{{ $uiLabel(stockLabel) }}</p>
            <div v-if="isPreorder || isComingSoon" class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-800">
              <strong class="block text-xs font-bold uppercase tracking-widest text-amber-900">{{ isPreorder ? $t('common.preOrder') : $t('common.comingSoon') }}</strong>
              <p v-if="product.expected_availability_date" class="mt-1">{{ $t('products.slug.expectedAvailabilityValue', { value0: (expectedAvailabilityLabel(product.expected_availability_date)) }) }}</p>
              <p v-if="product.availability_message" class="mt-1">{{ product.availability_message }}</p>
              <p class="mt-1">{{ $t('products.slug.thisItemIsNotReadyForNormalDelivery') }}</p>
              <template v-if="isPreorder"><p class="mt-2">{{ $t('common.preOrderPrice') }} <strong>{{ formatPrice(preorderAmounts.total) }}</strong></p><p>{{ product.preorder_payment_mode === 'deposit' ? $t('products.slug.reserveWithValueDeposit', { value0: (product.preorder_deposit_percent) }) : $t('common.fullPaymentRequired') }}</p><p>{{ $t('common.requiredNow') }} <strong>{{ formatPrice(preorderAmounts.due) }}</strong></p><p v-if="preorderAmounts.balance">{{ $t('common.remainingBalance') }} <strong>{{ formatPrice(preorderAmounts.balance) }}</strong></p><p v-if="preorderAvailability?.remaining === 0" class="font-semibold text-red-700">{{ $t('products.slug.preOrderAllocationSoldOut') }}</p></template>
            </div>
          </div>

          <div v-if="showVariantChoices" class="mt-6">
            <div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="text-sm font-bold text-slate-900">{{ hasColorChoices ? $t('common.color') : $t('common.chooseAnOption') }}<span v-if="hasColorChoices && selectedVariant">: {{ selectedVariant.color_name }}</span></h2><span v-if="selectedVariant" class="text-xs text-slate-500">{{ $uiLabel(selectedVariantStockLabel) }}</span></div>
            <div role="radiogroup" :aria-label="hasColorChoices ? $t('common.availableColors') : $t('common.productOptions')" class="mt-3 gap-2" :class="hasColorChoices ? 'flex flex-wrap' : 'grid sm:grid-cols-2'">
              <button v-for="variant in productVariants" :key="variant.id" type="button" role="radio" :aria-checked="selectedVariantId === variant.id" :aria-label="hasColorChoices ? `${variant.color_name}, ${variantStockLabel(variant)}` : undefined" class="relative flex min-w-0 items-center gap-3 rounded-md border text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" :class="[selectedVariantId === variant.id ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700' : 'border-slate-200 hover:border-slate-400', hasColorChoices ? 'min-h-24 w-24 flex-col justify-center gap-1 p-2' : 'min-h-14 px-3 py-2']" @click="selectVariant(variant)">
                <span v-if="getVariantPreview(variant)" class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white"><img :src="getVariantPreview(variant)" :alt="''" class="h-full w-full object-contain" @error="markImageBroken(getVariantPreview(variant))"></span>
                <span v-else-if="getVariantColor(variant)" class="h-10 w-10 shrink-0 rounded-full border border-slate-300" :style="{ backgroundColor: getVariantColor(variant) }" />
                <Icon v-else name="lucide:image-off" size="25" class="shrink-0 text-slate-400" aria-hidden="true" />
                <span class="min-w-0" :class="hasColorChoices ? 'w-full text-center' : ''"><span class="block break-words text-sm font-semibold">{{ hasColorChoices ? variant.color_name : variant.name }}</span><span v-if="!hasColorChoices && getVariantMeta(variant)" class="block break-words text-xs text-slate-500">{{ getVariantMeta(variant) }}</span></span>
                <span v-if="!isPreorder && !isComingSoon && hasColorChoices && Number(variant.stock_quantity || 0) <= 0" class="absolute end-1 top-1 rounded-sm bg-white/95 px-1 text-[10px] font-semibold text-amber-800">{{ allowOutOfStockPurchases ? $t('common.backorder') : $t('common.soldOut') }}</span>
              </button>
            </div>
            <p v-if="!selectedVariant && hasPurchasableVariants" class="mt-2 text-xs text-slate-500">{{ $t('products.slug.selectAValueBeforeAddingToCart', { value0: (hasColorChoices ? $t('common.color') : $t('product.option')) }) }}</p>
          </div>
          <p v-else-if="selectedVariant && meaningfulVariantName" class="mt-5 text-sm text-slate-600">{{ $t('common.option') }} <strong class="text-slate-900">{{ selectedVariant.name }}</strong></p>

          <div v-if="!isComingSoon" class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div class="inline-flex h-12 w-fit items-center overflow-hidden rounded-md border border-slate-300" :aria-label="$t('common.quantity')">
              <button type="button" class="h-12 w-12 text-xl hover:bg-slate-100 disabled:text-slate-300" :aria-label="$t('common.decreaseQuantity')" :disabled="selectedQuantity <= 1" @click="decreaseQuantity">−</button>
              <output class="min-w-10 text-center font-semibold" :aria-label="$t('common.selectedQuantity')">{{ selectedQuantity }}</output>
              <button type="button" class="h-12 w-12 text-xl hover:bg-slate-100 disabled:text-slate-300" :aria-label="$t('common.increaseQuantity')" :disabled="selectedQuantity >= maximumQuantity" @click="increaseQuantity">+</button>
            </div>
            <button type="button" :disabled="!canPurchaseProduct" class="min-h-12 flex-1 rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300" @click="handleAddToCart"><Icon name="lucide:shopping-cart" size="18" class="me-2 inline" />{{ $uiLabel(addToCartLabel) }}</button>
          </div>
          <p v-if="cartMessage" class="mt-3 text-sm text-emerald-700" role="status">{{ $uiMessage(cartMessage) }}</p>
        </div>
      </div>

      <div class="mt-14 max-w-6xl space-y-12 border-t border-slate-200 pt-10">
        <section v-if="highlights.length" aria-labelledby="highlights-heading">
          <h2 id="highlights-heading" class="text-2xl font-bold text-slate-950">{{ $t('common.highlights') }}</h2>
          <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="highlight in highlights" :key="highlight.label" class="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-4 py-5">
              <p class="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">{{ highlight.label }}</p>
              <p class="mt-2 break-words text-lg font-bold leading-snug text-slate-950">{{ highlight.value }}</p>
            </div>
          </div>
        </section>
        <section v-if="descriptionContent.length" aria-labelledby="description-heading">
          <h2 id="description-heading" class="text-2xl font-bold text-slate-950">{{ $t('common.aboutThisProduct') }}</h2>
          <div class="mt-5 max-w-4xl space-y-4 break-words text-base leading-7 text-slate-700">
            <template v-for="(block, index) in descriptionContent" :key="index">
              <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
              <h3 v-else-if="block.type === 'heading'" class="pt-2 text-lg font-bold text-slate-900">{{ block.text }}</h3>
              <ul v-else-if="block.type === 'list'" class="list-disc space-y-1 ps-6"><li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li></ul>
              <div v-else-if="block.type === 'detail'" class="grid gap-1 border-b border-slate-100 pb-2 sm:grid-cols-[minmax(150px,32%)_minmax(0,1fr)] sm:gap-5"><span class="font-semibold text-slate-800">{{ block.label }}</span><span class="min-w-0 break-words">{{ block.value }}</span></div>
            </template>
          </div>
        </section>
        <section v-if="product.features.length" aria-labelledby="features-heading"><h2 id="features-heading" class="text-2xl font-bold text-slate-950">{{ $t('common.features') }}</h2><ul class="mt-5 grid gap-3 sm:grid-cols-2"><li v-for="feature in product.features" :key="feature.id" class="flex min-w-0 gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><Icon name="lucide:check" size="18" class="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" /><span class="break-words">{{ feature.body }}</span></li></ul></section>
        <section v-if="specificationGroups.length" aria-labelledby="specifications-heading"><h2 id="specifications-heading" class="text-2xl font-bold text-slate-950">{{ $t('common.specifications') }}</h2>
          <div class="mt-5 space-y-7"><div v-for="(group, groupIndex) in specificationGroups" :key="groupIndex"><h3 v-if="group.name" class="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">{{ group.name }}</h3><dl class="overflow-hidden rounded-md border border-slate-200"><div v-for="specification in group.items" :key="specification.id" class="grid gap-1 border-b border-slate-200 px-4 py-3 last:border-b-0 odd:bg-slate-50 sm:grid-cols-[minmax(150px,34%)_minmax(0,1fr)] sm:gap-6 sm:px-5"><dt class="min-w-0 break-words text-sm font-semibold text-slate-700" :title="specification.definition?.help_text || undefined">{{ specification.displayLabel }}<Icon v-if="specification.definition?.help_text" name="lucide:info" size="13" class="ms-1 inline text-slate-400" aria-hidden="true" /><span v-if="specification.definition?.help_text" class="sr-only"> — {{ specification.definition.help_text }}</span></dt><dd class="min-w-0 whitespace-pre-line break-words text-sm leading-6 text-slate-900">{{ specification.value }}</dd></div></dl></div></div>
        </section>
        <div id="reviews-section" ref="reviewsSection"><ProductReviews ref="reviewsComponent" :product-id="product.id" :product-name="product.title" @summary-change="updateReviewSummary" /></div>
      </div>
      <section v-if="relatedProducts.length" class="mt-14 border-t border-slate-200 pt-10" aria-labelledby="related-heading"><h2 id="related-heading" class="mb-5 text-2xl font-bold text-slate-950">{{ $t('common.youMayAlsoLike') }}</h2><div class="product-related-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"><CardsProductCard v-for="related in relatedProducts" :key="related.id" :product="related" /></div></section>
    </main>

    <Teleport to="body">
      <div v-if="lightboxOpen && activeImage" ref="lightboxDialog" class="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-4 text-white sm:p-6" role="dialog" aria-modal="true" :aria-label="$t('products.slug.productImagesForValue', { value0: (product.title) })" tabindex="-1" @keydown="onLightboxKeydown">
        <div class="flex items-center justify-between gap-4"><span class="text-sm font-semibold">{{ activeImageIndex + 1 }} / {{ galleryImages.length }}</span><button ref="lightboxClose" type="button" class="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" :aria-label="$t('common.closeImageGallery')" @click="closeLightbox"><Icon name="lucide:x" size="25" /></button></div>
        <div class="flex min-h-0 flex-1 items-center justify-between gap-2"><button v-if="galleryImages.length > 1" type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" :aria-label="$t('common.previousImage')" @click="stepImage(-1)"><Icon name="lucide:chevron-left" size="30" class="directional-icon" /></button><img :src="activeImage.url" :alt="activeImage.alt" class="min-h-0 max-h-full min-w-0 flex-1 object-contain" @error="markImageBroken(activeImage.url)"><button v-if="galleryImages.length > 1" type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" :aria-label="$t('common.nextImage')" @click="stepImage(1)"><Icon name="lucide:chevron-right" size="30" class="directional-icon" /></button></div>
        <div v-if="galleryImages.length > 1" class="mt-3 flex justify-center gap-2 overflow-x-auto pb-1" :aria-label="$t('common.galleryThumbnails')"><button v-for="(image, index) in galleryImages" :key="image.url" type="button" :aria-label="$t('products.slug.showImageValueOfValue', { value0: (index + 1), value1: (galleryImages.length) })" :aria-current="activeImage.url === image.url ? 'true' : undefined" class="h-14 w-14 shrink-0 rounded-md border bg-white p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" :class="activeImage.url === image.url ? 'border-blue-400 ring-2 ring-blue-400' : 'border-white/30'" @click="selectedImage = image.url"><img :src="image.url" :alt="image.alt" class="h-full w-full object-contain" @error="markImageBroken(image.url)"></button></div>
      </div>
    </Teleport>
  </div>
</template>
<script setup>
const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

const { intlLocale } = useUiLocale()

import { buildProductGallery, hasDistinctColorVariants, selectProductGalleryImages, shouldIncludeMainProductImage, variantPreviewImages, visibleProductSpecifications, productSavings, pickRelatedProducts } from '~/utils/productDetail'
import { groupProductSpecifications, productHighlights, descriptionBlocks } from '~/utils/specificationLibrary'
import { getConfiguredStoreImageUrl } from '~/utils/storefront'
import { calculatePreorderAmounts, expectedAvailabilityLabel as baseExpectedAvailabilityLabel } from '~/utils/preorder'
const supabase = useSupabaseClient()
const route = useUiRoute()
const slug = route.params.slug
const { data: siteContent } = useSiteContent()
const { addItem } = useCart()

const { data: product, pending, error } = await useAsyncData(`product-${slug}`, async () => {
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select(`
      id,
      title,
      slug,
      description,
      long_description,
      price,
      old_price,
      image_url,
      is_top_seller,
      is_featured,
      created_at,
      category_id,
      brand_id,
      color_name,
      color_hex,
      stock_quantity,
      is_published,
      sku,
      popularity_score,
      average_rating,
      is_serialized,
      selling_mode,
      expected_availability_date,
      availability_message,
      preorder_active,
      preorder_starts_at,
      preorder_ends_at,
      preorder_payment_mode,
      preorder_deposit_percent,
      preorder_total_limit,
      preorder_customer_limit,
      category:categories (
        id,
        name,
        slug
      ),
      brand:brands (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (productError) {
    throw productError
  }

  const [imagesResult, specificationsResult, variantsResult, reviewsResult, relatedResult, featuresResult] = await Promise.all([
    supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productData.id)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('product_specifications')
      .select('*')
      .eq('product_id', productData.id)
      .order('sort_order')
      .order('created_at'),
    productData.is_serialized
      ? supabase
          .from('product_variants')
          .select('id, product_id, name, code, sku, color_name, color_hex, stock_quantity, is_active')
          .eq('product_id', productData.id)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : Promise.resolve({
          data: [],
          error: null
        }),
    $fetch('/api/product-reviews', { query: { productId: productData.id, page: 1, pageSize: 1 } }).catch(() => null),
    productData.category_id || productData.brand_id
      ? supabase.from('products')
          .select('id, title, slug, price, old_price, image_url, stock_quantity, is_serialized, selling_mode, preorder_active, is_featured, is_top_seller, popularity_score, category_id, brand_id, category:categories(id, name), brand:brands(id, name)')
          .eq('is_published', true)
          .neq('id', productData.id)
          .or([productData.category_id && `category_id.eq.${productData.category_id}`, productData.brand_id && `brand_id.eq.${productData.brand_id}`].filter(Boolean).join(','))
          .limit(24)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('product_features').select('id, body, sort_order').eq('product_id', productData.id).order('sort_order')
  ])

  if (imagesResult.error) {
    throw imagesResult.error
  }

  if (specificationsResult.error) {
    throw specificationsResult.error
  }

  if (variantsResult.error) {
    throw variantsResult.error
  }


  const definitionIds = [...new Set((specificationsResult.data || []).map((item) => item.definition_id).filter(Boolean))]
  const definitionsResult = definitionIds.length
    ? await supabase.from('specification_definitions').select('id, name, group_name, help_text').in('id', definitionIds)
    : { data: [] }
  const definitionById = new Map((definitionsResult.data || []).map((definition) => [definition.id, definition]))

  return {
    ...productData,
    images: imagesResult.data || [],
    specifications: (specificationsResult.data || []).map((item) => ({ ...item, definition: definitionById.get(item.definition_id) || null })),
    features: featuresResult.error ? [] : (featuresResult.data || []).filter((item) => String(item.body || '').trim()),
    variants: variantsResult.data || [],
    reviewCount: reviewsResult ? Number(reviewsResult.total || 0) : null,
    reviewAverage: reviewsResult ? Number(reviewsResult.averageRating || 0) : null,
    related: relatedResult.error ? [] : (relatedResult.data || [])
  }
}, { lazy: true })

const storeName = computed(() => {
  return String(siteContent.value?.settings?.site_name || '').trim() || 'ELcomputer'
})

const productPageTitle = computed(() => {
  const productName = String(product.value?.title || '').trim()

  return productName
    ? `${productName} - ${storeName.value}`
    : `Product - ${storeName.value}`
})

useHead(() => ({
  title: productPageTitle.value
}))

useProductEngagement(product)

const selectedImage = ref('')
const brokenImages = ref([])
const lightboxOpen = ref(false)
const lightboxDialog = ref(null)
const lightboxClose = ref(null)
const reviewsComponent = ref(null)
const reviewsSection = ref(null)
const reviewSummary = ref({ total: null, average: 0 })
let previousFocus = null
let previousOverflow = ''
const selectedQuantity = ref(1)
const isPreorder = computed(() => product.value?.selling_mode === 'preorder')
const isComingSoon = computed(() => product.value?.selling_mode === 'coming_soon')
const { data: preorderAvailability, refresh: refreshPreorderAvailability } = await useAsyncData(`preorder-availability-${slug}`, async () => {
  if (!product.value || product.value.selling_mode !== 'preorder') return null
  return $fetch(`/api/preorders/${product.value.id}`)
}, { watch: [product] })
const preorderAmounts = computed(() => calculatePreorderAmounts(product.value?.price || 0, selectedQuantity.value, product.value?.preorder_payment_mode, product.value?.preorder_deposit_percent))
const selectedVariantId = ref('')
const cartMessage = ref('')
const allowOutOfStockPurchases = computed(() => {
  return Boolean(siteContent.value?.settings?.allow_out_of_stock_purchases)
    && !product.value?.is_serialized
})
const productVariants = computed(() => product.value?.variants || [])
const hasVariants = computed(() => productVariants.value.length > 0)
const requiresVariantSelection = computed(() => Boolean(product.value?.is_serialized))
const showVariantChoices = computed(() => requiresVariantSelection.value && productVariants.value.length > 1)
const hasColorChoices = computed(() => showVariantChoices.value && hasDistinctColorVariants(productVariants.value))
const meaningfulVariantName = computed(() => selectedVariant.value && !/^(default|standard|base|product)$/i.test(String(selectedVariant.value.name || '').trim()))
const selectedVariant = computed(() => {
  return productVariants.value.find((variant) => variant.id === selectedVariantId.value) || null
})
const selectedVariantImages = computed(() => {
  const images = Array.isArray(product.value?.images) ? product.value.images : []
  return selectProductGalleryImages(images, requiresVariantSelection.value, selectedVariantId.value)
})
const canUseMainImage = computed(() => shouldIncludeMainProductImage(product.value, selectedVariant.value, hasColorChoices.value))
const galleryImages = computed(() => buildProductGallery(product.value, selectedVariantImages.value, brokenImages.value, { includeMain: canUseMainImage.value }))
const variantPreviews = computed(() => variantPreviewImages(product.value?.images || []))
const activeImage = computed(() => galleryImages.value.find((image) => image.url === selectedImage.value) || galleryImages.value[0] || null)
const activeImageIndex = computed(() => galleryImages.value.findIndex((image) => image.url === activeImage.value?.url))
const visibleSpecifications = computed(() => visibleProductSpecifications(product.value?.specifications || []))
const specificationGroups = computed(() => groupProductSpecifications(visibleSpecifications.value))
const highlights = computed(() => productHighlights(visibleSpecifications.value))
const descriptionContent = computed(() => descriptionBlocks(product.value?.long_description || product.value?.description))
const relatedProducts = computed(() => pickRelatedProducts(product.value, product.value?.related || []))
const formatPrice = (value) => `${new Intl.NumberFormat(intlLocale.value).format(Number(value || 0))} EGP`
const discount = computed(() => productSavings(product.value?.price, product.value?.old_price))
const hasDiscount = computed(() => discount.value.amount > 0)
const savings = computed(() => discount.value.amount)
const discountPercent = computed(() => discount.value.percent)
const effectiveStockQuantity = computed(() => {
  if (requiresVariantSelection.value) {
    return Number(selectedVariant.value?.stock_quantity || 0)
  }

  return Number(product.value?.stock_quantity || 0)
})
const hasPurchasableVariants = computed(() => {
  return productVariants.value.some((variant) => {
    return Number(variant.stock_quantity || 0) > 0 || allowOutOfStockPurchases.value
  })
})

const maximumQuantity = computed(() => {
  if (isPreorder.value) return Math.max(1, Math.min(99, Number(product.value?.preorder_customer_limit || 99), Number(preorderAvailability.value?.remaining ?? 99)))
  if (allowOutOfStockPurchases.value) {
    return 99
  }

  const stockQuantity = effectiveStockQuantity.value

  if (stockQuantity <= 0) {
    return 1
  }

  return stockQuantity
})

const isOutOfStock = computed(() => {
  if (requiresVariantSelection.value && !selectedVariant.value) {
    return !hasPurchasableVariants.value
  }

  return effectiveStockQuantity.value <= 0
})
const canPurchaseProduct = computed(() => {
  if (isComingSoon.value) return false
  if (isPreorder.value) return Boolean(product.value?.preorder_active)
    && (!product.value.preorder_starts_at || new Date() >= new Date(product.value.preorder_starts_at))
    && (!product.value.preorder_ends_at || new Date() < new Date(product.value.preorder_ends_at))
    && preorderAvailability.value?.available === true
    && (!requiresVariantSelection.value || Boolean(selectedVariant.value))
  if (requiresVariantSelection.value && !selectedVariant.value) {
    return false
  }

  return !isOutOfStock.value || allowOutOfStockPurchases.value
})
const stockLabel = computed(() => {
  if (isComingSoon.value) return 'Coming Soon'
  if (isPreorder.value) return preorderAvailability.value?.remaining === 0 ? 'Pre-order sold out' : 'Pre-order'
  if (requiresVariantSelection.value && !hasVariants.value) {
    return 'Options Unavailable'
  }

  if (requiresVariantSelection.value && !selectedVariant.value) {
    if (!hasPurchasableVariants.value) {
      return allowOutOfStockPurchases.value ? 'Available on Backorder' : 'Out of Stock'
    }

    return hasColorChoices.value ? 'Select a Color' : 'Select an Option'
  }

  if (!isOutOfStock.value) {
    return 'In Stock'
  }

  return allowOutOfStockPurchases.value ? 'Available on Backorder' : 'Out of Stock'
})
const selectedVariantStockLabel = computed(() => {
  if (isPreorder.value) return 'Available for pre-order'
  if (!selectedVariant.value) {
    return ''
  }

  if (Number(selectedVariant.value.stock_quantity || 0) > 0) {
    return `${Number(selectedVariant.value.stock_quantity)} available`
  }

  return allowOutOfStockPurchases.value ? 'Available on backorder' : 'Out of stock'
})
const addToCartLabel = computed(() => {
  if (isComingSoon.value) return 'Coming Soon'
  if (isPreorder.value) return canPurchaseProduct.value ? 'Pre-order Now' : (preorderAvailability.value?.remaining === 0 ? 'Pre-order sold out' : 'Pre-order unavailable')
  if (requiresVariantSelection.value && !hasVariants.value) {
    return 'Options Unavailable'
  }

  if (requiresVariantSelection.value && !selectedVariant.value && hasPurchasableVariants.value) {
    return hasColorChoices.value ? 'Choose a Color' : 'Choose an Option'
  }

  if (!canPurchaseProduct.value) {
    return 'Out of Stock'
  }

  return 'Add to Cart'
})

const getVariantColor = (variant) => {
  const color = String(variant?.color_hex || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : ''
}
const getVariantPreview = (variant) => {
  const url = variantPreviews.value.get(variant.id)
    || (hasColorChoices.value && shouldIncludeMainProductImage(product.value, variant, true)
      ? getConfiguredStoreImageUrl(product.value?.image_url) : '')
  return url && !brokenImages.value.includes(url) ? url : ''
}
const variantStockLabel = (variant) => isPreorder.value ? 'Pre-order' : Number(variant.stock_quantity || 0) > 0
  ? 'In stock' : allowOutOfStockPurchases.value ? 'Available on backorder' : 'Out of stock'

const getVariantMeta = (variant) => {
  const color = String(variant?.color_name || '').trim()
  return [color && color.toLowerCase() !== String(variant?.name || '').trim().toLowerCase() ? color : '', uiLabel(variantStockLabel(variant))].filter(Boolean).join(' · ')
}

const selectVariant = (variant) => {
  selectedVariantId.value = variant.id
  selectedQuantity.value = 1
  cartMessage.value = ''
}
const markImageBroken = (url) => {
  if (!brokenImages.value.includes(url)) brokenImages.value = [...brokenImages.value, url]
  if (!galleryImages.value.length) closeLightbox()
}
const stepImage = (direction) => {
  if (!galleryImages.value.length) return
  const next = (activeImageIndex.value + direction + galleryImages.value.length) % galleryImages.value.length
  selectedImage.value = galleryImages.value[next].url
}
const openLightbox = async () => {
  if (!activeImage.value || !import.meta.client) return
  previousFocus = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  lightboxOpen.value = true
  await nextTick()
  lightboxClose.value?.focus()
}
const closeLightbox = () => {
  if (!lightboxOpen.value) return
  lightboxOpen.value = false
  if (import.meta.client) document.body.style.overflow = previousOverflow
  nextTick(() => previousFocus?.focus?.())
}
const onLightboxKeydown = (event) => {
  if (event.key === 'Escape') { event.preventDefault(); closeLightbox() }
  if (event.key === 'ArrowLeft') { event.preventDefault(); stepImage(-1) }
  if (event.key === 'ArrowRight') { event.preventDefault(); stepImage(1) }
  if (event.key === 'Tab') {
    const controls = [...lightboxDialog.value.querySelectorAll('button')]
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
}
const updateReviewSummary = (summary) => { reviewSummary.value = summary }
const goToReviews = async () => {
  reviewsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  await reviewsComponent.value?.openReviews()
}
onBeforeUnmount(closeLightbox)

const decreaseQuantity = () => {
  selectedQuantity.value = Math.max(1, selectedQuantity.value - 1)
}

const increaseQuantity = () => {
  selectedQuantity.value = Math.min(maximumQuantity.value, selectedQuantity.value + 1)
}

const handleAddToCart = () => {
  if (!canPurchaseProduct.value) {
    return
  }

  const result = addItem({
    ...product.value,
    variant: selectedVariant.value,
    image_url: selectedVariantImages.value[0]?.image_url || product.value.image_url,
    stock_quantity: effectiveStockQuantity.value,
    allow_out_of_stock_purchases: allowOutOfStockPurchases.value,
    selling_mode: product.value.selling_mode,
    expected_availability_date: product.value.expected_availability_date,
    availability_message: product.value.availability_message,
    preorder_active: product.value.preorder_active,
    preorder_payment_mode: product.value.preorder_payment_mode,
    preorder_deposit_percent: product.value.preorder_deposit_percent,
    preorder_customer_limit: product.value.preorder_customer_limit,
    preorder_remaining: preorderAvailability.value?.remaining ?? null
  }, selectedQuantity.value, {
    source: 'product_detail'
  })
  cartMessage.value = result.message || ''
  if (!result.success && isPreorder.value) refreshPreorderAvailability()
}

const getPreferredProductImage = (variantId = selectedVariantId.value) => {
  const images = Array.isArray(product.value?.images) ? product.value.images : []

  if (requiresVariantSelection.value) {
    const variantImage = images.find((image) => image.variant_id === variantId)
    return variantImage?.image_url || (canUseMainImage.value ? product.value?.image_url : '') || ''
  }

  return product.value?.image_url || images[0]?.image_url || ''
}

watch(
  [
    () => product.value?.id,
    () => route.query.variant
  ],
  () => {
    if (!product.value) {
      return
    }

    const requestedVariantId = String(route.query.variant || '').trim()
    const requestedVariant = product.value.variants.find((variant) => {
      return variant.id === requestedVariantId
    })

    selectedQuantity.value = 1
    reviewSummary.value = { total: product.value.reviewCount, average: Number(product.value.reviewAverage || 0) }
    brokenImages.value = []
    const nextVariantId = requestedVariant?.id
      || (product.value.variants.length === 1 ? product.value.variants[0].id : '')
    selectedVariantId.value = nextVariantId
    selectedImage.value = getPreferredProductImage(nextVariantId)
  },
  {
    immediate: true
  }
)

watch(selectedVariantId, (nextVariantId, previousVariantId) => {
  if (nextVariantId !== previousVariantId) {
    selectedImage.value = getPreferredProductImage(nextVariantId)
  }

  if (!selectedVariantId.value && requiresVariantSelection.value) {
    selectedQuantity.value = 1
    return
  }

  selectedQuantity.value = Math.min(selectedQuantity.value, maximumQuantity.value)
})
</script>
