<template>
  <div class="min-h-screen bg-white px-4 py-10 md:px-8">
    <div v-if="pending" class="mx-auto max-w-6xl rounded-2xl bg-gray-50 p-8 text-center text-gray-500">
      Loading product...
    </div>

    <div
      v-else-if="error"
      class="mx-auto max-w-6xl rounded-2xl bg-red-50 p-8 text-center text-red-600"
    >
      {{ error.message }}
    </div>

    <div
      v-else-if="!product"
      class="mx-auto max-w-6xl rounded-2xl bg-gray-50 p-8 text-center text-gray-500"
    >
      Product not found.
    </div>

    <div v-else class="mx-auto max-w-6xl">
      <div class="grid gap-8 lg:grid-cols-[120px_1.2fr_1fr]">
        <div class="order-2 flex gap-3 overflow-x-auto lg:order-1 lg:flex-col">
          <button
            type="button"
            class="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border bg-gray-50 p-2"
            :class="selectedImage === product.image_url ? 'border-black' : 'border-gray-200'"
            @click="selectedImage = product.image_url"
          >
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.title"
              class="h-full w-full object-contain"
            />
          </button>

          <button
            v-for="image in product.images"
            :key="image.id"
            type="button"
            class="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border bg-gray-50 p-2"
            :class="selectedImage === image.image_url ? 'border-black' : 'border-gray-200'"
            @click="selectedImage = image.image_url"
          >
            <img
              :src="image.image_url"
              :alt="image.alt_text || product.title"
              class="h-full w-full object-contain"
            />
          </button>
        </div>

        <div class="order-1 rounded-2xl bg-gray-50 p-6 lg:order-2">
          <div class="flex min-h-[420px] items-center justify-center">
            <img
              v-if="selectedImage"
              :src="selectedImage"
              :alt="product.title"
              class="max-h-[420px] w-full object-contain"
            />

            <p v-else class="text-gray-400">
              No image available
            </p>
          </div>
        </div>

        <div class="order-3">
          <NuxtLink
            v-if="product.brand"
            :to="{ path: '/search', query: { brand: product.brand.slug } }"
            class="mb-4 flex items-center gap-3"
          >
            <img
              v-if="product.brand.logo_url"
              :src="product.brand.logo_url"
              :alt="product.brand.name"
              class="h-12 w-12 rounded-lg border border-gray-200 object-contain p-1"
            />

            <p class="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {{ product.brand.name }}
            </p>
          </NuxtLink>

          <h1 class="text-3xl font-bold text-gray-900 md:text-4xl">
            {{ product.title }}
          </h1>

          <div class="mt-5 flex items-end gap-3">
            <p class="text-3xl font-bold text-blue-700">
              {{ product.price }} EGP
            </p>

            <p
              v-if="product.old_price"
              class="pb-1 text-lg text-gray-400 line-through"
            >
              {{ product.old_price }} EGP
            </p>
          </div>

          <p v-if="product.description" class="mt-5 whitespace-pre-line text-gray-600">
            {{ product.description }}
          </p>

          <div class="mt-6 flex flex-wrap gap-3">
            <span class="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
              {{ stockLabel }}
            </span>

            <NuxtLink
              v-if="product.category"
              :to="{ path: '/search', query: { category: product.category.slug } }"
              class="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700"
            >
              {{ product.category.name }}
            </NuxtLink>

            <span
              v-if="product.color_name"
              class="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700"
            >
              Color: {{ product.color_name }}
            </span>
          </div>

          <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div class="inline-flex items-center self-start rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                class="h-12 w-12 text-xl text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                :disabled="selectedQuantity <= 1"
                @click="decreaseQuantity"
              >
                -
              </button>

              <span class="inline-flex min-w-14 items-center justify-center text-base font-semibold text-gray-900">
                {{ selectedQuantity }}
              </span>

              <button
                type="button"
                class="h-12 w-12 text-xl text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                :disabled="selectedQuantity >= maximumQuantity"
                @click="increaseQuantity"
              >
                +
              </button>
            </div>

            <button
              type="button"
              :disabled="!canPurchaseProduct"
              class="w-full rounded-xl px-6 py-4 text-lg font-bold text-white sm:flex-1"
              :class="!canPurchaseProduct
                ? 'cursor-not-allowed bg-gray-300'
                : 'bg-black hover:bg-gray-800'"
              @click="handleAddToCart"
            >
              {{ canPurchaseProduct ? `Add to Cart - ${product.price} EGP` : 'Out of Stock' }}
            </button>
          </div>

          <p v-if="cartMessage" class="mt-3 text-sm text-green-700">
            {{ cartMessage }}
          </p>
        </div>
      </div>

      <div class="mt-12 grid gap-6 lg:grid-cols-2">
        <section class="rounded-2xl bg-gray-50 p-6">
          <h2 class="text-2xl font-bold text-gray-900">Product Description</h2>
          <p class="mt-4 whitespace-pre-line text-gray-600">
            {{ product.long_description || product.description || 'No long description added yet.' }}
          </p>
        </section>

        <section class="rounded-2xl bg-gray-50 p-6">
          <h2 class="text-2xl font-bold text-gray-900">Specifications</h2>

          <div v-if="product.specifications.length" class="mt-4 space-y-3">
            <div
              v-for="specification in product.specifications"
              :key="specification.id"
              class="flex items-start justify-between gap-4 border-b border-gray-200 pb-3"
            >
              <p class="font-medium text-gray-700">
                {{ specification.label }}
              </p>

              <p class="text-right text-gray-600">
                {{ specification.value }}
              </p>
            </div>
          </div>

          <p v-else class="mt-4 text-gray-500">
            No specifications added yet.
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const slug = route.params.slug
const { data: siteContent } = useSiteContent()
const { addItem } = useCart()

const { data: product, pending, error } = await useAsyncData(`product-${slug}`, async () => {
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select(`
      *,
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

  const [imagesResult, specificationsResult] = await Promise.all([
    supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productData.id)
      .order('created_at'),
    supabase
      .from('product_specifications')
      .select('*')
      .eq('product_id', productData.id)
      .order('created_at')
  ])

  if (imagesResult.error) {
    throw imagesResult.error
  }

  if (specificationsResult.error) {
    throw specificationsResult.error
  }

  return {
    ...productData,
    images: imagesResult.data || [],
    specifications: specificationsResult.data || []
  }
})

const selectedImage = ref('')
const selectedQuantity = ref(1)
const cartMessage = ref('')
const allowOutOfStockPurchases = computed(() => Boolean(siteContent.value?.settings?.allow_out_of_stock_purchases))

const maximumQuantity = computed(() => {
  if (allowOutOfStockPurchases.value) {
    return 99
  }

  const stockQuantity = Number(product.value?.stock_quantity || 0)

  if (stockQuantity <= 0) {
    return 1
  }

  return stockQuantity
})

const isOutOfStock = computed(() => {
  return Number(product.value?.stock_quantity || 0) <= 0
})
const canPurchaseProduct = computed(() => {
  return !isOutOfStock.value || allowOutOfStockPurchases.value
})
const stockLabel = computed(() => {
  if (!isOutOfStock.value) {
    return 'In Stock'
  }

  return allowOutOfStockPurchases.value ? 'Available on Backorder' : 'Out of Stock'
})

const decreaseQuantity = () => {
  selectedQuantity.value = Math.max(1, selectedQuantity.value - 1)
}

const increaseQuantity = () => {
  selectedQuantity.value = Math.min(maximumQuantity.value, selectedQuantity.value + 1)
}

const handleAddToCart = () => {
  const result = addItem({
    ...product.value,
    allow_out_of_stock_purchases: allowOutOfStockPurchases.value
  }, selectedQuantity.value)
  cartMessage.value = result.message || ''
}

watchEffect(() => {
  if (!product.value) {
    return
  }

  selectedImage.value = product.value.image_url || product.value.images[0]?.image_url || ''
  selectedQuantity.value = 1
})
</script>
