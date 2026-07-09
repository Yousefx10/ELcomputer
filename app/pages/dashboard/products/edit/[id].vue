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

        <div class="md:col-span-2 flex items-center gap-3">
          <input
            id="is-published"
            v-model="isPublished"
            type="checkbox"
            class="h-4 w-4"
          />

          <label for="is-published" class="text-sm font-semibold text-gray-700">
            Product is published and visible on the store
          </label>
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

        <div class="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_120px_140px]">
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

          <input
            v-model="newImageSortOrder"
            type="number"
            placeholder="Sort"
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
            class="grid gap-3 rounded-xl border p-4 md:grid-cols-[120px_2fr_1fr_120px_140px_140px]"
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

            <input
              v-model="image.sort_order"
              type="number"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <button
              type="button"
              @click="saveProductImage(image)"
              class="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
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

        <div class="mb-5 grid gap-3 md:grid-cols-[1fr_2fr_120px_140px]">
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

          <input
            v-model="newSpecSortOrder"
            type="number"
            placeholder="Sort"
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
            class="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_2fr_120px_140px_140px]"
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

            <input
              v-model="specification.sort_order"
              type="number"
              class="rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <button
              type="button"
              @click="saveProductSpecification(specification)"
              class="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
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
const newImageSortOrder = ref(0)
const newSpecLabel = ref('')
const newSpecValue = ref('')
const newSpecSortOrder = ref(0)

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
    .order('sort_order')
    .order('created_at')

  if (error) {
    galleryError.value = error.message
    return
  }

  productImages.value = data || []
}

const getProductSpecifications = async () => {
  const { data, error } = await supabase
    .from('product_specifications')
    .select('*')
    .eq('product_id', id)
    .order('sort_order')
    .order('created_at')

  if (error) {
    specError.value = error.message
    return
  }

  productSpecifications.value = data || []
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
      alt_text: newImageAlt.value.trim() || null,
      sort_order: Number(newImageSortOrder.value) || 0
    })

  galleryLoading.value = false

  if (error) {
    galleryError.value = error.message
    return
  }

  newImageUrl.value = ''
  newImageAlt.value = ''
  newImageSortOrder.value = 0
  await getProductImages()
}

const saveProductImage = async (image) => {
  galleryError.value = ''

  if (!image.image_url?.trim()) {
    galleryError.value = 'Image URL is required'
    return
  }

  galleryLoading.value = true

  const { error } = await supabase
    .from('product_images')
    .update({
      image_url: image.image_url.trim(),
      alt_text: image.alt_text?.trim() || null,
      sort_order: Number(image.sort_order) || 0
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
      value: newSpecValue.value.trim(),
      sort_order: Number(newSpecSortOrder.value) || 0
    })

  specLoading.value = false

  if (error) {
    specError.value = error.message
    return
  }

  newSpecLabel.value = ''
  newSpecValue.value = ''
  newSpecSortOrder.value = 0
  await getProductSpecifications()
}

const saveProductSpecification = async (specification) => {
  specError.value = ''

  if (!specification.label?.trim() || !specification.value?.trim()) {
    specError.value = 'Specification label and value are required'
    return
  }

  specLoading.value = true

  const { error } = await supabase
    .from('product_specifications')
    .update({
      label: specification.label.trim(),
      value: specification.value.trim(),
      sort_order: Number(specification.sort_order) || 0
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
