<template>
  <ProductPremium v-if="productPageStyle === 'premium'" />
  <ProductClassic v-else />
</template>
<script setup>
const { categoryName } = useCategoryLocale()

import { selectWithSeo } from '~/utils/seoQuery'
import { productSeoFields, productSchema, publicSiteUrl, breadcrumbs } from '~/utils/seo'
const expectedAvailabilityLabel = value => baseExpectedAvailabilityLabel(value, intlLocale.value)

const { intlLocale, uiLabel } = useUiLocale()

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
  const { data: productData, error: productError } = await selectWithSeo(fields => supabase
    .from('storefront_products').select(fields).eq('slug', slug).eq('is_published', true).maybeSingle(), `
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
      warranty_status,
      warranty_duration_value,
      warranty_duration_unit,
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
        name_ar,
        slug
      ),
      brand:brands (
        id,
        name,
        slug,
        logo_url
      )
    `)
  if (productError) throw createError({ statusCode: 503, statusMessage: 'Could not load this product.' })
  if (!productData) throw createError({ statusCode: 404, statusMessage: 'Product not found.' })

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
          .from('storefront_product_variants')
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
      ? supabase.from('storefront_products')
          .select('id, title, slug, price, old_price, image_url, stock_quantity, is_serialized, selling_mode, preorder_active, is_featured, is_top_seller, popularity_score, category_id, brand_id, category:categories(id, name, name_ar), brand:brands(id, name)')
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
})

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
if (error.value) throw error.value
const seoConfig = useRuntimeConfig()
usePageSeo(() => {
  const settings = siteContent.value?.settings || {}
  const base = publicSiteUrl(settings, seoConfig.public.siteUrl)
  const item = product.value
  const trail = [{ name: uiLabel('Home'), path: '/' }]
  if (item?.category?.slug) trail.push({ name: categoryName(item.category), path: '/search', query: { category: item.category.slug } })
  if (item) trail.push({ name: item.title, path: `/products/${item.slug}` })
  const schema = productSchema(item, base, intlLocale.value.startsWith('ar') ? 'ar' : 'en', preorderAvailability.value, settings)
  return { ...productSeoFields(item || {}), index: !!item, type: 'product', structuredData: schema ? [schema, breadcrumbs(trail, base, intlLocale.value.startsWith('ar') ? 'ar' : 'en')] : [] }
})
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

const { data: productAppearance } = await useAsyncData('product-page-appearance', () => $fetch('/api/storefront/product-appearance', { retry: 0 }), { getCachedData: (key, app) => app.isHydrating ? app.payload.data[key] : undefined })
const productPageStyle = computed(() => productAppearance.value?.style === 'premium' ? 'premium' : 'classic')
const premiumPurchasingEnabled = computed(() => seoConfig.public.purchasingEnabled === true || seoConfig.public.purchasingEnabled === 'true')
provideProductDetailContext({ activeImage, activeImageIndex, addToCartLabel, allowOutOfStockPurchases, canPurchaseProduct, cartMessage, categoryName, closeLightbox, decreaseQuantity, descriptionContent, discountPercent, error, expectedAvailabilityLabel, formatPrice, galleryImages, getVariantColor, getVariantMeta, getVariantPreview, goToReviews, handleAddToCart, hasColorChoices, hasDiscount, hasPurchasableVariants, highlights, increaseQuantity, isComingSoon, isOutOfStock, isPreorder, lightboxClose, lightboxDialog, lightboxOpen, markImageBroken, maximumQuantity, meaningfulVariantName, onLightboxKeydown, openLightbox, pending, preorderAmounts, preorderAvailability, product, productVariants, relatedProducts, reviewSummary, reviewsComponent, reviewsSection, savings, selectVariant, selectedImage, selectedQuantity, selectedVariant, selectedVariantId, selectedVariantStockLabel, showVariantChoices, specificationGroups, stepImage, stockLabel, updateReviewSummary, variantStockLabel, visibleSpecifications, siteContent, intlLocale, selectedVariantImages, canUseMainImage, productAppearance, premiumPurchasingEnabled })
</script>
