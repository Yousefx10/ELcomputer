<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-4xl font-bold text-gray-900">Products</h2>
            <p class="mt-2 text-sm text-gray-500">
              Manage your store products from one place
            </p>
          </div>

          <NuxtLink
            v-if="canAddProduct"
            to="/dashboard/products/add"
            class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            Add New Product
          </NuxtLink>
        </div>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-1">
        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Total Products</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">{{ totalProducts }}</p>
        </div>
      </div>

      <div v-if="errorMessage" class="mb-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ errorMessage }}
      </div>

      <div class="mb-6 rounded-2xl bg-white p-5 shadow">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex-1">
            <label for="product-search" class="mb-2 block text-sm font-semibold text-gray-700">
              Search Products
            </label>
            <input
              id="product-search"
              v-model="searchQuery"
              type="text"
              placeholder="Search by product title"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
          >
            Clear
          </button>
        </div>
      </div>

      <div v-if="loading" class="rounded-2xl bg-white p-8 text-center shadow">
        Loading products...
      </div>

      <div v-else-if="!products.length" class="rounded-2xl bg-white p-8 text-center shadow">
        <h3 class="text-2xl font-bold text-gray-900">
          {{ hasActiveSearch ? 'No matching products' : 'No products yet' }}
        </h3>
        <p class="mt-2 text-gray-500">
          {{ hasActiveSearch ? 'Try a different search term.' : 'Start by adding your first product.' }}
        </p>

        <NuxtLink
          v-if="!hasActiveSearch && canAddProduct"
          to="/dashboard/products/add"
          class="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          Add Product
        </NuxtLink>
      </div>

      <div v-else>
        <div class="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow">
          <p class="text-sm text-gray-500">
            Showing {{ pageStart }}-{{ pageEnd }} of {{ totalProducts }} {{ hasActiveSearch ? 'matching products' : 'products' }}
          </p>

          <p class="text-sm font-medium text-gray-600">
            Page {{ currentPage }} of {{ totalPages }}
          </p>
        </div>

        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="product in products"
            :key="product.id"
            class="overflow-hidden rounded-2xl bg-white shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div class="flex h-52 items-center justify-center bg-gray-100 p-4">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.title"
                class="h-full w-full object-contain"
              />

              <p v-else class="text-sm text-gray-400">No image available</p>
            </div>

            <div class="p-5">
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 class="line-clamp-2 text-xl font-bold text-gray-900">
                    {{ product.title }}
                  </h3>

                  <p class="mt-1 text-sm text-gray-500">
                    {{ product.category?.name || 'No Category' }}
                  </p>
                </div>

                <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  Product
                </span>
              </div>

              <div class="mb-4">
                <p class="text-2xl font-bold text-blue-600">
                  {{ product.price }} EGP
                </p>

                <p
                  v-if="product.old_price"
                  class="mt-1 text-sm text-gray-400 line-through"
                >
                  {{ product.old_price }} EGP
                </p>
              </div>

              <div class="flex gap-3">
                <NuxtLink
                  v-if="canEditProduct"
                  :to="`/dashboard/products/edit/${product.id}`"
                  class="flex-1 rounded-lg bg-black px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-800"
                >
                  Edit Product
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow">
          <button
            type="button"
            :disabled="currentPage === 1 || loading"
            @click="goToPreviousPage"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <p class="text-sm text-gray-500">
            Page {{ currentPage }} of {{ totalPages }}
          </p>

          <button
            type="button"
            :disabled="currentPage === totalPages || loading"
            @click="goToNextPage"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const {
  hasPermission,
  loadAdminAccess
} = useAdminAccess()

await loadAdminAccess()

const products = ref([])
const loading = ref(false)
const errorMessage = ref('')
const currentPage = ref(1)
const pageSize = 9
const totalProducts = ref(0)
const searchQuery = ref('')
let searchTimeoutId = null

const trimmedSearchQuery = computed(() => searchQuery.value.trim())
const hasActiveSearch = computed(() => Boolean(trimmedSearchQuery.value))
const canAddProduct = computed(() => hasPermission('products.add'))
const canEditProduct = computed(() => hasPermission('products.edit'))

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalProducts.value / pageSize))
})

const pageStart = computed(() => {
  if (!totalProducts.value) {
    return 0
  }

  return (currentPage.value - 1) * pageSize + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize, totalProducts.value)
})

const getProductsList = async (page = currentPage.value) => {
  loading.value = true
  errorMessage.value = ''

  currentPage.value = page
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('products')
    .select(`
      *,
      category:categories (
        id,
        name,
        slug
      )
    `, { count: 'exact' })

  if (trimmedSearchQuery.value) {
    query = query.ilike('title', `%${trimmedSearchQuery.value}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    loading.value = false
    errorMessage.value = error.message
    return
  }

  totalProducts.value = count || 0

  if (currentPage.value > totalPages.value) {
    loading.value = false
    await getProductsList(totalPages.value)
    return
  }

  products.value = data || []
  loading.value = false
}

const goToPreviousPage = async () => {
  if (currentPage.value === 1) {
    return
  }

  await getProductsList(currentPage.value - 1)
}

const goToNextPage = async () => {
  if (currentPage.value === totalPages.value) {
    return
  }

  await getProductsList(currentPage.value + 1)
}

const clearSearch = () => {
  searchQuery.value = ''
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    getProductsList(1)
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

await getProductsList()
</script>
