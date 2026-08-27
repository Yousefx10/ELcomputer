<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Shipping Companies</h3>
          <p class="mt-1 text-sm text-gray-500">
            Define Shipping Companies.
          </p>
        </div>

        <div class="rounded-2xl bg-gray-100 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Companies</p>
          <p class="mt-2 text-2xl font-bold text-gray-900">{{ companies.length }}</p>
        </div>
      </div>
    </section>

    <section v-if="canConfigureShipping" class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">PDC API</h3>
          <p class="mt-1 text-sm text-gray-500">Prepare automatic labels here.</p>
        </div>

        <div class="flex flex-wrap gap-2 text-xs font-semibold">
          <span
            class="rounded-full px-3 py-1"
            :class="pdcSettings.live_requests_enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ pdcSettings.live_requests_enabled ? 'Live server ready' : 'Live calls off' }}
          </span>
          <span
            class="rounded-full px-3 py-1"
            :class="pdcSettings.access_token_configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
          >
            {{ pdcSettings.access_token_configured ? 'Token saved' : 'Token missing' }}
          </span>
          <span class="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
            {{ pdcSettings.city_mapping_count }} cities
          </span>
          <span v-if="pdcSettings.pending_job_count" class="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
            {{ pdcSettings.pending_job_count }} pending
          </span>
        </div>
      </div>

      <p v-if="pdcLoading" class="mt-5 text-sm text-gray-500">Loading PDC settings...</p>
      <p v-else-if="pdcPageError" class="mt-5 text-sm text-red-600">{{ pdcPageError }}</p>

      <form v-else class="mt-6 space-y-5" @submit.prevent="savePdcSettings">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">API URL</label>
            <input
              :value="pdcSettings.base_url"
              type="text"
              readonly
              class="w-full rounded-lg border bg-gray-50 p-3 text-sm text-gray-600"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Company ID</label>
            <input
              v-model="pdcSettings.company_id"
              type="text"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Product ID</label>
            <input
              v-model="pdcSettings.product_id"
              type="number"
              min="1"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Pickup City ID</label>
            <input
              v-model="pdcSettings.origin_city_id"
              type="number"
              min="1"
              placeholder="Required before launch"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Pickup Contact</label>
            <input
              v-model="pdcSettings.origin_contact_name"
              type="text"
              placeholder="Store name"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Pickup Phone</label>
            <input
              v-model="pdcSettings.origin_phone"
              type="tel"
              inputmode="numeric"
              placeholder="01xxxxxxxxx"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div class="md:col-span-2 xl:col-span-3">
            <label class="mb-2 block text-sm font-semibold text-gray-700">Pickup Address</label>
            <input
              v-model="pdcSettings.origin_address"
              type="text"
              placeholder="Full pickup address"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Default Weight (kg)</label>
            <input
              v-model="pdcSettings.default_weight_kg"
              type="number"
              min="0.001"
              step="0.001"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Shipment Type</label>
            <select
              v-model="pdcSettings.shipment_type_id"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
            >
              <option :value="1">General</option>
              <option :value="3">Reverse</option>
              <option :value="5">Exchange</option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Label Template ID</label>
            <input
              v-model="pdcSettings.label_template_id"
              type="number"
              min="1"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Access Token</label>
            <input
              v-model="pdcSettings.access_token"
              type="password"
              autocomplete="new-password"
              :placeholder="pdcSettings.access_token_configured ? 'Saved; leave blank to keep' : 'Enter at launch'"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div class="md:col-span-2">
            <label class="mb-2 block text-sm font-semibold text-gray-700">Webhook Secret</label>
            <input
              v-model="pdcSettings.webhook_secret"
              type="password"
              autocomplete="new-password"
              :placeholder="pdcSettings.webhook_secret_configured ? 'Saved; leave blank to keep' : 'At least 32 characters'"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.auto_create_labels" type="checkbox">
            Auto-create paid labels
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.all_must_valid" type="checkbox">
            Reject invalid batches
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.allow_open_shipment" type="checkbox">
            Allow package opening
          </label>
          <label v-if="pdcSettings.live_requests_enabled" class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="pdcSettings.is_enabled" type="checkbox">
            Enable live requests
          </label>
        </div>

        <p v-if="!pdcSettings.encryption_ready" class="text-sm text-amber-700">
          Add the encryption key before saving secrets.
        </p>
        <p v-if="pdcFormError" class="text-sm text-red-600">{{ pdcFormError }}</p>
        <p v-if="pdcSavedMessage" class="text-sm text-green-700">{{ pdcSavedMessage }}</p>

        <button
          type="submit"
          :disabled="pdcSaving"
          class="rounded-lg bg-black px-5 py-3 font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ pdcSaving ? 'Saving...' : 'Save PDC Settings' }}
        </button>
      </form>
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
            Set carrier prices and notes.
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
            Manage active and inactive carriers.
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
const { hasPermission, loadAdminAccess } = useAdminAccess()

const companies = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const pageError = ref('')
const formError = ref('')
const searchQuery = ref('')
const editingId = ref('')
const isFormOpen = ref(false)
const pdcLoading = ref(false)
const pdcSaving = ref(false)
const pdcPageError = ref('')
const pdcFormError = ref('')
const pdcSavedMessage = ref('')
let searchTimeoutId = null

const canConfigureShipping = computed(() => hasPermission('settings.edit'))

const createEmptyPdcSettings = () => ({
  display_name: 'PDC Courier',
  base_url: 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',
  company_id: '280533',
  product_id: 40,
  origin_city_id: '',
  origin_address: '',
  origin_phone: '',
  origin_contact_name: '',
  default_weight_kg: 1,
  shipment_type_id: 1,
  label_template_id: 1,
  allow_open_shipment: false,
  all_must_valid: true,
  is_enabled: false,
  auto_create_labels: false,
  access_token: '',
  webhook_secret: '',
  access_token_configured: false,
  webhook_secret_configured: false,
  encryption_ready: false,
  live_requests_enabled: false,
  city_mapping_count: 0,
  pending_job_count: 0
})

const pdcSettings = reactive(createEmptyPdcSettings())

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const loadPdcSettings = async () => {
  if (!canConfigureShipping.value) {
    return
  }

  pdcLoading.value = true
  pdcPageError.value = ''

  try {
    const response = await $fetch('/api/admin-shipping/settings', {
      headers: await getAuthHeaders()
    })

    Object.assign(pdcSettings, createEmptyPdcSettings(), response.settings || {})
  } catch (error) {
    pdcPageError.value = error?.data?.statusMessage || error?.message || 'Could not load PDC settings.'
  } finally {
    pdcLoading.value = false
  }
}

const savePdcSettings = async () => {
  pdcSaving.value = true
  pdcFormError.value = ''
  pdcSavedMessage.value = ''

  try {
    await $fetch('/api/admin-shipping/settings', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: {
        display_name: pdcSettings.display_name,
        company_id: pdcSettings.company_id,
        product_id: pdcSettings.product_id,
        origin_city_id: pdcSettings.origin_city_id,
        origin_address: pdcSettings.origin_address,
        origin_phone: pdcSettings.origin_phone,
        origin_contact_name: pdcSettings.origin_contact_name,
        default_weight_kg: pdcSettings.default_weight_kg,
        shipment_type_id: pdcSettings.shipment_type_id,
        label_template_id: pdcSettings.label_template_id,
        allow_open_shipment: pdcSettings.allow_open_shipment,
        all_must_valid: pdcSettings.all_must_valid,
        is_enabled: pdcSettings.is_enabled,
        auto_create_labels: pdcSettings.auto_create_labels,
        access_token: pdcSettings.access_token,
        webhook_secret: pdcSettings.webhook_secret
      }
    })

    const liveCallsOff = !pdcSettings.live_requests_enabled
    await loadPdcSettings()
    pdcSavedMessage.value = liveCallsOff
      ? 'Settings saved. Live calls remain off.'
      : 'Settings saved.'
  } catch (error) {
    pdcFormError.value = error?.data?.statusMessage || error?.message || 'Could not save PDC settings.'
  } finally {
    pdcSaving.value = false
  }
}

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
  await loadAdminAccess()
  await Promise.all([
    loadCompanies(),
    loadPdcSettings()
  ])
})
</script>
