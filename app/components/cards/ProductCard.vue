<template>
  <article
    class="group w-[calc(50%-0.625rem)] max-w-[178px] flex-shrink-0 overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:w-[210px] sm:max-w-none lg:w-[232px] xl:w-[248px]"
  >
    <NuxtLink :to="product.slug ? `/products/${product.slug}` : '/'" class="block">
      <div class="px-4 pt-4 sm:px-5 sm:pt-5">
        <h3 class="line-clamp-2 min-h-[3rem] text-center text-base font-extrabold leading-6 text-gray-900 sm:min-h-[3.25rem] sm:text-[1.05rem]">
          {{ product.title }}
        </h3>

        <div
          v-if="brandName || categoryName"
          class="mt-1.5 flex min-h-[1.25rem] items-center justify-center gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 sm:text-[11px]"
        >
          <span v-if="brandName" class="truncate">
            {{ brandName }}
          </span>

          <span v-if="brandName && categoryName" class="text-gray-300">•</span>

          <span v-if="categoryName" class="truncate">
            {{ categoryName }}
          </span>
        </div>
      </div>

      <div class="relative mt-2 px-2 pb-2 sm:px-3 sm:pb-3">
        <div class="relative overflow-hidden rounded-[1.5rem] bg-white">
          <span
            v-if="hasDiscount"
            class="absolute left-3 top-3 z-20 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white"
          >
            {{ discountPercent }}% OFF
          </span>

          <span
            v-if="hasDiscount"
            class="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full bg-black/85 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 transition duration-200 group-hover:opacity-100"
          >
            Save {{ formatPrice(discountAmount) }}
          </span>

          <span
            v-if="!isPurchasable"
            class="absolute right-3 top-3 z-20 rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600"
          >
            Out of stock
          </span>

          <div class="flex h-[170px] items-center justify-center sm:h-[210px] lg:h-[230px]">
            <img
              v-if="product.image_url"
              class="h-[92%] w-[92%] object-contain transition duration-300 group-hover:scale-110"
              :src="product.image_url"
              :alt="product.title"
            >

            <p v-else class="text-sm text-gray-400">
              No image
            </p>
          </div>
        </div>
      </div>
    </NuxtLink>

    <div class="flex items-end justify-between gap-3 border-t border-gray-100 px-4 py-4 sm:px-5">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-400">
          Buy for
        </p>

        <p
          v-if="hasDiscount"
          class="mt-1 text-sm font-medium text-blue-500/80 line-through"
        >
          {{ formatPrice(product.old_price) }}
        </p>

        <p
          class="truncate text-[1.05rem] font-extrabold tracking-tight text-blue-600 sm:text-[1.2rem]"
        >
          {{ formatPrice(product.price) }}
        </p>
      </div>

      <button
        type="button"
        :disabled="!isPurchasable"
        class="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl font-light text-white transition sm:h-16 sm:w-16"
        :class="!isPurchasable
          ? 'cursor-not-allowed bg-gray-300'
          : 'bg-blue-600 hover:bg-blue-700'"
        @click="handleAddToCart"
      >
        +
      </button>
    </div>
  </article>
</template>

<script setup>
const props = defineProps({
  product: {
    type: Object,
    required: true
  }
})

const { data: siteContent } = useSiteContent()
const { addItem } = useCart()

const priceFormatter = new Intl.NumberFormat('en-US')

const numericPrice = computed(() => Number(props.product.price || 0))
const numericOldPrice = computed(() => Number(props.product.old_price || 0))
const brandName = computed(() => String(props.product.brand?.name || '').trim())
const categoryName = computed(() => String(props.product.category?.name || '').trim())
const isOutOfStock = computed(() => Number(props.product.stock_quantity || 0) <= 0)
const allowOutOfStockPurchases = computed(() => Boolean(siteContent.value?.settings?.allow_out_of_stock_purchases))
const isPurchasable = computed(() => !isOutOfStock.value || allowOutOfStockPurchases.value)

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

const handleAddToCart = () => {
  addItem({
    ...props.product,
    allow_out_of_stock_purchases: allowOutOfStockPurchases.value
  }, 1)
}
</script>
