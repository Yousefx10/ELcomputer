<template>
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-6xl px-4 md:px-6">
      <div v-if="pending" class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow">
        Loading order summary...
      </div>

      <div v-else-if="error" class="rounded-2xl bg-red-50 p-8 text-red-600 shadow">
        {{ error.message }}
      </div>

      <div v-else-if="!orderData" class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow">
        Order summary not found.
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-2xl bg-white p-6 shadow">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Order Summary
          </p>

          <h1 class="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">
            {{ orderData.order.order_number || `Order #${orderData.order.id.slice(0, 8)}` }}
          </h1>

          <div class="mt-4 flex flex-wrap gap-3">
            <span class="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold uppercase text-amber-700">
              {{ formatStatus(orderData.order.status) }}
            </span>

            <span class="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
              {{ formatDate(orderData.order.created_at) }}
            </span>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section class="space-y-4">
            <div class="rounded-2xl bg-white p-6 shadow">
              <h2 class="text-2xl font-bold text-gray-900">
                Delivery Details
              </h2>

              <div class="mt-4 space-y-2 text-sm text-gray-600">
                <p>{{ orderData.order.first_name }} {{ orderData.order.last_name || '' }}</p>
                <p>{{ orderData.order.street_address }}</p>
                <p>{{ orderData.order.city }}, {{ orderData.order.governorate }}</p>
                <p>{{ orderData.order.phone }}</p>
                <p>{{ orderData.order.email }}</p>
              </div>
            </div>

            <div class="rounded-2xl bg-white p-6 shadow">
              <h2 class="text-2xl font-bold text-gray-900">
                Ordered Items
              </h2>

              <div class="mt-5 space-y-4">
                <article
                  v-for="item in orderData.items"
                  :key="item.id"
                  class="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
                >
                  <div class="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-50 p-2">
                    <img
                      v-if="item.image_url"
                      :src="item.image_url"
                      :alt="item.product_title"
                      class="h-full w-full object-contain"
                    >
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-900">
                      {{ item.product_title }}
                    </p>

                    <p class="mt-1 text-sm text-gray-500">
                      Qty {{ item.quantity }}
                    </p>
                  </div>

                  <div class="text-right">
                    <p class="text-sm text-gray-500">
                      {{ formatCurrency(item.unit_price) }} each
                    </p>

                    <p class="mt-1 font-semibold text-gray-900">
                      {{ formatCurrency(item.line_total) }}
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <aside class="h-fit rounded-2xl bg-white p-6 shadow">
            <h2 class="text-2xl font-bold text-gray-900">
              Totals
            </h2>

            <div class="mt-5 space-y-3">
              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{{ formatCurrency(orderData.order.subtotal_amount) }}</span>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>Coupon</span>
                <span>{{ orderData.order.coupon_code || 'No coupon' }}</span>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>Discount</span>
                <span>- {{ formatCurrency(orderData.order.discount_amount) }}</span>
              </div>

              <div class="flex items-center justify-between border-t pt-3 text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{{ formatCurrency(orderData.order.total_amount) }}</span>
              </div>
            </div>

            <NuxtLink
              to="/account"
              class="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Back to Account
            </NuxtLink>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'customer-auth'
})

const supabase = useSupabaseClient()
const route = useRoute()

const { data: orderData, pending, error } = await useAsyncData(`checkout-summary-${route.params.id}`, async () => {
  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('*')
      .eq('id', route.params.id)
      .maybeSingle(),
    supabase
      .from('customer_order_items')
      .select('*')
      .eq('order_id', route.params.id)
      .order('created_at')
  ])

  if (orderResult.error) {
    throw orderResult.error
  }

  if (itemsResult.error) {
    throw itemsResult.error
  }

  if (!orderResult.data) {
    return null
  }

  return {
    order: orderResult.data,
    items: itemsResult.data || []
  }
})

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const formatStatus = (value) => {
  if (value === 'in_progress') {
    return 'In Progress'
  }

  return String(value || 'Unknown').replace(/_/g, ' ')
}

useHead(() => ({
  title: orderData.value?.order?.order_number || 'Order Summary'
}))
</script>
