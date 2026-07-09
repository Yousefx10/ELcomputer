<template>
  <div class="min-h-screen bg-gray-100 p-6">
    <div class="mx-auto max-w-4xl">
      <div class="mb-6 rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Categories</h2>
        <p class="mt-2 text-sm text-gray-500">
          Display, add, edit, and delete product categories
        </p>
      </div>

      <form
        @submit.prevent="saveCategory"
        class="mb-8 space-y-3 rounded-2xl bg-white p-5 shadow"
      >
        <input
          v-model="name"
          type="text"
          placeholder="Category name"
          class="w-full rounded-lg border p-3"
        />

        <p class="text-sm text-gray-500">
          Slug preview: {{ slugPreview || '-' }}
        </p>

        <p v-if="errorMessage" class="text-red-600">
          {{ errorMessage }}
        </p>

        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white"
          >
            {{ saving ? 'Saving...' : editingId ? 'Update Category' : 'Add Category' }}
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

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-2xl font-bold">All Categories</h3>

          <p class="text-sm text-gray-500">
            {{ totalCategories }} {{ hasActiveSearch ? 'matching' : 'total' }}
          </p>
        </div>

        <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex-1">
            <label for="category-search" class="mb-2 block text-sm font-semibold text-gray-700">
              Search Categories
            </label>
            <input
              id="category-search"
              v-model="searchQuery"
              type="text"
              placeholder="Search by category name"
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
          Loading categories...
        </p>

        <p v-else-if="!categories.length" class="text-gray-500">
          {{ hasActiveSearch ? 'No matching categories found.' : 'No categories found yet.' }}
        </p>

        <div v-else>
          <div class="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <p class="text-sm text-gray-500">
              Showing {{ pageStart }}-{{ pageEnd }} of {{ totalCategories }} {{ hasActiveSearch ? 'matching categories' : 'categories' }}
            </p>

            <p class="text-sm font-medium text-gray-600">
              Page {{ currentPage }} of {{ totalPages }}
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="category in categories"
              :key="category.id"
              class="flex items-center justify-between rounded-xl border p-4"
            >
              <div>
                <p class="font-bold">{{ category.name }}</p>
                <p class="text-sm text-gray-500">{{ category.slug }}</p>
              </div>

              <div class="flex gap-2">
                <button
                  @click="startEdit(category)"
                  class="rounded-lg bg-black px-3 py-2 text-sm text-white"
                >
                  Edit
                </button>

                <button
                  @click="deleteCategory(category.id)"
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

const categories = ref([])
const name = ref('')
const saving = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const editingId = ref(null)
const currentPage = ref(1)
const pageSize = 10
const totalCategories = ref(0)
const searchQuery = ref('')
let searchTimeoutId = null

const trimmedSearchQuery = computed(() => searchQuery.value.trim())
const hasActiveSearch = computed(() => Boolean(trimmedSearchQuery.value))

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalCategories.value / pageSize))
})

const pageStart = computed(() => {
  if (!totalCategories.value) {
    return 0
  }

  return (currentPage.value - 1) * pageSize + 1
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * pageSize, totalCategories.value)
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
  editingId.value = null
  errorMessage.value = ''
}

const getCategoriesList = async (page = currentPage.value) => {
  loading.value = true
  errorMessage.value = ''
  currentPage.value = page

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('categories')
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

  totalCategories.value = count || 0

  if (currentPage.value > totalPages.value) {
    loading.value = false
    await getCategoriesList(totalPages.value)
    return
  }

  categories.value = data || []
  loading.value = false
}

const saveCategory = async () => {
  errorMessage.value = ''

  if (!name.value.trim()) {
    errorMessage.value = 'Category name is required'
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
      .from('categories')
      .update({
        name: name.value.trim(),
        slug
      })
      .eq('id', editingId.value)
  } else {
    response = await supabase
      .from('categories')
      .insert({
        name: name.value.trim(),
        slug
      })
  }

  saving.value = false

  if (response.error) {
    errorMessage.value = response.error.message
    return
  }

  resetForm()
  await getCategoriesList()
}

const startEdit = (category) => {
  name.value = category.name
  editingId.value = category.id
  errorMessage.value = ''
}

const cancelEdit = () => {
  resetForm()
}

const deleteCategory = async (id) => {
  errorMessage.value = ''

  const confirmDelete = confirm('Are you sure you want to delete this category?')
  if (!confirmDelete) return

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) {
    errorMessage.value =
      error.code === '23503'
        ? 'This category is connected to products. Move or delete those products first.'
        : error.message
    return
  }

  if (editingId.value === id) {
    resetForm()
  }

  await getCategoriesList()
}

const goToPreviousPage = async () => {
  if (currentPage.value === 1) {
    return
  }

  await getCategoriesList(currentPage.value - 1)
}

const goToNextPage = async () => {
  if (currentPage.value === totalPages.value) {
    return
  }

  await getCategoriesList(currentPage.value + 1)
}

const clearSearch = () => {
  searchQuery.value = ''
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    getCategoriesList(1)
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

await getCategoriesList()
</script>
