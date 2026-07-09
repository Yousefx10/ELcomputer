<template>
  <div class="p-6">
    <h2 class="my-5 text-center text-4xl font-bold">
      Brands
    </h2>

    <section class="mb-6">
      <SideBarMobile :links="links" />
    </section>

    <div class="mx-auto max-w-4xl">
      <form
        @submit.prevent="saveBrand"
        class="mb-8 space-y-3 rounded-2xl bg-white p-5 shadow"
      >
        <input
          v-model="name"
          type="text"
          placeholder="Brand name"
          class="w-full rounded-lg border p-3"
        />

        <input
          v-model="logoUrl"
          type="text"
          placeholder="Logo URL"
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
            class="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white"
          >
            {{ loading ? 'Saving...' : editingId ? 'Update Brand' : 'Add Brand' }}
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
        <h3 class="mb-4 text-2xl font-bold">All Brands</h3>

        <p v-if="!brands.length" class="text-gray-500">
          No brands found yet.
        </p>

        <div v-else class="space-y-3">
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
                @click="startEdit(brand)"
                class="rounded-lg bg-black px-3 py-2 text-sm text-white"
              >
                Edit
              </button>

              <button
                @click="deleteBrand(brand.id)"
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

const brands = ref([])
const name = ref('')
const logoUrl = ref('')
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
  logoUrl.value = ''
  editingId.value = null
  errorMessage.value = ''
}

const getBrandsList = async () => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name')

  if (error) {
    errorMessage.value = error.message
    return
  }

  brands.value = data || []
}

const saveBrand = async () => {
  errorMessage.value = ''

  if (!name.value.trim()) {
    errorMessage.value = 'Brand name is required'
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

  loading.value = false

  if (response.error) {
    errorMessage.value = response.error.message
    return
  }

  resetForm()
  await getBrandsList()
}

const startEdit = (brand) => {
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

await getBrandsList()
</script>
