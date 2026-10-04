<template>
  <div class="">
    <div class="">
      <DashboardPageIntro
        :title="$t('common.brands')"
        :description="$t('interface.viewAddEditAndRemoveProductBrands')"
        container-class="mb-6 rounded-2xl bg-gray-200 p-6 shadow"
      />

      <form
        v-if="canAddBrand || canEditBrand"
        @submit.prevent="saveBrand"
        class="mb-8 space-y-3 rounded-2xl bg-white p-5 shadow"
      >
        <label for="brand-name" class="block text-sm font-semibold">{{ $t('common.brandName') }}</label>
        <input
          id="brand-name"
          v-model="name"
          required
          maxlength="200"
          type="text"
          :placeholder="$t('common.brandName')"
          :disabled="editingId ? !canEditBrand : !canAddBrand"
          class="w-full rounded-lg border p-3"
        />

        <DashboardMediaUploadField
          v-model="logoUrl"
          :label="$t('common.brandLogo')"
          section="brands"
          :disabled="editingId ? !canEditBrand : !canAddBrand"
          :preview-alt="name || 'Brand logo'"
          preview-height-class="h-28"
          :help-text="$t('dashboard.catalog.uploadTheLogoShownOnProductPagesAndFeaturedBrands')"
        />

        <p class="text-sm text-gray-500">
          {{ $t('common.slugPreviewValue', { value0: (slugPreview || '-') }) }}
        </p>

        <p class="text-sm text-gray-500">{{ $t('brandPages.slugHelp') }}</p>
        <NuxtLinkLocale v-if="editingId" :to="`/brand/${existingSlug}`" target="_blank" class="inline-flex min-h-11 items-center text-sm font-semibold underline">{{ $t('brandPages.viewPage') }}</NuxtLinkLocale>
        <DashboardCatalogBrandPageEditor v-model="brandPage" :disabled="saving || (editingId ? !canEditBrand : !canAddBrand)" />

        <DashboardSeoFields v-model="seo" catalog :fallback-title="name" :fallback-description="brandPage.story.content || brandPage.hero.text" :fallback-image="brandPage.hero.image || logoUrl" section="brands" :disabled="editingId ? !canEditBrand : !canAddBrand" />

        <p v-if="errorMessage" class="text-red-600">
          {{ $uiMessage(errorMessage) }}
        </p>

        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="saving || (editingId ? !canEditBrand : !canAddBrand)"
            class="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white"
          >
            {{ saving ? $t('common.saving') : editingId ? $t('common.updateBrand') : $t('common.addBrand') }}
          </button>

          <button
            v-if="editingId"
            type="button"
            @click="cancelEdit"
            class="rounded-lg bg-gray-200 px-4 py-3 font-bold"
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </form>

      <div
        v-else
        class="mb-8 rounded-2xl bg-white p-5 text-sm text-gray-500 shadow"
      >
        {{ $t('dashboard.catalog.youCanViewBrandsButThisAccountCannotAddOrEditThem') }}
      </div>

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-2xl font-bold">{{ $t('common.allBrands') }}</h3>

          <p class="text-sm text-gray-500">
            {{ totalBrands }} {{ hasActiveSearch ? $t('common.matching') : $t('common.total') }}
          </p>
        </div>

        <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex-1">
            <label for="brand-search" class="mb-2 block text-sm font-semibold text-gray-700">
              {{ $t('common.searchBrands') }}
            </label>
            <input
              id="brand-search"
              v-model="searchQuery"
              type="text"
              :placeholder="$t('common.searchByBrandName')"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <button
            v-if="searchQuery"
            type="button"
            @click="clearSearch"
            class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
          >
            {{ $t('common.clear') }}
          </button>
        </div>

        <p v-if="loading" class="text-gray-500">
          {{ $t('common.loadingBrands') }}
        </p>

        <p v-else-if="!brands.length" class="text-gray-500">
          {{ hasActiveSearch ? $t('dashboard.catalog.noMatchingBrandsFound') : $t('common.noBrandsFoundYet') }}
        </p>

        <div v-else>
          <div class="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <p class="text-sm text-gray-500">
              {{ $t('common.showingValueValueOfValueValue', { value0: (pageStart), value1: (pageEnd), value2: (totalBrands), value3: (hasActiveSearch ? $t('common.matchingBrands') : $t('common.brands')) }) }}
            </p>

            <p class="text-sm font-medium text-gray-600">
              {{ $t('common.pageValueOfValue', { value0: (currentPage), value1: (totalPages) }) }}
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="brand in brands"
              :key="brand.id"
              class="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div class="flex items-center gap-4">
                <div class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-2">
                  <img
                    v-if="brand.logo_url"
                    :src="brand.logo_url"
                    :alt="brand.name"
                    class="h-full w-full object-contain"
                  />

                  <span v-else class="text-xs text-gray-400">{{ $t('common.noLogo') }}</span>
                </div>

                <div>
                  <p class="font-bold">{{ brand.name }}</p>
                  <p class="text-sm text-gray-500">{{ brand.slug }}</p>
                </div>
              </div>

              <div class="flex gap-2">
                <button
                  v-if="canEditBrand"
                  @click="startEdit(brand)"
                  class="rounded-lg bg-black px-3 py-2 text-sm text-white"
                >
                  {{ $t('common.edit') }}
                </button>

                <button
                  v-if="canEditBrand"
                  @click="deleteBrand(brand.id)"
                  class="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                >
                  {{ $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between rounded-xl border px-4 py-3">
            <button
              type="button"
              :disabled="currentPage === 1 || loading"
              @click="goToPreviousPage"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ $t('common.previous') }}
            </button>

            <p class="text-sm text-gray-500">
              {{ $t('common.pageValueOfValue', { value0: (currentPage), value1: (totalPages) }) }}
            </p>

            <button
              type="button"
              :disabled="currentPage === totalPages || loading"
              @click="goToNextPage"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ $t('common.next') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { brandSlug, normalizeBrandPage } from '~/utils/brandPage'
const { uiLabel } = useUiLocale()

const supabase = useSupabaseClient()
const {
  getSnapshot,
  invalidate,
  isFresh,
  setSnapshot
} = useDashboardCache()
const {
  hasPermission
} = useAdminAccess()
const { recordAdminLog, getAdminAuthHeaders } = useAdminLogs()
const buildBrandsCacheKey = (page = currentPage.value) => {
  return `dashboard:brands:list:${page}:${trimmedSearchQuery.value.toLowerCase()}`
}

const brands = ref([])
const seo = ref({ seo_title: '', seo_description: '', seo_image_url: '' })
const name = ref('')
const logoUrl = ref('')
const existingSlug = ref('')
const brandPage = ref(normalizeBrandPage())
const saving = ref(false)
const loading = ref(true)
const errorMessage = ref('')
const editingId = ref(null)
const currentPage = ref(1)
const pageSize = 10
const totalBrands = ref(0)
const searchQuery = ref('')
let searchTimeoutId = null

const trimmedSearchQuery = computed(() => searchQuery.value.trim())
const hasActiveSearch = computed(() => Boolean(trimmedSearchQuery.value))
const canAddBrand = computed(() => hasPermission('brands.add'))
const canEditBrand = computed(() => hasPermission('brands.edit'))

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalBrands.value / pageSize))
})

const pageStart = computed(() => {
  if (!totalBrands.value) {
    return 0
  }

  return (currentPage.value - 1) * pageSize + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize, totalBrands.value)
})

const slugPreview = computed(() => brandSlug(name.value, existingSlug.value))

const resetForm = () => {
  name.value = ''
  seo.value = { seo_title: '', seo_description: '', seo_image_url: '' }
  logoUrl.value = ''
  existingSlug.value = ''
  brandPage.value = normalizeBrandPage()
  editingId.value = null
  errorMessage.value = ''
}

const applyBrandsSnapshot = (snapshot) => {
  currentPage.value = snapshot?.page || 1
  totalBrands.value = snapshot?.totalBrands || 0
  brands.value = snapshot?.items || []
}

const getBrandsList = async (page = currentPage.value, { force = false } = {}) => {
  currentPage.value = page
  const cacheKey = buildBrandsCacheKey(page)
  const cachedSnapshot = getSnapshot(cacheKey)

  if (cachedSnapshot) {
    applyBrandsSnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(cacheKey)) {
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('brands')
    .select('*', { count: 'exact' })

  if (trimmedSearchQuery.value) {
    query = query.ilike('name', `%${trimmedSearchQuery.value}%`)
  }

  const { data, error, count } = await query
    .order('name')
    .range(from, to)

  if (error) {
    loading.value = false
    errorMessage.value = error.message
    return
  }

  totalBrands.value = count || 0

  if (currentPage.value > totalPages.value) {
    loading.value = false
    await getBrandsList(totalPages.value, { force })
    return
  }

  const snapshot = {
    page,
    totalBrands: count || 0,
    items: data || []
  }

  applyBrandsSnapshot(snapshot)
  setSnapshot(cacheKey, snapshot)
  loading.value = false
}

const saveBrand = async () => {
  errorMessage.value = ''

  if (editingId.value && !canEditBrand.value) {
    errorMessage.value = 'You do not have permission to edit brands.'
    return
  }

  if (!editingId.value && !canAddBrand.value) {
    errorMessage.value = 'You do not have permission to add brands.'
    return
  }

  if (!name.value.trim()) {
    errorMessage.value = 'Brand name is required'
    return
  }

  const slug = brandSlug(name.value, existingSlug.value)

  if (!slug) {
    errorMessage.value = 'Slug could not be generated'
    return
  }

  saving.value = true

  try {
    await $fetch(editingId.value ? `/api/admin-brands/${editingId.value}` : '/api/admin-brands', {
      method: editingId.value ? 'PATCH' : 'POST',
      headers: await getAdminAuthHeaders(),
      body: { ...seo.value, name: name.value.trim(), logo_url: logoUrl.value.trim() || null, brand_page: brandPage.value }
    })
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || 'Could not save the brand.'
    return
  } finally {
    saving.value = false
  }

  resetForm()
  invalidate('dashboard:brands:')
  invalidate('dashboard:product-form:brands')
  await getBrandsList(currentPage.value, { force: true })
}

const startEdit = (brand) => {
  if (!canEditBrand.value) {
    return
  }

  name.value = brand.name
  existingSlug.value = brand.slug
  brandPage.value = normalizeBrandPage(brand.brand_page)
  seo.value = { seo_title: brand.seo_title || '', seo_description: brand.seo_description || '', seo_image_url: brand.seo_image_url || '' }
  logoUrl.value = brand.logo_url || ''
  editingId.value = brand.id
  errorMessage.value = ''
}

const cancelEdit = () => {
  resetForm()
}

const deleteBrand = async (id) => {
  errorMessage.value = ''

  if (!canEditBrand.value) {
    errorMessage.value = 'You do not have permission to delete brands.'
    return
  }

  const confirmDelete = confirm(uiLabel('Are you sure you want to delete this brand?'))
  if (!confirmDelete) {
    return
  }

  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', id)

  if (error) {
    errorMessage.value = error.message
    return
  }

  const deletedBrand = brands.value.find((brand) => brand.id === id)
  await recordAdminLog({
    actionKey: 'brands.delete',
    description: `Deleted brand ${deletedBrand?.name || id}.`,
    metadata: {
      brand_id: id,
      brand_name: deletedBrand?.name || ''
    }
  })

  if (editingId.value === id) {
    resetForm()
  }

  invalidate('dashboard:brands:')
  invalidate('dashboard:product-form:brands')
  await getBrandsList(currentPage.value, { force: true })
}

const goToPreviousPage = async () => {
  if (currentPage.value === 1) {
    return
  }

  await getBrandsList(currentPage.value - 1)
}

const goToNextPage = async () => {
  if (currentPage.value === totalPages.value) {
    return
  }

  await getBrandsList(currentPage.value + 1)
}

const clearSearch = () => {
  searchQuery.value = ''
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    getBrandsList(1)
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

onMounted(async () => {
  await getBrandsList()
})
</script>
