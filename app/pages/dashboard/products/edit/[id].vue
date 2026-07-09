<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <h2 class="my-5 text-center text-4xl font-bold">
      Edit Product
    </h2>

    <p class="mb-6 text-center text-sm text-gray-500">
      Product ID: {{ id }}
    </p>

    <section class="mb-6">
      <SideBarMobile :links="links" />
    </section>

    <div v-if="pending" class="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-center shadow">
      Loading product...
    </div>

    <div
      v-else-if="fetchError"
      class="mx-auto max-w-5xl rounded-2xl bg-red-50 p-6 text-center text-red-600 shadow"
    >
      Error: {{ fetchError.message }}
    </div>

    <div v-else-if="product" class="mx-auto max-w-5xl">
      <form
        @submit.prevent="updateProduct"
        class="grid gap-5 rounded-2xl bg-white p-6 shadow md:grid-cols-2"
      >
        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">Product Details</h3>
          <p class="text-sm text-gray-500">
            Update the product information below
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Title</label>
          <input
            v-model="title"
            type="text"
            placeholder="Product title"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Category</label>
          <select
            v-model="categoryId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option disabled value="">Select Category</option>

            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Price</label>
          <input
            v-model="price"
            type="number"
            placeholder="Price"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Old Price</label>
          <input
            v-model="oldPrice"
            type="number"
            placeholder="Old price"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Image URL</label>
          <input
            v-model="imageUrl"
            type="text"
            placeholder="https://example.com/image.jpg"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2 rounded-2xl border border-dashed bg-gray-50 p-4">
          <p class="mb-3 text-sm font-semibold text-gray-700">Image Preview</p>

          <div class="flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl bg-white p-4">
            <img
              v-if="imageUrl"
              :src="imageUrl"
              :alt="title || 'Product image'"
              class="max-h-64 w-full object-contain"
            />

            <p v-else class="text-gray-400">
              Add an image URL to preview the product image
            </p>
          </div>
        </div>

        <p v-if="actionError" class="md:col-span-2 text-sm text-red-600">
          {{ actionError }}
        </p>

        <div class="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>

          <button
            type="button"
            @click="deleteProduct"
            class="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
          >
            {{ deleting ? 'Deleting...' : 'Delete Product' }}
          </button>

          <NuxtLink
            to="/dashboard/products"
            class="rounded-lg bg-gray-200 px-5 py-3 font-bold text-gray-800 hover:bg-gray-300"
          >
            Back
          </NuxtLink>
        </div>
      </form>
    </div>

    <div v-else class="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-center shadow">
      No product found.
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

const route = useRoute()
const id = route.params.id

const title = ref('')
const price = ref('')
const oldPrice = ref('')
const imageUrl = ref('')
const categoryId = ref('')

const categories = ref([])
const saving = ref(false)
const deleting = ref(false)
const actionError = ref('')

const { data: product, pending, error } = await useAsyncData(
  `edit-product-${id}`,
  async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return data
  }
)

const getCategoriesList = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  if (error) {
    actionError.value = error.message
    return
  }

  categories.value = data
}

await getCategoriesList()

watchEffect(() => {
  if (product.value) {
    title.value = product.value.title || ''
    price.value = product.value.price ?? ''
    oldPrice.value = product.value.old_price ?? ''
    imageUrl.value = product.value.image_url || ''
    categoryId.value = product.value.category_id || ''
  }
})

const updateProduct = async () => {
  actionError.value = ''

  if (!title.value.trim()) {
    actionError.value = 'Title is required'
    return
  }

  if (price.value === '' || price.value === null) {
    actionError.value = 'Price is required'
    return
  }

  saving.value = true

  const { error } = await supabase
    .from('products')
    .update({
      title: title.value.trim(),
      price: Number(price.value),
      old_price: oldPrice.value ? Number(oldPrice.value) : null,
      image_url: imageUrl.value.trim(),
      category_id: categoryId.value || null
    })
    .eq('id', id)

  saving.value = false

  if (error) {
    actionError.value = error.message
    return
  }

  await navigateTo('/dashboard/products')
}

const deleteProduct = async () => {
  actionError.value = ''

  const confirmDelete = confirm('Are you sure you want to delete this product?')
  if (!confirmDelete) return

  deleting.value = true

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  deleting.value = false

  if (error) {
    actionError.value = error.message
    return
  }

  await navigateTo('/dashboard/products')
}
</script>

<style scoped>

</style>