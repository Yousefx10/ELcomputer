<template>
  <div class="">
    <div class="mx-auto max-w-4xl">
      <div class="mb-6 rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Brands</h2>
        <p class="mt-2 text-sm text-gray-500">
          Display, add, edit, and delete product brands
        </p>
      </div>

      <form
        v-if="canAddBrand || canEditBrand"
        @submit.prevent="saveBrand"
        class="mb-8 space-y-3 rounded-2xl bg-white p-5 shadow"
      >
        <input
          v-model="name"
          type="text"
          placeholder="Brand name"
          :disabled="editingId ? !canEditBrand : !canAddBrand"
          class="w-full rounded-lg border p-3"
        />

        <input
          v-model="logoUrl"
          type="text"
          placeholder="Logo URL"
          :disabled="editingId ? !canEditBrand : !canAddBrand"
          class="w-full rounded-lg border p-3"
        />

        <p class="text-sm text-gray-500">
          Slug preview: {{ slugPreview || '-' }}
        </p>

        <div
          v-if="logoUrl"
          class="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border bg-gray-50 p-2"
        >
          <img
            :src="logoUrl"
            :alt="name || 'Brand logo'"
            class="h-full w-full object-contain"
          />
        </div>

        <p v-if="errorMessage" class="text-red-600">
          {{ errorMessage }}
        </p>

        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="saving || (editingId ? !canEditBrand : !canAddBrand)"
            class="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white"
          >
            {{ saving ? 'Saving...' : editingId ? 'Update Brand' : 'Add Brand' }}
          </button>

          <button
            v-if="editingId"
            type="button"
            @click="cancelEdit"
            class="rounded-lg bg-gray-200 px-4 py-3 font-bold"
          >
            Cancel
          </button>
        </div>
      </form>

      <div
        v-else
        class="mb-8 rounded-2xl bg-white p-5 text-sm text-gray-500 shadow"
      >
        You can view brands, but this account cannot add or edit them.
      </div>

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-2xl font-bold">All Brands</h3>

          <p class="text-sm text-gray-500">
            {{ totalBrands }} {{ hasActiveSearch ? 'matching' : 'total' }}
          </p>
        </div>

        <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex-1">
            <label for="brand-search" class="mb-2 block text-sm font-semibold text-gray-700">
              Search Brands
            </label>
            <input
              id="brand-search"
              v-model="searchQuery"
              type="text"
              placeholder="Search by brand name"
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

        <p v-if="loading" class="text-gray-500">
          Loading brands...
        </p>

        <p v-else-if="!brands.length" class="text-gray-500">
          {{ hasActiveSearch ? 'No matching brands found.' : 'No brands found yet.' }}
        </p>

        <div v-else>
          <div class="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <p class="text-sm text-gray-500">
              Showing {{ pageStart }}-{{ pageEnd }} of {{ totalBrands }} {{ hasActiveSearch ? 'matching brands' : 'brands' }}
            </p>

            <p class="text-sm font-medium text-gray-600">
              Page {{ currentPage }} of {{ totalPages }}
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="brand in brands"
              :key="brand.id"
              class="flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div class="flex items-center gap-4">
                <div class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-2">
                  <img
                    v-if="brand.logo_url"
                    :src="brand.logo_url"
                    :alt="brand.name"
                    class="h-full w-full object-contain"
                  />

                  <span v-else class="text-xs text-gray-400">No logo</span>
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
                  Edit
                </button>

                <button
                  v-if="canEditBrand"
                  @click="deleteBrand(brand.id)"
                  class="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                >
                  Delete
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

const brands = ref([])
const name = ref('')
const logoUrl = ref('')
const saving = ref(false)
const loading = ref(false)
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

const makeSlug = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const slugPreview = computed(() => makeSlug(name.value))

const resetForm = () => {
  name.value = ''
  logoUrl.value = ''
  editingId.value = null
  errorMessage.value = ''
}

const getBrandsList = async (page = currentPage.value) => {
  loading.value = true
  errorMessage.value = ''
  currentPage.value = page

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
    await getBrandsList(totalPages.value)
    return
  }

  brands.value = data || []
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

  const slug = makeSlug(name.value)

  if (!slug) {
    errorMessage.value = 'Slug could not be generated'
    return
  }

  saving.value = true

  let response

  if (editingId.value) {
    response = await supabase
      .from('brands')
      .update({
        name: name.value.trim(),
        slug,
        logo_url: logoUrl.value.trim() || null
      })
      .eq('id', editingId.value)
  } else {
    response = await supabase
      .from('brands')
      .insert({
        name: name.value.trim(),
        slug,
        logo_url: logoUrl.value.trim() || null
      })
  }

  saving.value = false

  if (response.error) {
    errorMessage.value = response.error.message
    return
  }

  resetForm()
  await getBrandsList()
}

const startEdit = (brand) => {
  if (!canEditBrand.value) {
    return
  }

  name.value = brand.name
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

  const confirmDelete = confirm('Are you sure you want to delete this brand?')
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

  if (editingId.value === id) {
    resetForm()
  }

  await getBrandsList()
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

await getBrandsList()
</script>
