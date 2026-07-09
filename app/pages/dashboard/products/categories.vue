<template>
  <div class="p-6">
    <h2 class="my-5 text-center text-4xl font-bold">
      Categories
    </h2>

    <section class="mb-6">
      <SideBarMobile :links="links" />
    </section>

    <div class="mx-auto max-w-4xl">
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
            class="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white"
          >
            {{ loading ? 'Saving...' : editingId ? 'Update Category' : 'Add Category' }}
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
        <h3 class="mb-4 text-2xl font-bold">All Categories</h3>

        <p v-if="!categories.length" class="text-gray-500">
          No categories found yet.
        </p>

        <div v-else class="space-y-3">
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

const categories = ref([])
const name = ref('')
const loading = ref(false)
const errorMessage = ref('')
const editingId = ref(null)

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

const getCategoriesList = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  if (error) {
    errorMessage.value = error.message
    return
  }

  categories.value = data
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

  loading.value = true

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

  loading.value = false

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

await getCategoriesList()
</script>