<template>
  <div class="">
    <DashboardPageIntro
      :title="$t('common.addNewProduct')"
      container-class=""
      title-class="my-5 text-center text-4xl font-bold"
    />

    <div class="mx-auto max-w-6xl">
      <form
        @submit.prevent="addProduct"
        class="grid gap-5 rounded-2xl bg-white p-6 shadow md:grid-cols-2"
      >
        <fieldset :disabled="formLoading || saving || saveUnconfirmed || !hasPermission('products.add')" class="contents">
        <div class="md:col-span-2 flex items-center justify-between rounded-2xl border bg-gray-50 p-4">
          <p class="text-sm text-gray-500">{{ $t('productEditor.draftHelp') }}</p>
          <span class="text-sm font-semibold text-gray-700">{{ $t('productEditor.draft') }}</span>
        </div>

        <div class="md:col-span-2">
          <h3 class="text-2xl font-bold">{{ $t('common.productDetails') }}</h3>
          <p class="text-sm text-gray-500">
            {{ $t('productEditor.required') }}
          </p>
        </div>

        <div class="md:col-span-2 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-semibold text-gray-900">{{ $t('common.individualItemIdsQrCodes') }}</p>
            <p class="mt-1 max-w-3xl text-sm text-gray-600">
              {{ $t('dashboard.products.addProductDetailsAndOptionsHereReceiveStockThroughPurchasing') }}
            </p>
          </div>

          <span class="inline-flex shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            <Icon name="lucide:qr-code" size="17" />
            {{ $t('common.alwaysEnabled') }}
          </span>
        </div>

        <div>
          <label for="product-title" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.title') }}</label>
          <input
            v-model="title"
            id="product-title"
            :aria-invalid="Boolean(fieldErrors.title || saveField === 'title')"
            :aria-describedby="fieldErrors.title || saveField === 'title' ? 'product-title-error' : undefined"
            type="text"
            :placeholder="$t('common.productTitle')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.title || saveField === 'title'" id="product-title-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.title ? $t('productEditor.field.title') : saveError }}</p>
        </div>

        <div>
          <label for="product-slug" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.slug') }}</label>

          <div class="flex gap-2">
            <input
              v-model="slug"
            id="product-slug"
            :aria-invalid="Boolean(fieldErrors.slug || saveField === 'slug')"
            :aria-describedby="fieldErrors.slug || saveField === 'slug' ? 'product-slug-error' : undefined"
              type="text"
              placeholder="product-slug"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            />

            <button
              type="button"
              @click="useTitleSlug"
              class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
            >
              {{ $t('common.generate') }}
            </button>
          </div>
          <p v-if="fieldErrors.slug || saveField === 'slug'" id="product-slug-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.slug ? $t('productEditor.field.slug') : saveError }}</p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.category') }}</label>
          <select
            v-model="categoryId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noCategory') }}</option>

            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.categories && !categories.length" class="mt-2 text-xs text-gray-500">
            {{ $t('productEditor.noCategories') }}
            <NuxtLinkLocale v-if="hasPermission('categories.add') && true" to="/dashboard/products/categories" @click.prevent="openPrerequisite('/dashboard/products/categories')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.createCategory') }}</NuxtLinkLocale>
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.brand') }}</label>
          <select
            v-model="brandId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noBrand') }}</option>

            <option
              v-for="brand in brands"
              :key="brand.id"
              :value="brand.id"
            >
              {{ brand.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.brands && !brands.length" class="mt-2 text-xs text-gray-500">
            {{ $t('productEditor.noBrands') }}
            <NuxtLinkLocale v-if="hasPermission('brands.add') && true" to="/dashboard/products/brands" @click.prevent="openPrerequisite('/dashboard/products/brands')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.createBrand') }}</NuxtLinkLocale>
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.preferredSupplierOptional') }}</label>
          <select
            v-model="defaultSupplierId"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noPreferredSupplier') }}</option>

            <option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :value="supplier.id"
            >
              {{ supplier.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.suppliers && !suppliers.length" class="mt-2 text-xs text-gray-500">
            {{ $t('productEditor.noSuppliers') }}
            <NuxtLinkLocale v-if="(hasPermission('products.add') || hasPermission('products.edit')) && !externalErp" to="/dashboard/crm" @click.prevent="openPrerequisite('/dashboard/crm')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.manageSuppliers') }}</NuxtLinkLocale>
          </p>
          <p class="mt-2 text-xs text-gray-500">
            {{ $t('common.forReferenceOnlyProcurementCanReceiveThisProductFromAnyActiveSupplier') }}
          </p>
        </div>

        <div>
          <label for="product-primary_warehouse_id" class="mb-2 block text-sm font-semibold text-gray-700">
            {{ $t('common.primaryWarehouse') }}
          </label>
          <select
            v-model="primaryWarehouseId"
            id="product-primary_warehouse_id"
            :aria-invalid="Boolean(fieldErrors.primary_warehouse_id || saveField === 'primary_warehouse_id')"
            :aria-describedby="fieldErrors.primary_warehouse_id || saveField === 'primary_warehouse_id' ? 'product-primary_warehouse_id-error' : undefined"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">{{ $t('common.noPrimaryWarehouse') }}</option>

            <option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
          <p v-if="!formLoading && !lookupFailures.warehouses && !warehouses.length" class="mt-2 text-xs text-amber-700">
            {{ $t(externalErp ? 'productEditor.daftraWarehouse' : (hasPermission('products.add') || hasPermission('products.edit')) ? 'productEditor.noWarehouse' : 'productEditor.warehouseAccess') }}
            <NuxtLinkLocale v-if="!externalErp && (hasPermission('products.add') || hasPermission('products.edit'))" to="/dashboard/commerce?tab=warehouses" @click.prevent="openPrerequisite('/dashboard/commerce?tab=warehouses')" class="ms-1 text-blue-700 underline">{{ $t('productEditor.createWarehouse') }}</NuxtLinkLocale>
          </p>
          <p v-if="fieldErrors.primary_warehouse_id || saveField === 'primary_warehouse_id'" id="product-primary_warehouse_id-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.primary_warehouse_id ? $t('productEditor.field.warehouse') : saveError }}</p>
        </div>

        <div>
          <label for="product-price" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.price') }}</label>
          <input
            v-model="price"
            id="product-price"
            :aria-invalid="Boolean(fieldErrors.price || saveField === 'price')"
            :aria-describedby="fieldErrors.price || saveField === 'price' ? 'product-price-error' : undefined"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('common.price')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.price || saveField === 'price'" id="product-price-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.price ? $t('productEditor.field.price') : saveError }}</p>
        </div>

        <div>
          <label for="product-old_price" class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.oldPrice') }}</label>
          <input
            v-model="oldPrice"
            id="product-old_price"
            :aria-invalid="Boolean(fieldErrors.old_price || saveField === 'old_price')"
            :aria-describedby="fieldErrors.old_price || saveField === 'old_price' ? 'product-old_price-error' : undefined"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('common.oldPrice')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.old_price || saveField === 'old_price'" id="product-old_price-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.old_price ? $t('productEditor.field.old_price') : saveError }}</p>
        </div>

        <div class="rounded-xl border border-green-200 bg-green-50 p-4">
          <p class="text-sm font-semibold text-green-800">{{ $t('common.unitsToCreate') }}</p>
          <p class="mt-1 text-3xl font-bold text-green-700">0</p>
          <p class="mt-1 text-xs text-green-700">
            {{ $t('dashboard.products.addStockThroughPurchasingEachReceivedItemGetsAQrCode') }}
          </p>
        </div>

        <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p class="text-sm font-semibold text-blue-900">{{ $t('common.inventoryCost') }}</p>
          <p class="mt-1 text-sm text-blue-800">
            {{ $t('dashboard.products.calculatedFromPurchaseQuantitiesAndSupplierPrices') }}
          </p>
        </div>

        <div>
          <label for="product-sku" class="mb-2 block text-sm font-semibold text-gray-700">SKU</label>
          <input
            v-model="sku"
            id="product-sku"
            :aria-invalid="Boolean(fieldErrors.sku || saveField === 'sku')"
            :aria-describedby="fieldErrors.sku || saveField === 'sku' ? 'product-sku-error' : undefined"
            type="text"
            :placeholder="$t('common.optionalSku')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
          <p v-if="fieldErrors.sku || saveField === 'sku'" id="product-sku-error" role="alert" class="mt-2 text-xs text-red-600">{{ fieldErrors.sku ? $t('productEditor.field.sku') : saveError }}</p>
        </div>

        <DashboardProductsSellingModeFields v-model="sellingConfig" />
        <DashboardProductsWarrantyFields v-model="warrantyConfig" :disabled="formLoading || saving || saveUnconfirmed || !hasPermission('products.add')" />

        <DashboardProductsVariantsEditor
          v-model="variants"
          :disabled="formLoading || saving || saveUnconfirmed || !hasPermission('products.add')"
          class="md:col-span-2"
        />

        <div class="md:col-span-2">
          <DashboardMediaUploadField
            v-model="imageUrl"
            @busy="mainUploads.image = $event"
            :disabled="formLoading || saving || saveUnconfirmed || !hasPermission('products.add')"
            :label="$t('common.mainImage')"
            section="products"
            :preview-alt="title || 'Product image'"
            :help-text="$t('common.uploadTheMainProductImageStoredOnTheServerHost')"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.shortDescription') }}</label>
          <textarea
            v-model="description"
            rows="4"
            :placeholder="$t('common.shortProductDescription')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.longDescription') }}</label>
          <textarea
            v-model="longDescription"
            rows="7"
            :placeholder="$t('common.longProductDescription')"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <p v-if="fieldErrors.variants" role="alert" class="md:col-span-2 text-sm text-red-600">{{ $t('productEditor.field.variants') }}</p>
        </fieldset>
        <p v-if="Object.values(lookupFailures).some(Boolean)" role="alert" class="md:col-span-2 text-sm text-red-600">{{ $t('productEditor.lookupFailed') }}</p>
        <p v-if="actionError || saveError" role="alert" class="md:col-span-2 text-sm text-red-600">
          {{ actionError ? $uiMessage(actionError) : saveError }}
        </p>

        <p class="md:col-span-2 text-sm text-gray-500" role="status" data-product-save-state>
          {{ $t('productEditor.details') }}: {{ saving ? $t('common.saving') : actionError || saveError ? $t('productEditor.failed') : mainDirty ? $t('productEditor.unsaved') : mainSaved ? $t('productEditor.saved') : $t('productEditor.ready') }}.
          {{ $t('productEditor.separate') }}
        </p>
        <p v-if="restoredDraft" class="md:col-span-2 text-xs text-gray-500">{{ $t('productEditor.retained') }}</p>
        <div class="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            :disabled="mainUploadsActive || saving || saveConflict || formLoading || !hasPermission('products.add')"
            class="disabled:cursor-not-allowed disabled:opacity-50 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            {{ saving ? $t('common.saving') : saveUnconfirmed ? $t('productSave.retry') : $t('productEditor.createDraft') }}
          </button>
          <button v-if="saveUnconfirmed || saveConflict" type="button" :disabled="saving || mainUploadsActive"
            @click="checkProductSave" class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium">
            {{ $t('productSave.checkSave') }}
          </button>

          <NuxtLinkLocale
            to="/dashboard/products"
            class="rounded-lg bg-gray-200 px-5 py-3 font-bold text-gray-800 hover:bg-gray-300"
          >
            {{ $t('common.back') }}
          </NuxtLinkLocale>
        </div>
        <DashboardSeoFields @busy="mainUploads.seo = $event" :disabled="formLoading || saving || saveUnconfirmed || !hasPermission('products.add')" v-model="seo" :fallback-title="title" :fallback-description="description || longDescription" :fallback-image="imageUrl" section="products" class="md:col-span-2" />
      </form>
    </div>
  </div>
</template>

<script setup>
const { uiNavigateTo } = useUiNavigation()

import { productEditorErrors } from '~/utils/productEditor'
import { defaultSellingConfig, serializeSellingConfig } from '~/utils/preorder'
import { defaultWarrantyConfig } from '~/utils/warranty'
definePageMeta({
  layout: 'dashboard',
  key: route => route.path
})

const { t } = useI18n()
const { data: erpState } = useNuxtData('active-erp')
const externalErp = computed(() => erpState.value?.mode === 'daftra')
const supabase = useSupabaseClient()
const { hasPermission } = useAdminAccess()
const {
  getSnapshot,
  invalidate,
  setSnapshot
} = useDashboardCache()
const PRODUCT_FORM_CATEGORIES_CACHE_KEY = 'dashboard:product-form:categories'
const PRODUCT_FORM_BRANDS_CACHE_KEY = 'dashboard:product-form:brands'
const PRODUCT_FORM_SUPPLIERS_CACHE_KEY = 'dashboard:product-form:suppliers'
const PRODUCT_FORM_WAREHOUSES_CACHE_KEY = 'dashboard:product-form:warehouses'

const seo = ref({ seo_title: '', seo_description: '', seo_image_url: '' })
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
const variants = ref([{
  id: null,
  name: 'Default',
  code: 'DEFAULT',
  sku: '',
  color_name: '',
  color_hex: ''
}])
const isPublished = ref(false)
const sellingConfig = ref(defaultSellingConfig())
const warrantyConfig = ref(defaultWarrantyConfig())

const categories = ref([])
const brands = ref([])
const suppliers = ref([])
const warehouses = ref([])
const mainUploads = reactive({ image: false, seo: false })
const mainUploadsActive = computed(() => Object.values(mainUploads).some(Boolean))
const lookupFailures = reactive({ categories: false, brands: false, suppliers: false, warehouses: false })

const { saving, error: saveError, errorField: saveField, conflict: saveConflict, unconfirmed: saveUnconfirmed,
  submit: submitProduct, recover: recoverProductSave, resetConflict: resetSaveConflict } = useProductSave('/api/admin-products', 'POST')
const formLoading = ref(true)
const actionError = ref('')

const validationAttempted = ref(false)
const mainSaved = ref(false)
const restoredDraft = ref(false)

const editorBusy = computed(() => mainUploadsActive.value || saving.value)
const { dirty: mainDirty, markSaved: markMainSaved, restore: restoreDraft, visitPrerequisite } = useProductEditor('add', { seo, title, slug, description, longDescription, price, oldPrice, imageUrl, categoryId, brandId, defaultSupplierId, primaryWarehouseId, sku, sellingConfig, warrantyConfig, isPublished, variants }, { busy: editorBusy, extraDirty: saveUnconfirmed })
const fieldErrors = computed(() => validationAttempted.value ? productEditorErrors({
  title: title.value, slug: slug.value.trim() || makeSlug(title.value), price: price.value,
  old_price: oldPrice.value, sku: sku.value, primary_warehouse_id: primaryWarehouseId.value,
  is_serialized: true, variants: variants.value, stock_quantity: 0
}) : {})
const openPrerequisite = to => visitPrerequisite(() => uiNavigateTo(to))

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

  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  if (error) {
    lookupFailures.categories = true
    return
  }

  lookupFailures.categories = false
  categories.value = data || []
  setSnapshot(PRODUCT_FORM_CATEGORIES_CACHE_KEY, categories.value)
}

const getBrandsList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_BRANDS_CACHE_KEY)

  if (cachedSnapshot) {
    brands.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .order('name')

  if (error) {
    lookupFailures.brands = true
    return
  }

  lookupFailures.brands = false
  brands.value = data || []
  setSnapshot(PRODUCT_FORM_BRANDS_CACHE_KEY, brands.value)
}

const getSuppliersList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_SUPPLIERS_CACHE_KEY)

  if (cachedSnapshot) {
    suppliers.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('commerce_crm_accounts')
    .select('id, name')
    .eq('account_type', 'supplier')
    .eq('is_active', true)
    .order('name')

  if (error) {
    lookupFailures.suppliers = true
    return
  }

  lookupFailures.suppliers = false
  suppliers.value = data || []
  setSnapshot(PRODUCT_FORM_SUPPLIERS_CACHE_KEY, suppliers.value)
}

const getWarehousesList = async () => {
  const cachedSnapshot = getSnapshot(PRODUCT_FORM_WAREHOUSES_CACHE_KEY)

  if (cachedSnapshot) {
    warehouses.value = cachedSnapshot
  }

  const { data, error } = await supabase
    .from('commerce_warehouses')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    lookupFailures.warehouses = true
    return
  }

  lookupFailures.warehouses = false
  warehouses.value = data || []
  setSnapshot(PRODUCT_FORM_WAREHOUSES_CACHE_KEY, warehouses.value)
}

const addProduct = async () => {
  if (mainUploadsActive.value || saving.value || saveConflict.value || formLoading.value) return
  actionError.value = ''

  const normalizedSlug = slug.value.trim() || makeSlug(title.value)

  validationAttempted.value = true
  if (!saveUnconfirmed.value && Object.keys(fieldErrors.value).length) return

  const data = await submitProduct({
    title: title.value,
    slug: normalizedSlug,
    description: description.value,
    long_description: longDescription.value,
    price: price.value,
    old_price: oldPrice.value,
    image_url: imageUrl.value,
    ...seo.value,
    category_id: categoryId.value,
    brand_id: brandId.value,
    default_supplier_id: defaultSupplierId.value,
    primary_warehouse_id: primaryWarehouseId.value,
    sku: sku.value,
    stock_quantity: 0,
    color_name: '',
    color_hex: '',
    is_serialized: true,
    variants: variants.value,
    ...serializeSellingConfig(sellingConfig.value),
    ...warrantyConfig.value,
    is_published: isPublished.value
  })
  if (!data) return

  markMainSaved(); mainSaved.value = true
  invalidate('dashboard:products:')
  invalidate('dashboard:home')
  await uiNavigateTo(hasPermission('products.edit') ? `/dashboard/products/edit/${data.id}` : '/dashboard/products')
}

const checkProductSave = async () => {
  if (mainUploadsActive.value) return
  const result = await recoverProductSave()
  if (result) { markMainSaved(); await uiNavigateTo(hasPermission('products.edit') ? `/dashboard/products/edit/${result.id}` : '/dashboard/products') }
}

onMounted(async () => {
  restoredDraft.value = restoreDraft()
  await Promise.all([
    getCategoriesList(),
    getBrandsList(),
    getSuppliersList(),
    getWarehousesList()
  ])
  await checkProductSave()
  formLoading.value = false
})
</script>
