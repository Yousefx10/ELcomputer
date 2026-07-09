<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-4xl font-bold text-gray-900">Products</h2>
          <p class="mt-2 text-sm text-gray-500">
            Manage your store products from one place
          </p>
        </div>

        <NuxtLink
          to="/dashboard/products/add"
          class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          Add New Product
        </NuxtLink>
      </div>

      <section class="mb-6">
        <SideBarMobile :links="links" />
      </section>

      <div class="mb-6 grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Total Products</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">{{ products.length }}</p>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Latest Status</p>
          <p class="mt-2 text-lg font-semibold text-gray-900">
            {{ loading ? 'Loading products...' : 'Products loaded' }}
          </p>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Quick Action</p>
          <NuxtLink
            to="/dashboard/products/categories"
            class="mt-2 inline-block font-semibold text-blue-600 hover:text-blue-700"
          >
            Manage categories
          </NuxtLink>
        </div>
      </div>

      <div v-if="errorMessage" class="mb-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ errorMessage }}
      </div>

      <div v-if="loading" class="rounded-2xl bg-white p-8 text-center shadow">
        Loading products...
      </div>

      <div v-else-if="!products.length" class="rounded-2xl bg-white p-8 text-center shadow">
        <h3 class="text-2xl font-bold text-gray-900">No products yet</h3>
        <p class="mt-2 text-gray-500">Start by adding your first product.</p>

        <NuxtLink
          to="/dashboard/products/add"
          class="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          Add Product
        </NuxtLink>
      </div>

      <div v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                :to="`/dashboard/products/edit/${product.id}`"
                class="flex-1 rounded-lg bg-black px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-800"
              >
                Edit Product
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import SideBarMobile from '~/components/dashboard/SideBarMobile.vue'

definePageMeta({
  layout: 'dashboard'
})

const links = dashboardProductsLinks
const supabase = useSupabaseClient()

const products = ref([])
const loading = ref(false)
const errorMessage = ref('')

const getProductsList = async () => {
  loading.value = true
  errorMessage.value = ''

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false })

  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  products.value = data || []
}

await getProductsList()
</script>