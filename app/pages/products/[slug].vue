<template>
  <div class="bg-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
    <LayoutPageLoading v-if="pending" label="Loading product…" class="mx-auto max-w-7xl" />
    <div v-else-if="error" class="mx-auto max-w-7xl rounded-lg bg-red-50 p-8 text-red-700" role="alert">{{ error.message }}</div>
    <div v-else-if="!product" class="mx-auto max-w-7xl py-16 text-center text-slate-600">Product not found.</div>

    <main v-else class="mx-auto max-w-7xl">
      <nav class="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Product location">
        <NuxtLink to="/" class="hover:text-blue-700">Home</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink v-if="product.category" :to="{ path: '/search', query: { category: product.category.slug } }" class="hover:text-blue-700">{{ product.category.name }}</NuxtLink>
        <span v-else>Products</span>
      </nav>

      <div class="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:gap-8 xl:gap-12">
        <div class="flex min-w-0 flex-col lg:grid lg:grid-cols-[76px_minmax(0,1fr)] lg:items-start lg:gap-4">
          <div class="order-2 mt-3 flex gap-2 overflow-x-auto pb-2 lg:order-1 lg:mt-0 lg:max-h-[580px] lg:flex-col lg:overflow-y-auto lg:pb-0" aria-label="Product images">
            <button v-for="(image, index) in galleryImages" :key="image.url" type="button"
              class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-white p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 lg:h-[76px] lg:w-[76px]"
              :class="activeImage?.url === image.url ? 'border-blue-700 ring-1 ring-blue-700' : 'border-slate-200 hover:border-slate-400'"
              :aria-label="`Show product image ${index + 1} of ${galleryImages.length}`"
              :aria-current="activeImage?.url === image.url ? 'true' : undefined" @click="selectedImage = image.url">
              <img :src="image.url" :alt="image.alt" class="h-full w-full object-contain" @error="markImageBroken(image.url)">
            </button>
          </div>
          <div class="order-1 flex min-h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-white p-4 sm:min-h-[420px] lg:min-h-[540px] lg:p-5">
            <button v-if="activeImage" type="button" class="flex h-full min-h-[230px] w-full cursor-zoom-in items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 sm:min-h-[380px]" :aria-label="`Open image gallery, image ${activeImageIndex + 1} of ${galleryImages.length}`" @click="openLightbox">
              <img :src="activeImage.url" :alt="activeImage.alt" class="max-h-[230px] w-full object-contain sm:max-h-[390px] lg:max-h-[500px]" @error="markImageBroken(activeImage.url)">
            </button>
            <div v-else class="flex flex-col items-center gap-3 text-slate-400"><Icon name="lucide:image-off" size="42" /><span>No image available</span></div>
          </div>
        </div>

        <div class="min-w-0">
          <NuxtLink v-if="product.brand" :to="{ path: '/search', query: { brand: product.brand.slug } }" class="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
            <img v-if="product.brand.logo_url" :src="product.brand.logo_url" :alt="''" class="h-7 w-7 object-contain">
            {{ product.brand.name }}
          </NuxtLink>
          <h1 class="mt-2 break-words text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl xl:text-[2.1rem]">{{ product.title }}</h1>
          <button type="button" class="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" @click="goToReviews">
            <span v-if="reviewSummary.total" class="inline-flex text-amber-500" aria-hidden="true"><Icon v-for="star in 5" :key="star" name="lucide:star" :class="star <= Math.round(reviewSummary.average) ? 'fill-current' : ''" size="16" /></span>
            <span>{{ reviewSummary.total === null ? 'View reviews' : reviewSummary.total ? `${reviewSummary.average.toFixed(1)} (${reviewSummary.total} ${reviewSummary.total === 1 ? 'review' : 'reviews'})` : 'No reviews yet' }}</span>
            <Icon name="lucide:arrow-right" size="14" aria-hidden="true" />
          </button>

          <div class="mt-6 border-y border-slate-200 py-5">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong class="text-3xl font-bold tracking-tight text-blue-800 sm:text-4xl">{{ formatPrice(product.price) }}</strong>
              <del v-if="hasDiscount" class="text-base text-slate-500">{{ formatPrice(product.old_price) }}</del>
            </div>
            <p v-if="hasDiscount" class="mt-1 text-sm font-semibold text-emerald-700">Save {{ formatPrice(savings) }}<span v-if="discountPercent"> ({{ discountPercent }}%)</span></p>
            <p class="mt-4 inline-flex items-center gap-2 text-sm font-semibold" :class="isOutOfStock ? 'text-amber-700' : 'text-emerald-700'"><Icon :name="isOutOfStock ? 'lucide:clock-3' : 'lucide:circle-check'" size="18" />{{ stockLabel }}</p>
          </div>

          <div v-if="showVariantChoices" class="mt-6">
            <div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="text-sm font-bold text-slate-900">Choose an option</h2><span v-if="selectedVariant" class="text-xs text-slate-500">{{ selectedVariantStockLabel }}</span></div>
            <div role="radiogroup" aria-label="Product options" class="mt-3 grid gap-2 sm:grid-cols-2">
              <button v-for="variant in productVariants" :key="variant.id" type="button" role="radio" :aria-checked="selectedVariantId === variant.id" class="flex min-h-14 min-w-0 items-center gap-3 rounded-md border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" :class="selectedVariantId === variant.id ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:border-slate-400'" @click="selectVariant(variant)">
                <span v-if="getVariantColor(variant)" class="h-6 w-6 shrink-0 rounded-full border border-slate-300" :style="{ backgroundColor: getVariantColor(variant) }" />
                <Icon v-else name="lucide:box" size="22" class="shrink-0 text-slate-400" />
                <span class="min-w-0"><span class="block break-words text-sm font-semibold">{{ variant.name }}</span><span v-if="getVariantMeta(variant)" class="block break-words text-xs text-slate-500">{{ getVariantMeta(variant) }}</span></span>
              </button>
            </div>
            <p v-if="!selectedVariant && hasPurchasableVariants" class="mt-2 text-xs text-slate-500">Select an option before adding to cart.</p>
          </div>
          <p v-else-if="selectedVariant && meaningfulVariantName" class="mt-5 text-sm text-slate-600">Option: <strong class="text-slate-900">{{ selectedVariant.name }}</strong></p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div class="inline-flex h-12 w-fit items-center overflow-hidden rounded-md border border-slate-300" aria-label="Quantity">
              <button type="button" class="h-12 w-12 text-xl hover:bg-slate-100 disabled:text-slate-300" aria-label="Decrease quantity" :disabled="selectedQuantity <= 1" @click="decreaseQuantity">−</button>
              <output class="min-w-10 text-center font-semibold" aria-label="Selected quantity">{{ selectedQuantity }}</output>
              <button type="button" class="h-12 w-12 text-xl hover:bg-slate-100 disabled:text-slate-300" aria-label="Increase quantity" :disabled="selectedQuantity >= maximumQuantity" @click="increaseQuantity">+</button>
            </div>
            <button type="button" :disabled="!canPurchaseProduct" class="min-h-12 flex-1 rounded-md bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300" @click="handleAddToCart"><Icon name="lucide:shopping-cart" size="18" class="mr-2 inline" />{{ addToCartLabel }}</button>
          </div>
          <p v-if="cartMessage" class="mt-3 text-sm text-emerald-700" role="status">{{ cartMessage }}</p>
        </div>
      </div>

      <div class="mt-14 max-w-5xl space-y-12 border-t border-slate-200 pt-10">
        <section v-if="product.long_description || product.description" aria-labelledby="description-heading"><h2 id="description-heading" class="text-2xl font-bold text-slate-950">Product Description</h2><p class="mt-5 whitespace-pre-line break-words text-base leading-7 text-slate-700">{{ product.long_description || product.description }}</p></section>
        <section v-if="visibleSpecifications.length" aria-labelledby="specifications-heading"><h2 id="specifications-heading" class="text-2xl font-bold text-slate-950">Specifications</h2>
          <dl class="mt-5 overflow-hidden rounded-md border border-slate-200">
            <div v-for="specification in visibleSpecifications" :key="specification.id" class="grid gap-1 border-b border-slate-200 px-4 py-3 last:border-b-0 odd:bg-slate-50 sm:grid-cols-[minmax(150px,36%)_minmax(0,1fr)] sm:gap-6 sm:px-5">
              <dt class="min-w-0 break-words text-sm font-semibold text-slate-700">{{ specification.label }}</dt><dd class="min-w-0 whitespace-pre-line break-words text-sm leading-6 text-slate-900">{{ specification.value }}</dd>
            </div>
          </dl>
        </section>
        <div id="reviews-section" ref="reviewsSection"><ProductReviews ref="reviewsComponent" :product-id="product.id" :product-name="product.title" @summary-change="updateReviewSummary" /></div>
      </div>
      <section v-if="relatedProducts.length" class="mt-14 border-t border-slate-200 pt-10" aria-labelledby="related-heading"><h2 id="related-heading" class="mb-5 text-2xl font-bold text-slate-950">You may also like</h2><div class="product-related-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"><CardsProductCard v-for="related in relatedProducts" :key="related.id" :product="related" /></div></section>
    </main>

    <Teleport to="body">
      <div v-if="lightboxOpen && activeImage" ref="lightboxDialog" class="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-4 text-white sm:p-6" role="dialog" aria-modal="true" :aria-label="`Product images for ${product.title}`" tabindex="-1" @keydown="onLightboxKeydown">
        <div class="flex items-center justify-between gap-4"><span class="text-sm font-semibold">{{ activeImageIndex + 1 }} / {{ galleryImages.length }}</span><button ref="lightboxClose" type="button" class="flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Close image gallery" @click="closeLightbox"><Icon name="lucide:x" size="25" /></button></div>
        <div class="flex min-h-0 flex-1 items-center justify-between gap-2"><button v-if="galleryImages.length > 1" type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Previous image" @click="stepImage(-1)"><Icon name="lucide:chevron-left" size="30" /></button><img :src="activeImage.url" :alt="activeImage.alt" class="min-h-0 max-h-full min-w-0 flex-1 object-contain" @error="markImageBroken(activeImage.url)"><button v-if="galleryImages.length > 1" type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Next image" @click="stepImage(1)"><Icon name="lucide:chevron-right" size="30" /></button></div>
      </div>
    </Teleport>
  </div>
</template>
<script setup>
import { buildProductGallery, selectProductGalleryImages, visibleProductSpecifications, productSavings, pickRelatedProducts } from '~/utils/productDetail'
const supabase = useSupabaseClient()
const route = useRoute()
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

  const [imagesResult, specificationsResult, variantsResult, reviewsResult, relatedResult] = await Promise.all([
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
          .select('id, title, slug, price, old_price, image_url, stock_quantity, is_serialized, is_featured, is_top_seller, popularity_score, category_id, brand_id, category:categories(id, name), brand:brands(id, name)')
          .eq('is_published', true)
          .neq('id', productData.id)
          .or([productData.category_id && `category_id.eq.${productData.category_id}`, productData.brand_id && `brand_id.eq.${productData.brand_id}`].filter(Boolean).join(','))
          .limit(24)
      : Promise.resolve({ data: [], error: null })
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


  return {
    ...productData,
    images: imagesResult.data || [],
    specifications: specificationsResult.data || [],
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
const meaningfulVariantName = computed(() => selectedVariant.value && !/^(default|standard|base|product)$/i.test(String(selectedVariant.value.name || '').trim()))
const selectedVariant = computed(() => {
  return productVariants.value.find((variant) => variant.id === selectedVariantId.value) || null
})
const selectedVariantImages = computed(() => {
  const images = Array.isArray(product.value?.images) ? product.value.images : []
  return selectProductGalleryImages(images, requiresVariantSelection.value, selectedVariantId.value)
})
const galleryImages = computed(() => buildProductGallery(product.value, selectedVariantImages.value, brokenImages.value))
const activeImage = computed(() => galleryImages.value.find((image) => image.url === selectedImage.value) || galleryImages.value[0] || null)
const activeImageIndex = computed(() => galleryImages.value.findIndex((image) => image.url === activeImage.value?.url))
const visibleSpecifications = computed(() => visibleProductSpecifications(product.value?.specifications || []))
const relatedProducts = computed(() => pickRelatedProducts(product.value, product.value?.related || []))
const formatPrice = (value) => `${new Intl.NumberFormat('en-US').format(Number(value || 0))} EGP`
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
  if (requiresVariantSelection.value && !selectedVariant.value) {
    return false
  }

  return !isOutOfStock.value || allowOutOfStockPurchases.value
})
const stockLabel = computed(() => {
  if (requiresVariantSelection.value && !hasVariants.value) {
    return 'Options Unavailable'
  }

  if (requiresVariantSelection.value && !selectedVariant.value) {
    if (!hasPurchasableVariants.value) {
      return allowOutOfStockPurchases.value ? 'Available on Backorder' : 'Out of Stock'
    }

    return 'Select an Option'
  }

  if (!isOutOfStock.value) {
    return 'In Stock'
  }

  return allowOutOfStockPurchases.value ? 'Available on Backorder' : 'Out of Stock'
})
const selectedVariantStockLabel = computed(() => {
  if (!selectedVariant.value) {
    return ''
  }

  if (Number(selectedVariant.value.stock_quantity || 0) > 0) {
    return `${Number(selectedVariant.value.stock_quantity)} available`
  }

  return allowOutOfStockPurchases.value ? 'Available on backorder' : 'Out of stock'
})
const addToCartLabel = computed(() => {
  if (requiresVariantSelection.value && !hasVariants.value) {
    return 'Options Unavailable'
  }

  if (requiresVariantSelection.value && !selectedVariant.value && hasPurchasableVariants.value) {
    return 'Choose an Option'
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

const getVariantMeta = (variant) => {
  const details = [
    variant?.color_name,
    variant?.code || variant?.sku
  ].map((value) => String(value || '').trim()).filter(Boolean)

  if (!details.length) {
    return Number(variant?.stock_quantity || 0) > 0 ? 'In stock' : 'Out of stock'
  }

  return details.join(' · ')
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
    allow_out_of_stock_purchases: allowOutOfStockPurchases.value
  }, selectedQuantity.value, {
    source: 'product_detail'
  })
  cartMessage.value = result.message || ''
}

const getPreferredProductImage = (variantId = selectedVariantId.value) => {
  const images = Array.isArray(product.value?.images) ? product.value.images : []

  if (requiresVariantSelection.value) {
    const variantImage = images.find((image) => image.variant_id === variantId)
    return variantImage?.image_url || product.value?.image_url || ''
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
