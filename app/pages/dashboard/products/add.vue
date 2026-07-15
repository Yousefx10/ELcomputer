<template>
  <div class="">
    <h2 class="my-5 text-center text-4xl font-bold">
      Add New Product
    </h2>

    <div class="mx-auto max-w-6xl">
      <form
        @submit.prevent="addProduct"
        class="grid gap-5 rounded-2xl bg-white p-6 shadow md:grid-cols-2"
      >
        <div class="md:col-span-2 flex items-center justify-between rounded-2xl border bg-gray-50 p-4">
          <div>
            <p class="text-sm font-semibold text-gray-700">Store Visibility</p>
            <p class="text-sm text-gray-500">
              Choose whether this product should appear on the store after saving
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
            After saving, you will continue in the edit page to add extra images and specifications
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
          <label class="mb-2 block text-sm font-semibold text-gray-700">Default Supplier</label>
          <select
            v-model="defaultSupplierId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">No Default Supplier</option>

            <option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :value="supplier.id"
            >
              {{ supplier.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Primary Warehouse</label>
          <select
            v-model="primaryWarehouseId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">No Primary Warehouse</option>

            <option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
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
          <label class="mb-2 block text-sm font-semibold text-gray-700">Product Cost</label>
          <input
            v-model="costPrice"
            type="number"
            min="0"
            step="0.01"
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
          <DashboardMediaUploadField
            v-model="imageUrl"
            label="Main Image"
            section="products"
            :preview-alt="title || 'Product image'"
            help-text="Upload the main product image stored on the server host."
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

        <p v-if="actionError" class="md:col-span-2 text-sm text-red-600">
          {{ actionError }}
        </p>

        <div class="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            {{ saving ? 'Creating...' : 'Create Product' }}
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
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const {
  getSnapshot,
  invalidate,
  isFresh,
  setSnapshot
} = useDashboardCache()
const {
  getAdminAuthHeaders,
  recordAdminLog
} = useAdminLogs()
const PRODUCT_FORM_CATEGORIES_CACHE_KEY = 'dashboard:product-form:categories'
const PRODUCT_FORM_BRANDS_CACHE_KEY = 'dashboard:product-form:brands'
const PRODUCT_FORM_SUPPLIERS_CACHE_KEY = 'dashboard:product-form:suppliers'
const PRODUCT_FORM_WAREHOUSES_CACHE_KEY = 'dashboard:product-form:warehouses'

const title = ref('')
const slug = ref('')
const description = ref('')
const longDescription = ref('')
const price = ref('')
const oldPrice = ref('')
const imageUrl = ref('')
const categoryId = ref('')
const brandId = ref('')
const defaultSupplierId = ref('')
const primaryWarehouseId = ref('')
const sku = ref('')
const stockQuantity = ref(0)
const costPrice = ref('')
const colorName = ref('')
const colorHex = ref('')
const isPublished = ref(true)

const categories = ref([])
const brands = ref([])
const suppliers = ref([])
const warehouses = ref([])

const saving = ref(false)
const actionError = ref('')

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

const getCategoriesList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_CATEGORIES_CACHE_KEY)

  if (cachedSnapshot) {
    categories.value = cachedSnapshot
  }

  if (cachedSnapshot && isFresh(PRODUCT_FORM_CATEGORIES_CACHE_KEY)) {
    return
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  if (error) {
    actionError.value = error.message
    return
  }

  categories.value = data || []
  setSnapshot(PRODUCT_FORM_CATEGORIES_CACHE_KEY, categories.value)
}

const getBrandsList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_BRANDS_CACHE_KEY)

  if (cachedSnapshot) {
    brands.value = cachedSnapshot
  }

  if (cachedSnapshot && isFresh(PRODUCT_FORM_BRANDS_CACHE_KEY)) {
    return
  }

  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .order('name')

  if (error) {
    actionError.value = error.message
    return
  }

  brands.value = data || []
  setSnapshot(PRODUCT_FORM_BRANDS_CACHE_KEY, brands.value)
}

const getSuppliersList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_SUPPLIERS_CACHE_KEY)

  if (cachedSnapshot) {
    suppliers.value = cachedSnapshot
  }

  if (cachedSnapshot && isFresh(PRODUCT_FORM_SUPPLIERS_CACHE_KEY)) {
    return
  }

  const { data, error } = await supabase
    .from('commerce_crm_accounts')
    .select('id, name')
    .eq('account_type', 'supplier')
    .eq('is_active', true)
    .order('name')

  if (error) {
    actionError.value = error.message
    return
  }

  suppliers.value = data || []
  setSnapshot(PRODUCT_FORM_SUPPLIERS_CACHE_KEY, suppliers.value)
}

const getWarehousesList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_WAREHOUSES_CACHE_KEY)

  if (cachedSnapshot) {
    warehouses.value = cachedSnapshot
  }

  if (cachedSnapshot && isFresh(PRODUCT_FORM_WAREHOUSES_CACHE_KEY)) {
    return
  }

  const { data, error } = await supabase
    .from('commerce_warehouses')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    actionError.value = error.message
    return
  }

  warehouses.value = data || []
  setSnapshot(PRODUCT_FORM_WAREHOUSES_CACHE_KEY, warehouses.value)
}

const addProduct = async () => {
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

  if (Number(costPrice.value || 0) < 0) {
    actionError.value = 'Product cost cannot be negative'
    return
  }

  saving.value = true

  let data

  try {
    data = await $fetch('/api/admin-products', {
      method: 'POST',
      headers: await getAdminAuthHeaders(),
      body: {
        title: title.value,
        slug: normalizedSlug,
        description: description.value,
        long_description: longDescription.value,
        price: price.value,
        old_price: oldPrice.value,
        image_url: imageUrl.value,
        category_id: categoryId.value,
        brand_id: brandId.value,
        default_supplier_id: defaultSupplierId.value,
        primary_warehouse_id: primaryWarehouseId.value,
        sku: sku.value,
        stock_quantity: stockQuantity.value,
        cost_price: costPrice.value,
        color_name: colorName.value,
        color_hex: colorHex.value,
        is_published: isPublished.value
      }
    })
  } catch (error) {
    saving.value = false
    actionError.value = error?.data?.statusMessage || error?.message || 'Could not create this product.'
    return
  }

  saving.value = false

  await recordAdminLog({
    actionKey: 'products.create',
    description: `Added product ${title.value.trim()}.`,
    metadata: {
      product_id: data.id,
      product_title: title.value.trim(),
      product_slug: normalizedSlug
    }
  })

  invalidate('dashboard:products:')
  invalidate('dashboard:home')
  invalidate('dashboard:settings:inventory:')
  await navigateTo(`/dashboard/products/edit/${data.id}`)
}

onMounted(async () => {
  await Promise.all([
    getCategoriesList(),
    getBrandsList(),
    getSuppliersList(),
    getWarehousesList()
  ])
})
</script>
