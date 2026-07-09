<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6">
        <h2 class="text-4xl font-bold">Dashboard</h2>
        <p class="mt-2 text-sm text-gray-500">
          Manage products and categories from one place
        </p>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-3">
        <NuxtLink
          to="/dashboard/products"
          class="rounded-2xl bg-white p-5 shadow hover:bg-gray-50"
        >
          <h3 class="text-lg font-bold">View Products</h3>
          <p class="mt-2 text-sm text-gray-500">
            Browse and edit all products
          </p>
        </NuxtLink>

        <NuxtLink
          to="/dashboard/products/add"
          class="rounded-2xl bg-white p-5 shadow hover:bg-gray-50"
        >
          <h3 class="text-lg font-bold">Add Product</h3>
          <p class="mt-2 text-sm text-gray-500">
            Create a new product record
          </p>
        </NuxtLink>

        <NuxtLink
          to="/dashboard/products/categories"
          class="rounded-2xl bg-white p-5 shadow hover:bg-gray-50"
        >
          <h3 class="text-lg font-bold">Manage Categories</h3>
          <p class="mt-2 text-sm text-gray-500">
            Add, edit, and remove categories
          </p>
        </NuxtLink>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Total Products</p>
          <p class="mt-2 text-3xl font-bold">
            {{ totalProducts }}
          </p>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Total Categories</p>
          <p class="mt-2 text-3xl font-bold">
            {{ totalCategories }}
          </p>
        </div>
      </div>

      <div v-if="errorMessage" class="mb-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ errorMessage }}
      </div>

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-2xl font-bold">Recent Products</h3>
          <NuxtLink
            to="/dashboard/products"
            class="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View all
          </NuxtLink>
        </div>

        <div v-if="loading" class="py-6 text-center text-gray-500">
          Loading dashboard data...
        </div>

        <div v-else-if="!recentProducts.length" class="py-6 text-center text-gray-500">
          No products found yet.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="product in recentProducts"
            :key="product.id"
            class="flex items-center justify-between rounded-xl border p-4"
          >
            <div>
              <p class="font-bold">{{ product.title }}</p>
              <p class="text-sm text-gray-500">
                {{ product.category?.name || 'No Category' }}
              </p>
            </div>

            <NuxtLink
              :to="`/dashboard/products/edit/${product.id}`"
              class="rounded-lg bg-black px-3 py-2 text-sm text-white"
            >
              Edit
            </NuxtLink>
          </div>
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

const totalProducts = ref(0)
const totalCategories = ref(0)
const recentProducts = ref([])
const loading = ref(false)
const errorMessage = ref('')

const getDashboardData = async () => {
  loading.value = true
  errorMessage.value = ''

  const [productsCountResult, categoriesCountResult, recentProductsResult] = await Promise.all([
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('categories')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('products')
      .select(`
        id,
        title,
        category:categories (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)
  ])

  loading.value = false

  if (productsCountResult.error) {
    errorMessage.value = productsCountResult.error.message
    return
  }

  if (categoriesCountResult.error) {
    errorMessage.value = categoriesCountResult.error.message
    return
  }

  if (recentProductsResult.error) {
    errorMessage.value = recentProductsResult.error.message
    return
  }

  totalProducts.value = productsCountResult.count || 0
  totalCategories.value = categoriesCountResult.count || 0
  recentProducts.value = recentProductsResult.data || []
}

await getDashboardData()
</script>
