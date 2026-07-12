<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="rounded-2xl bg-white p-6 shadow">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          Your Cart
        </p>

        <h1 class="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">
          Shopping Cart
        </h1>

        <p class="mt-2 text-sm text-gray-500">
          Review products, update quantity, and continue to checkout.
        </p>
      </div>

      <div
        v-if="isEmpty"
        class="mt-6 rounded-2xl bg-white p-8 text-center shadow"
      >
        <p class="text-lg font-semibold text-gray-900">
          Your cart is empty.
        </p>

        <p class="mt-2 text-sm text-gray-500">
          Add products from the store to start your order.
        </p>

        <NuxtLink
          to="/"
          class="mt-5 inline-flex rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Continue Shopping
        </NuxtLink>
      </div>

      <div v-else class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section class="space-y-4">
          <article
            v-for="item in items"
            :key="item.id"
            class="rounded-2xl bg-white p-5 shadow"
          >
            <div class="flex flex-col gap-5 sm:flex-row">
              <NuxtLink
                :to="item.slug ? `/products/${item.slug}` : '/'"
                class="flex h-28 w-full max-w-32 items-center justify-center rounded-2xl border bg-gray-50 p-3"
              >
                <img
                  v-if="item.image_url"
                  :src="item.image_url"
                  :alt="item.title"
                  class="h-full w-full object-contain"
                >

                <span v-else class="text-sm text-gray-400">No image</span>
              </NuxtLink>

              <div class="flex min-w-0 flex-1 flex-col gap-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0">
                    <NuxtLink
                      :to="item.slug ? `/products/${item.slug}` : '/'"
                      class="line-clamp-2 text-lg font-bold text-gray-900"
                    >
                      {{ item.title }}
                    </NuxtLink>

                    <p class="mt-1 text-sm text-gray-500">
                      {{ item.brand_name || item.category_name || 'Store product' }}
                    </p>

                    <p class="mt-3 text-base font-semibold text-gray-900">
                      {{ formatCurrency(item.price) }}
                    </p>
                  </div>

                  <button
                    type="button"
                    class="self-start text-sm font-medium text-red-600 hover:text-red-700"
                    @click="removeItem(item.id)"
                  >
                    Remove
                  </button>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="inline-flex items-center rounded-xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      class="h-11 w-11 text-xl text-gray-700 transition hover:bg-gray-100"
                      @click="decrementItem(item.id)"
                    >
                      -
                    </button>

                    <span class="inline-flex min-w-14 items-center justify-center text-base font-semibold text-gray-900">
                      {{ item.quantity }}
                    </span>

                    <button
                      type="button"
                      class="h-11 w-11 text-xl text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                      :disabled="item.quantity >= getMaximumQuantity(item)"
                      @click="incrementItem(item.id)"
                    >
                      +
                    </button>
                  </div>

                  <p class="text-lg font-bold text-gray-900">
                    {{ formatCurrency(item.price * item.quantity) }}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <aside class="h-fit rounded-2xl bg-white p-5 shadow">
          <h2 class="text-2xl font-bold text-gray-900">
            Summary
          </h2>

          <div class="mt-5 space-y-4">
            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>Items</span>
              <span>{{ itemCount }}</span>
            </div>

            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{{ formatCurrency(subtotal) }}</span>
            </div>

            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>

            <div class="border-t pt-4">
              <div class="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{{ formatCurrency(subtotal) }}</span>
              </div>
            </div>
          </div>

          <NuxtLink
            to="/checkout"
            class="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Proceed to Checkout
          </NuxtLink>

          <button
            type="button"
            class="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-300"
            @click="clearCart"
          >
            Clear Cart
          </button>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
const {
  items,
  itemCount,
  subtotal,
  isEmpty,
  incrementItem,
  decrementItem,
  removeItem,
  clearCart,
  loadCart
} = useCart()

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const getMaximumQuantity = (item) => {
  if (item?.allow_out_of_stock_purchases) {
    return 99
  }

  const stockQuantity = Number(item?.stock_quantity || 0)

  if (stockQuantity <= 0) {
    return 1
  }

  return stockQuantity
}

onMounted(() => {
  loadCart()
})

useHead({
  title: 'Cart'
})
</script>
