<template>
  <div class="min-h-[60vh] bg-slate-50 py-7 sm:py-10">
    <div class="store-container">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div><p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Your cart</p><h1 class="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Cart <span class="text-xl font-medium text-slate-600">({{ itemCount }} {{ itemCount === 1 ? 'item' : 'items' }})</span></h1></div>
        <NuxtLink v-if="!isEmpty" to="/search" class="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50">Continue shopping</NuxtLink>
      </header>

      <div v-if="isEmpty" class="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
        <span class="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon name="lucide:shopping-cart" size="25" aria-hidden="true" /></span>
        <p class="mt-4 text-lg font-semibold text-slate-900">Your cart is empty.</p><p class="mt-2 text-sm text-slate-600">Add products from the store to start your order.</p>
        <NuxtLink to="/search" class="mt-6 inline-flex rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">Start shopping</NuxtLink>
      </div>

      <div v-else class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <main class="min-w-0 space-y-5">
          <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="delivery-options-title">
            <div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon name="lucide:package-check" size="20" aria-hidden="true" /></span><div><h2 id="delivery-options-title" class="text-xl font-bold text-slate-950">Delivery option</h2><p class="mt-0.5 text-sm text-slate-600">Your delivery address is confirmed at checkout.</p></div></div>
            <div class="mt-5 max-w-sm rounded-2xl border-2 border-slate-950 bg-white p-5 text-center"><span class="mx-auto grid size-12 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon name="lucide:truck" size="24" aria-hidden="true" /></span><p class="mt-3 font-bold text-slate-950">Shipping</p><p class="mt-1 text-sm text-emerald-700">Available</p></div>
          </section>

          <section class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" aria-labelledby="shipping-group-title">
            <div class="flex items-start gap-4 bg-blue-50 p-5 sm:p-6"><span class="grid size-12 shrink-0 place-items-center rounded-full bg-white text-blue-700 shadow-sm"><Icon name="lucide:truck" size="24" aria-hidden="true" /></span><div><h2 id="shipping-group-title" class="text-xl font-bold text-slate-950">Shipping for {{ itemCount }} {{ itemCount === 1 ? 'item' : 'items' }}</h2><p class="mt-1 text-sm text-slate-700">Delivery timing and cost are confirmed during checkout.</p><p class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Icon name="lucide:shield-check" size="16" aria-hidden="true" /> Stock is checked again when you confirm.</p></div></div>

            <div class="divide-y divide-slate-200 px-5 sm:px-6">
              <article v-for="item in items" :key="item.cart_key" class="py-6">
                <p class="mb-4 text-xs font-semibold text-slate-500">Sold and shipped by ELcomputer</p>
                <div class="grid gap-5 sm:grid-cols-[130px_minmax(0,1fr)]">
                  <NuxtLink :to="getProductLink(item)" class="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="size-full object-contain"><Icon v-else name="lucide:image" size="26" class="text-slate-300" aria-label="No image" /></NuxtLink>
                  <div class="min-w-0">
                    <div class="flex items-start justify-between gap-4"><div class="min-w-0"><NuxtLink :to="getProductLink(item)" class="line-clamp-2 text-base font-bold leading-6 text-slate-950 hover:text-blue-700">{{ item.title }}</NuxtLink><p class="mt-1 text-sm text-slate-500">{{ item.brand_name || item.category_name || 'Store product' }}</p></div><p class="shrink-0 text-lg font-bold text-slate-950">{{ formatCurrency(item.price * item.quantity) }}</p></div>
                    <div v-if="item.variant_id" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600"><span v-if="getVariantColor(item)" class="size-4 rounded-full border border-black/10" :style="{ backgroundColor: getVariantColor(item) }" /><span>{{ item.variant_name || item.variant_color_name || 'Selected option' }}</span></div>
                    <p class="mt-3 text-sm font-semibold" :class="item.allow_out_of_stock_purchases || Number(item.stock_quantity) > 0 ? 'text-emerald-700' : 'text-red-700'">{{ item.allow_out_of_stock_purchases || Number(item.stock_quantity) > 0 ? 'Available to order' : 'Currently unavailable' }}</p>
                    <div class="mt-5 flex flex-wrap items-center justify-between gap-4"><div class="inline-flex items-center overflow-hidden rounded-full border border-slate-300 bg-white"><button type="button" class="grid size-11 place-items-center text-xl text-slate-700 hover:bg-slate-100" :aria-label="`Decrease ${item.title} quantity`" @click="decrementItem(item.cart_key)">−</button><span class="inline-flex min-w-12 items-center justify-center text-sm font-bold text-slate-900" aria-live="polite">{{ item.quantity }}</span><button type="button" class="grid size-11 place-items-center text-xl text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300" :aria-label="`Increase ${item.title} quantity`" :disabled="item.quantity >= getMaximumQuantity(item)" @click="incrementItem(item.cart_key)">+</button></div><button type="button" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50" @click="removeItem(item.cart_key)">Remove</button></div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </main>

        <aside class="hidden h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-40 lg:block">
          <NuxtLink to="/checkout" class="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">Continue to checkout</NuxtLink>
          <dl class="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm"><div class="flex justify-between gap-3 text-slate-600"><dt>Subtotal ({{ itemCount }} {{ itemCount === 1 ? 'item' : 'items' }})</dt><dd>{{ formatCurrency(subtotal) }}</dd></div><div class="flex justify-between gap-3 text-slate-600"><dt>Shipping</dt><dd>Calculated at checkout</dd></div><div class="flex justify-between gap-3 border-t border-slate-200 pt-4 text-lg font-bold text-slate-950"><dt>Estimated total</dt><dd>{{ formatCurrency(subtotal) }}</dd></div></dl>
          <button type="button" class="mt-4 min-h-10 w-full rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100" @click="clearCart">Clear cart</button>
        </aside>
      </div>

      <div v-if="!isEmpty" class="sticky bottom-3 z-20 mt-5 rounded-2xl bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,.22)] ring-1 ring-slate-200 lg:hidden"><div class="flex items-center justify-between gap-3"><div><p class="text-xs text-slate-500">Estimated total</p><p class="text-lg font-bold text-slate-950">{{ formatCurrency(subtotal) }}</p></div><NuxtLink to="/checkout" class="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700">Checkout</NuxtLink></div></div>

      <section v-if="recommendationsLoading || recommendations.length" class="mt-10" aria-labelledby="cart-suggestions-title">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Recommended</p><h2 id="cart-suggestions-title" class="mt-1 text-2xl font-bold text-slate-950">{{ isEmpty ? 'Popular products' : 'You may also like' }}</h2></div>
          <NuxtLink to="/search" class="text-sm font-semibold text-blue-700 hover:underline">View all products</NuxtLink>
        </div>
        <LayoutPageLoading v-if="recommendationsLoading" label="Loading suggestions…" />
        <div v-else class="store-search-grid">
          <CardsProductCard v-for="product in recommendations" :key="product.id" :product="product" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
const { items, itemCount, subtotal, isEmpty, incrementItem, decrementItem, removeItem, clearCart, loadCart } = useCart()
const supabase = useSupabaseClient()
const recommendations = ref([])
const recommendationsLoading = ref(false)
let recommendationVersion = 0

const formatCurrency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value || 0))
const getProductLink = item => !item?.slug ? '/' : { path: `/products/${item.slug}`, query: item.variant_id ? { variant: item.variant_id } : {} }
const getVariantColor = item => /^#[0-9a-f]{6}$/i.test(String(item?.variant_color_hex || '').trim()) ? item.variant_color_hex : ''
const getMaximumQuantity = item => item?.allow_out_of_stock_purchases ? 99 : Math.max(1, Number(item?.stock_quantity || 0))

const loadRecommendations = async () => {
  const version = ++recommendationVersion
  recommendationsLoading.value = true
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        title,
        slug,
        description,
        price,
        old_price,
        image_url,
        stock_quantity,
        is_serialized,
        is_featured,
        is_top_seller,
        popularity_score,
        category:categories (id, name, slug),
        brand:brands (id, name, slug),
        product_variants (id, is_active)
      `)
      .eq('is_published', true)
      .order('is_top_seller', { ascending: false })
      .order('popularity_score', { ascending: false })
      .limit(24)

    if (error) throw error
    if (version !== recommendationVersion) return

    const cartProductIds = new Set(items.value.map(item => String(item.id)))
    const cartCategories = new Set(items.value.map(item => String(item.category_name || '').toLocaleLowerCase()).filter(Boolean))
    const cartBrands = new Set(items.value.map(item => String(item.brand_name || '').toLocaleLowerCase()).filter(Boolean))
    recommendations.value = (data || [])
      .filter(product => !cartProductIds.has(String(product.id)))
      .map(product => ({
        ...product,
        recommendationScore:
          (cartCategories.has(String(product.category?.name || '').toLocaleLowerCase()) ? 4 : 0)
          + (cartBrands.has(String(product.brand?.name || '').toLocaleLowerCase()) ? 3 : 0)
          + (product.is_top_seller ? 2 : 0)
          + (product.is_featured ? 1 : 0)
      }))
      .sort((first, second) => second.recommendationScore - first.recommendationScore
        || Number(second.popularity_score || 0) - Number(first.popularity_score || 0))
      .slice(0, 4)
  } catch {
    if (version === recommendationVersion) recommendations.value = []
  } finally {
    if (version === recommendationVersion) recommendationsLoading.value = false
  }
}

const cartRecommendationKey = computed(() => items.value
  .map(item => `${item.id}:${item.brand_name}:${item.category_name}`)
  .sort()
  .join('|'))

onMounted(() => {
  loadCart()
  loadRecommendations()
})
watch(cartRecommendationKey, loadRecommendations)
useHead({ title: 'Cart' })
</script>
