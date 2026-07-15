<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Shipping Companies</h3>
          <p class="mt-1 text-sm text-gray-500">
            Define the companies used for online order delivery and keep their internal and customer-facing pricing.
          </p>
        </div>

        <div class="rounded-2xl bg-gray-100 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Companies</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">{{ companies.length }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-left"
        @click="isFormOpen = !isFormOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">
            {{ editingId ? 'Edit Shipping Company' : 'Add Shipping Company' }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            Store your actual shipping cost, return cost, and what the client pays.
          </p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isFormOpen ? 'Collapse' : 'Expand' }}</span>
          <Icon
            name="lucide:chevron-down"
            size="18"
            class="transition-transform"
            :class="isFormOpen ? 'rotate-180' : ''"
          />
        </div>
      </button>

      <div v-if="isFormOpen" class="mt-6">
        <div class="flex justify-end">
          <button
            v-if="editingId"
            type="button"
            class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
            @click="resetForm"
          >
            Cancel Edit
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Company Name</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Shipping company name"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Code</label>
          <input
            v-model="form.code"
            type="text"
            placeholder="Optional code"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Shipping Cost</label>
          <input
            v-model="form.shipping_cost"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Return Cost</label>
          <input
            v-model="form.return_cost"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Shipping Price For Client</label>
          <input
            v-model="form.client_shipping_price"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            v-model="form.notes"
            rows="3"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="Optional notes"
          />
        </div>
        </div>

        <label class="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <input v-model="form.is_active" type="checkbox">
          Active
        </label>

        <p v-if="formError" class="mt-4 text-sm text-red-600">
          {{ formError }}
        </p>

        <div class="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="saving"
            class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            @click="saveCompany"
          >
            {{ saving ? 'Saving...' : editingId ? 'Save Company' : 'Add Company' }}
          </button>

          <button
            v-if="editingId"
            type="button"
            :disabled="deleting"
            class="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            @click="deleteCompany"
          >
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Company List</h3>
          <p class="mt-1 text-sm text-gray-500">
            Review the active and inactive carriers used in the platform.
          </p>
        </div>

        <div class="w-full md:max-w-md">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Search</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>
      </div>

      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ pageError }}
      </p>

      <p v-else-if="loading" class="mt-5 text-sm text-gray-500">
        Loading shipping companies...
      </p>

      <p v-else-if="!companies.length" class="mt-5 text-sm text-gray-500">
        No shipping companies found yet.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="company in companies"
          :key="company.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-gray-900">{{ company.name }}</p>

                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="company.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                >
                  {{ company.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>

              <p class="text-sm text-gray-600">
                Shipping {{ formatCommerceCurrency(company.shipping_cost) }}
                · Return {{ formatCommerceCurrency(company.return_cost) }}
              </p>

              <p class="text-sm text-gray-500">
                Client pays {{ formatCommerceCurrency(company.client_shipping_price) }}
              </p>

              <p class="text-xs text-gray-400">
                {{ formatCommerceDate(company.updated_at || company.created_at) }}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                @click="startEdit(company)"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { formatCommerceCurrency, formatCommerceDate } from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()

const companies = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const pageError = ref('')
const formError = ref('')
const searchQuery = ref('')
const editingId = ref('')
const isFormOpen = ref(false)
let searchTimeoutId = null

const createEmptyForm = () => ({
  name: '',
  code: '',
  shipping_cost: '',
  return_cost: '',
  client_shipping_price: '',
  notes: '',
  is_active: true
})

const form = reactive(createEmptyForm())

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703'
}

const resetForm = () => {
  editingId.value = ''
  Object.assign(form, createEmptyForm())
  formError.value = ''
}

const loadCompanies = async () => {
  loading.value = true
  pageError.value = ''

  try {
    let query = supabase
      .from('commerce_shipping_companies')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    const searchValue = String(searchQuery.value || '').trim()
    if (searchValue) {
      query = query.ilike('name', `%${searchValue}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    companies.value = data || []
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load shipping companies.'
  } finally {
    loading.value = false
  }
}

const mapPayload = () => ({
  name: String(form.name || '').trim(),
  code: String(form.code || '').trim() || null,
  shipping_cost: Number(form.shipping_cost || 0),
  return_cost: Number(form.return_cost || 0),
  client_shipping_price: Number(form.client_shipping_price || 0),
  notes: String(form.notes || '').trim() || null,
  is_active: Boolean(form.is_active),
  updated_at: new Date().toISOString()
})

const startEdit = (company) => {
  isFormOpen.value = true
  editingId.value = company.id
  Object.assign(form, {
    name: company.name || '',
    code: company.code || '',
    shipping_cost: String(Number(company.shipping_cost || 0)),
    return_cost: String(Number(company.return_cost || 0)),
    client_shipping_price: String(Number(company.client_shipping_price || 0)),
    notes: company.notes || '',
    is_active: company.is_active ?? true
  })
  formError.value = ''
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

const saveCompany = async () => {
  formError.value = ''
  const payload = mapPayload()

  if (!payload.name) {
    formError.value = 'Company name is required.'
    return
  }

  saving.value = true

  try {
    if (editingId.value) {
      const { error } = await supabase
        .from('commerce_shipping_companies')
        .update(payload)
        .eq('id', editingId.value)

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.shipping.update',
        description: `Updated shipping company ${payload.name}.`,
        metadata: {
          shipping_company_id: editingId.value
        }
      })
    } else {
      const { data, error } = await supabase
        .from('commerce_shipping_companies')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.shipping.create',
        description: `Added shipping company ${payload.name}.`,
        metadata: {
          shipping_company_id: data?.id || null
        }
      })
    }

    resetForm()
    await loadCompanies()
  } catch (error) {
    formError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not save this shipping company.'
  } finally {
    saving.value = false
  }
}

const deleteCompany = async () => {
  if (!editingId.value) {
    return
  }

  const confirmed = confirm('Delete this shipping company?')
  if (!confirmed) {
    return
  }

  deleting.value = true

  try {
    const companyName = form.name
    const companyId = editingId.value
    const { error } = await supabase
      .from('commerce_shipping_companies')
      .delete()
      .eq('id', companyId)

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.shipping.delete',
      description: `Deleted shipping company ${companyName}.`,
      metadata: {
        shipping_company_id: companyId
      }
    })

    resetForm()
    await loadCompanies()
  } catch (error) {
    formError.value = error.message || 'Could not delete this shipping company.'
  } finally {
    deleting.value = false
  }
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    loadCompanies()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

onMounted(async () => {
  await loadCompanies()
})
</script>
