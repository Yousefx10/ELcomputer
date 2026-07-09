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

    <div v-if="pending" class="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-center shadow">
      Loading product...
    </div>

    <div
      v-else-if="fetchError"
      class="mx-auto max-w-6xl rounded-2xl bg-red-50 p-6 text-center text-red-600 shadow"
    >
      Error: {{ fetchError.message }}
    </div>

    <div v-else-if="product" class="mx-auto max-w-6xl space-y-6">
      <form
        @submit.prevent="updateProduct"
        class="grid gap-5 rounded-2xl bg-white p-6 shadow md:grid-cols-2"
      >
        <div class="md:col-span-2 flex items-center justify-between rounded-2xl border bg-gray-50 p-4">
          <div>
            <p class="text-sm font-semibold text-gray-700">Store Visibility</p>
            <p class="text-sm text-gray-500">
              Control whether this product is visible on the public store
            </p>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold" :class="isPublished ? 'text-green-600' : 'text-gray-500'">
              {{ isPublished ? 'ON' : 'OFF' }}
            </span>

            <button
              type="button"
              :aria-pressed="isPublished"
              @click="isPublished = !isPublished"
              class="relative inline-flex h-7 w-14 items-center rounded-full transition"
              :class="isPublished ? 'bg-green-600' : 'bg-gray-300'"
            >
              <span
                class="inline-block h-5 w-5 rounded-full bg-white transition"
                :class="isPublished ? 'translate-x-8' : 'translate-x-1'"
              />
            </button>
          </div>
        </div>

        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">Product Details</h3>
          <p class="text-sm text-gray-500">
            Update the product data that powers the public product page
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
          <label class="mb-2 block text-sm font-semibold text-gray-700">Slug</label>

          <div class="flex gap-2">
            <input
              v-model="slug"
              type="text"
              placeholder="product-slug"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <button
              type="button"
              @click="useTitleSlug"
              class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
            >
              Generate
            </button>
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Category</label>
          <select
            v-model="categoryId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">No Category</option>

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
          <label class="mb-2 block text-sm font-semibold text-gray-700">Brand</label>
          <select
            v-model="brandId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">No Brand</option>

            <option
              v-for="brand in brands"
              :key="brand.id"
              :value="brand.id"
            >
              {{ brand.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Price</label>
          <input
            v-model="price"
            type="number"
            min="0"
            placeholder="Price"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Old Price</label>
          <input
            v-model="oldPrice"
            type="number"
            min="0"
            placeholder="Old price"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Stock Quantity</label>
          <input
            v-model="stockQuantity"
            type="number"
            min="0"
            placeholder="0"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">SKU</label>
          <input
            v-model="sku"
            type="text"
            placeholder="Optional SKU"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Color Name</label>
          <input
            v-model="colorName"
            type="text"
            placeholder="Black"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Color Hex</label>
          <input
            v-model="colorHex"
            type="text"
            placeholder="#000000"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Main Image URL</label>
          <input
            v-model="imageUrl"
            type="text"
            placeholder="https://example.com/image.jpg"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Short Description</label>
          <textarea
            v-model="description"
            rows="4"
            placeholder="Short product description"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Long Description</label>
          <textarea
            v-model="longDescription"
            rows="7"
            placeholder="Long product description"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2 rounded-2xl border border-dashed bg-gray-50 p-4">
          <p class="mb-3 text-sm font-semibold text-gray-700">Main Image Preview</p>

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

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="mb-4">
          <h3 class="text-2xl font-bold">Extra Images</h3>
          <p class="text-sm text-gray-500">
            For now, add direct image links. Upload support can be added later.
          </p>
        </div>

        <div class="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
          <input
            v-model="newImageUrl"
            type="text"
            placeholder="Image URL"
            class="rounded-lg border p-3 outline-none focus:border-blue-500"
          />

          <input
            v-model="newImageAlt"
            type="text"
            placeholder="Alt text"
            class="rounded-lg border p-3 outline-none focus:border-blue-500"
          />

          <button
            type="button"
            @click="addProductImage"
            class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
          >
            {{ galleryLoading ? 'Saving...' : 'Add Image' }}
          </button>
        </div>

        <p v-if="galleryError" class="mb-4 text-sm text-red-600">
          {{ galleryError }}
        </p>

        <div v-if="productImages.length" class="space-y-3">
          <div
            v-for="image in productImages"
            :key="image.id"
            class="grid gap-3 rounded-xl border p-4 md:grid-cols-[120px_minmax(0,2fr)_minmax(0,1fr)_auto]"
          >
            <div class="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-gray-100 p-2">
              <img
                v-if="image.image_url"
                :src="image.image_url"
                :alt="image.alt_text || title"
                class="h-full w-full object-contain"
              />
            </div>

            <input
              v-model="image.image_url"
              type="text"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <input
              v-model="image.alt_text"
              type="text"
              placeholder="Alt text"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <div class="flex gap-2 self-start">
              <button
                type="button"
                @click="saveProductImage(image)"
                :disabled="!isProductImageDirty(image) || galleryLoading"
                class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                :class="isProductImageDirty(image) && !galleryLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                Save
              </button>

              <button
                type="button"
                @click="deleteProductImage(image.id)"
                class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-gray-500">
          No extra images added yet.
        </p>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="mb-4">
          <h3 class="text-2xl font-bold">Specifications</h3>
          <p class="text-sm text-gray-500">
            Add product details like switch type, weight, connectivity, or dimensions.
          </p>
        </div>

        <div class="mb-5 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <input
            v-model="newSpecLabel"
            type="text"
            placeholder="Label"
            class="rounded-lg border p-3 outline-none focus:border-blue-500"
          />

          <input
            v-model="newSpecValue"
            type="text"
            placeholder="Value"
            class="rounded-lg border p-3 outline-none focus:border-blue-500"
          />

          <button
            type="button"
            @click="addProductSpecification"
            class="rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
          >
            {{ specLoading ? 'Saving...' : 'Add Spec' }}
          </button>
        </div>

        <p v-if="specError" class="mb-4 text-sm text-red-600">
          {{ specError }}
        </p>

        <div v-if="productSpecifications.length" class="space-y-3">
          <div
            v-for="specification in productSpecifications"
            :key="specification.id"
            class="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
          >
            <input
              v-model="specification.label"
              type="text"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <input
              v-model="specification.value"
              type="text"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <div class="flex gap-2 self-start">
              <button
                type="button"
                @click="saveProductSpecification(specification)"
                :disabled="!isProductSpecificationDirty(specification) || specLoading"
                class="rounded-lg px-4 py-3 text-sm font-medium text-white"
                :class="isProductSpecificationDirty(specification) && !specLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'"
              >
                Save
              </button>

              <button
                type="button"
                @click="deleteProductSpecification(specification.id)"
                class="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <p v-else class="text-sm text-gray-500">
          No specifications added yet.
        </p>
      </section>
    </div>

    <div v-else class="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-center shadow">
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
const slug = ref('')
const description = ref('')
const longDescription = ref('')
const price = ref('')
const oldPrice = ref('')
const imageUrl = ref('')
const categoryId = ref('')
const brandId = ref('')
const sku = ref('')
const stockQuantity = ref(0)
const colorName = ref('')
const colorHex = ref('')
const isPublished = ref(true)

const categories = ref([])
const brands = ref([])
const productImages = ref([])
const productSpecifications = ref([])

const newImageUrl = ref('')
const newImageAlt = ref('')
const newSpecLabel = ref('')
const newSpecValue = ref('')

const saving = ref(false)
const deleting = ref(false)
const galleryLoading = ref(false)
const specLoading = ref(false)
const actionError = ref('')
const galleryError = ref('')
const specError = ref('')

const makeSlug = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const useTitleSlug = () => {
  slug.value = makeSlug(title.value)
}

const { data: product, pending, error: fetchError } = await useAsyncData(
  `edit-product-${id}`,
  async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      throw error
    }

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

  categories.value = data || []
}

const getBrandsList = async () => {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .order('name')

  if (error) {
    actionError.value = error.message
    return
  }

  brands.value = data || []
}

const getProductImages = async () => {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', id)
    .order('created_at')

  if (error) {
    galleryError.value = error.message
    return
  }

  productImages.value = (data || []).map((image) => ({
    ...image,
    original_image_url: image.image_url || '',
    original_alt_text: image.alt_text || ''
  }))
}

const getProductSpecifications = async () => {
  const { data, error } = await supabase
    .from('product_specifications')
    .select('*')
    .eq('product_id', id)
    .order('created_at')

  if (error) {
    specError.value = error.message
    return
  }

  productSpecifications.value = (data || []).map((specification) => ({
    ...specification,
    original_label: specification.label || '',
    original_value: specification.value || ''
  }))
}

await Promise.all([
  getCategoriesList(),
  getBrandsList(),
  getProductImages(),
  getProductSpecifications()
])

watchEffect(() => {
  if (product.value) {
    title.value = product.value.title || ''
    slug.value = product.value.slug || makeSlug(product.value.title || '')
    description.value = product.value.description || ''
    longDescription.value = product.value.long_description || ''
    price.value = product.value.price ?? ''
    oldPrice.value = product.value.old_price ?? ''
    imageUrl.value = product.value.image_url || ''
    categoryId.value = product.value.category_id || ''
    brandId.value = product.value.brand_id || ''
    sku.value = product.value.sku || ''
    stockQuantity.value = product.value.stock_quantity ?? 0
    colorName.value = product.value.color_name || ''
    colorHex.value = product.value.color_hex || ''
    isPublished.value = product.value.is_published ?? true
  }
})

const updateProduct = async () => {
  actionError.value = ''

  const normalizedSlug = makeSlug(slug.value || title.value)

  if (!title.value.trim()) {
    actionError.value = 'Title is required'
    return
  }

  if (!normalizedSlug) {
    actionError.value = 'Slug is required'
    return
  }

  if (price.value === '' || price.value === null) {
    actionError.value = 'Price is required'
    return
  }

  if (Number(stockQuantity.value) < 0) {
    actionError.value = 'Stock quantity cannot be negative'
    return
  }

  saving.value = true

  const { error } = await supabase
    .from('products')
    .update({
      title: title.value.trim(),
      slug: normalizedSlug,
      description: description.value.trim() || null,
      long_description: longDescription.value.trim() || null,
      price: Number(price.value),
      old_price: oldPrice.value ? Number(oldPrice.value) : null,
      image_url: imageUrl.value.trim() || null,
      category_id: categoryId.value || null,
      brand_id: brandId.value || null,
      sku: sku.value.trim() || null,
      stock_quantity: Number(stockQuantity.value) || 0,
      color_name: colorName.value.trim() || null,
      color_hex: colorHex.value.trim() || null,
      is_published: isPublished.value
    })
    .eq('id', id)

  saving.value = false

  if (error) {
    actionError.value = error.message
    return
  }

  slug.value = normalizedSlug
  await navigateTo('/dashboard/products')
}

const addProductImage = async () => {
  galleryError.value = ''

  if (!newImageUrl.value.trim()) {
    galleryError.value = 'Image URL is required'
    return
  }

  galleryLoading.value = true

  const { error } = await supabase
    .from('product_images')
    .insert({
      product_id: id,
      image_url: newImageUrl.value.trim(),
      alt_text: newImageAlt.value.trim() || null
    })

  galleryLoading.value = false

  if (error) {
    galleryError.value = error.message
    return
  }

  newImageUrl.value = ''
  newImageAlt.value = ''
  await getProductImages()
}

const isProductImageDirty = (image) => {
  return image.image_url !== image.original_image_url ||
    (image.alt_text || '') !== image.original_alt_text
}

const saveProductImage = async (image) => {
  galleryError.value = ''

  if (!image.image_url?.trim()) {
    galleryError.value = 'Image URL is required'
    return
  }

  if (!isProductImageDirty(image)) {
    return
  }

  galleryLoading.value = true

  const { error } = await supabase
    .from('product_images')
    .update({
      image_url: image.image_url.trim(),
      alt_text: image.alt_text?.trim() || null
    })
    .eq('id', image.id)

  galleryLoading.value = false

  if (error) {
    galleryError.value = error.message
    return
  }

  await getProductImages()
}

const deleteProductImage = async (imageId) => {
  galleryError.value = ''

  const confirmDelete = confirm('Delete this extra image?')
  if (!confirmDelete) {
    return
  }

  galleryLoading.value = true

  const { error } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId)

  galleryLoading.value = false

  if (error) {
    galleryError.value = error.message
    return
  }

  await getProductImages()
}

const addProductSpecification = async () => {
  specError.value = ''

  if (!newSpecLabel.value.trim() || !newSpecValue.value.trim()) {
    specError.value = 'Specification label and value are required'
    return
  }

  specLoading.value = true

  const { error } = await supabase
    .from('product_specifications')
    .insert({
      product_id: id,
      label: newSpecLabel.value.trim(),
      value: newSpecValue.value.trim()
    })

  specLoading.value = false

  if (error) {
    specError.value = error.message
    return
  }

  newSpecLabel.value = ''
  newSpecValue.value = ''
  await getProductSpecifications()
}

const isProductSpecificationDirty = (specification) => {
  return specification.label !== specification.original_label ||
    specification.value !== specification.original_value
}

const saveProductSpecification = async (specification) => {
  specError.value = ''

  if (!specification.label?.trim() || !specification.value?.trim()) {
    specError.value = 'Specification label and value are required'
    return
  }

  if (!isProductSpecificationDirty(specification)) {
    return
  }

  specLoading.value = true

  const { error } = await supabase
    .from('product_specifications')
    .update({
      label: specification.label.trim(),
      value: specification.value.trim()
    })
    .eq('id', specification.id)

  specLoading.value = false

  if (error) {
    specError.value = error.message
    return
  }

  await getProductSpecifications()
}

const deleteProductSpecification = async (specificationId) => {
  specError.value = ''

  const confirmDelete = confirm('Delete this specification?')
  if (!confirmDelete) {
    return
  }

  specLoading.value = true

  const { error } = await supabase
    .from('product_specifications')
    .delete()
    .eq('id', specificationId)

  specLoading.value = false

  if (error) {
    specError.value = error.message
    return
  }

  await getProductSpecifications()
}

const deleteProduct = async () => {
  actionError.value = ''

  const confirmDelete = confirm('Are you sure you want to delete this product?')
  if (!confirmDelete) {
    return
  }

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
