<template>
  <article
    class="group w-[260px] flex-shrink-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md md:w-[280px]"
  >
    <NuxtLink :to="product.slug ? `/products/${product.slug}` : '/'">
      <div class="relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-3">
        <span
          v-if="hasDiscount"
          class="absolute left-3 top-3 z-20 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white"
        >
          Sale
        </span>

        <div class="relative z-0 flex aspect-[4/3] items-center justify-center rounded-lg bg-white">
          <img
            v-if="product.image_url"
            class="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
            :src="product.image_url"
            :alt="product.title"
          />

          <p v-else class="text-sm text-gray-400">
            No image
          </p>
        </div>
      </div>

      <div class="mt-4 px-1">
        <div class="mb-2 flex items-center justify-between gap-3">
          <p class="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            {{ product.brand?.name || product.category?.name || 'Product' }}
          </p>

          <span
            v-if="product.category?.name"
            class="truncate rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600"
          >
            {{ product.category.name }}
          </span>
        </div>

        <h3 class="line-clamp-2 min-h-[3rem] text-base font-semibold leading-6 text-gray-900">
          {{ product.title }}
        </h3>

        <div class="mt-3 flex items-end gap-2">
          <p class="text-xl font-bold text-gray-900">
            {{ formatPrice(product.price) }}
          </p>

          <p
            v-if="hasDiscount"
            class="text-sm text-gray-400 line-through"
          >
            {{ formatPrice(product.old_price) }}
          </p>
        </div>
      </div>
    </NuxtLink>

    <div class="mt-4 flex items-center justify-between gap-3 px-1">
      <p
        v-if="hasDiscount"
        class="text-xs font-medium text-green-700"
      >
        Save {{ formatPrice(discountAmount) }}
      </p>

      <p v-else class="text-xs text-gray-400">
        {{ isOutOfStock ? (allowOutOfStockPurchases ? 'Available to order' : 'Unavailable') : 'Available now' }}
      </p>

      <div class="flex items-center gap-2">
        <NuxtLink
          :to="product.slug ? `/products/${product.slug}` : '/'"
          class="inline-flex items-center gap-1 text-sm font-medium text-gray-900"
        >
          View
          <span class="transition group-hover:translate-x-0.5">→</span>
        </NuxtLink>

        <button
          type="button"
          :disabled="!isPurchasable"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white transition"
          :class="!isPurchasable
            ? 'cursor-not-allowed bg-gray-300'
            : 'bg-black hover:bg-gray-800'"
          @click="handleAddToCart"
        >
          +
        </button>
      </div>
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

const numericPrice = computed(() => Number(props.product.price || 0))
const numericOldPrice = computed(() => Number(props.product.old_price || 0))
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

const formatPrice = (value) => {
  return `${Number(value || 0)} EGP`
}

const handleAddToCart = () => {
  addItem({
    ...props.product,
    allow_out_of_stock_purchases: allowOutOfStockPurchases.value
  }, 1)
}
</script>
