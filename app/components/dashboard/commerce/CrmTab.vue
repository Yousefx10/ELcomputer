<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">CRM</h3>
          <p class="mt-1 text-sm text-gray-500">
            Record Suppliers and People.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Suppliers</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ supplierCount }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Customers</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ customerCount }}</p>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-semibold"
          :class="activeAccountType === 'supplier' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
          @click="activeAccountType = 'supplier'"
        >
          Suppliers
        </button>

        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-semibold"
          :class="activeAccountType === 'customer' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
          @click="activeAccountType = 'customer'"
        >
          Customers
        </button>
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
            {{ editingId ? `Edit ${currentTypeLabel}` : `Add ${currentTypeLabel}` }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ activeAccountType === 'supplier'
              ? 'Suppliers used for procurement (cost / inventory).'
              : 'Direct Customers.' }}
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
          <label class="mb-2 block text-sm font-semibold text-gray-700">Entity Type</label>
          <select
            v-model="form.entity_type"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="company">Company</option>
            <option value="person">Person</option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">
            {{ form.entity_type === 'company' ? 'Company Name' : 'Person Name' }}
          </label>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            :placeholder="form.entity_type === 'company' ? 'Company name' : 'Person full name'"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Code</label>
          <input
            v-model="form.code"
            type="text"
            placeholder="Optional internal code"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Tax Number</label>
          <input
            v-model="form.tax_number"
            type="text"
            placeholder="Optional tax number"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Email</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="company@example.com"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Phone</label>
          <input
            v-model="form.phone"
            type="text"
            placeholder="+20..."
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div class="md:col-span-2 rounded-2xl border bg-gray-50 p-4">
          <h4 class="text-lg font-bold text-gray-900">Primary Contact Person</h4>

          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Contact Name</label>
              <input
                v-model="form.primary_contact_name"
                type="text"
                placeholder="Main contact name"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Contact Role</label>
              <input
                v-model="form.primary_contact_role"
                type="text"
                placeholder="Sales manager"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Contact Email</label>
              <input
                v-model="form.primary_contact_email"
                type="email"
                placeholder="contact@example.com"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-gray-700">Contact Phone</label>
              <input
                v-model="form.primary_contact_phone"
                type="text"
                placeholder="+20..."
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              >
            </div>
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">City</label>
          <input
            v-model="form.city"
            type="text"
            placeholder="Cairo"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Country</label>
          <input
            v-model="form.country"
            type="text"
            placeholder="Egypt"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Address</label>
          <textarea
            v-model="form.address_line_1"
            rows="3"
            placeholder="Address line"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            v-model="form.notes"
            rows="3"
            placeholder="Extra notes"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
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
            @click="saveAccount"
          >
            {{ saving ? 'Saving...' : editingId ? `Save ${currentTypeLabel}` : `Add ${currentTypeLabel}` }}
          </button>

          <button
            v-if="editingId"
            type="button"
            :disabled="deleting"
            class="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            @click="deleteAccount"
          >
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-left"
        @click="isListOpen = !isListOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">All {{ currentTypeListLabel }}</h3>
          <p class="mt-1 text-sm text-gray-500">
            Search by name, contact, email, or phone.
          </p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isListOpen ? 'Collapse' : 'Expand' }}</span>
          <Icon
            name="lucide:chevron-down"
            size="18"
            class="transition-transform"
            :class="isListOpen ? 'rotate-180' : ''"
          />
        </div>
      </button>

      <div v-if="isListOpen" class="mt-6">
        <div class="w-full md:max-w-md">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Search</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search records"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ pageError }}
      </p>

      <p v-else-if="loading" class="mt-5 text-sm text-gray-500">
        Loading records...
      </p>

      <p v-else-if="!accounts.length" class="mt-5 text-sm text-gray-500">
        No records found.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="account in accounts"
          :key="account.id"
          role="button"
          tabindex="0"
          class="cursor-pointer rounded-2xl border p-4 transition hover:border-gray-400 hover:bg-gray-50"
          @click="openAccountDetails(account)"
          @keydown.enter="openAccountDetails(account)"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-gray-900">
                  {{ account.name }}
                </p>

                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                  {{ account.entity_type }}
                </span>

                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                >
                  {{ account.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>

              <p class="text-sm text-gray-600">
                {{ account.email || 'No email' }}<span v-if="account.phone"> · {{ account.phone }}</span>
              </p>

              <p class="text-sm text-gray-500">
                {{ account.primary_contact_name || 'No contact person' }}
                <span v-if="account.primary_contact_role"> · {{ account.primary_contact_role }}</span>
              </p>

              <p class="text-xs text-gray-400">
                {{ account.city || 'No city' }}<span v-if="account.country"> · {{ account.country }}</span>
                <span v-if="account.code"> · {{ account.code }}</span>
              </p>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                @click.stop="startEdit(account)"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="selectedAccount"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeAccountDetails"
      >
        <section class="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                {{ selectedAccount.account_type === 'supplier' ? 'Supplier' : 'Customer' }} Details
              </p>
              <h3 class="mt-1 text-3xl font-bold text-gray-900">{{ selectedAccount.name }}</h3>
              <p class="mt-2 text-sm text-gray-500">
                {{ selectedAccount.email || 'No email' }}<span v-if="selectedAccount.phone"> · {{ selectedAccount.phone }}</span>
              </p>
            </div>

            <button
              type="button"
              class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              @click="closeAccountDetails"
            >
              Close
            </button>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-2xl bg-gray-100 p-4">
              <p class="text-sm text-gray-500">Orders</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ accountSummary.order_count }}</p>
            </div>
            <div class="rounded-2xl bg-gray-100 p-4">
              <p class="text-sm text-gray-500">Total Value</p>
              <p class="mt-2 text-xl font-bold text-gray-900">{{ formatCommerceCurrency(accountSummary.total_amount) }}</p>
            </div>
            <div class="rounded-2xl bg-gray-100 p-4">
              <p class="text-sm text-gray-500">Paid</p>
              <p class="mt-2 text-xl font-bold text-gray-900">{{ formatCommerceCurrency(accountSummary.paid_amount) }}</p>
            </div>
            <div class="rounded-2xl bg-amber-50 p-4">
              <p class="text-sm text-amber-700">Settlement Due</p>
              <p class="mt-2 text-xl font-bold text-amber-900">{{ formatCommerceCurrency(accountSummary.settlement_due) }}</p>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 class="text-xl font-bold text-gray-900">
                {{ selectedAccount.account_type === 'supplier' ? 'Purchasing Orders' : 'Selling Orders' }}
              </h4>
              <p class="mt-1 text-sm text-gray-500">
                {{ selectedAccount.account_type === 'supplier'
                  ? 'Procurement orders connected to this supplier.'
                  : 'Manual sales connected to this CRM customer.' }}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-full px-4 py-2 text-sm font-semibold"
                :class="accountOrdersMode === 'latest' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
                @click="setAccountOrdersMode('latest')"
              >
                Latest
              </button>
              <button
                type="button"
                class="rounded-full px-4 py-2 text-sm font-semibold"
                :class="accountOrdersMode === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
                @click="setAccountOrdersMode('all')"
              >
                All
              </button>
            </div>
          </div>

          <p v-if="accountDetailsError" class="mt-5 text-sm text-red-600">{{ accountDetailsError }}</p>
          <p v-else-if="accountDetailsLoading" class="mt-5 text-sm text-gray-500">Loading orders...</p>
          <p v-else-if="!accountOrders.length" class="mt-5 text-sm text-gray-500">No connected orders found.</p>

          <div v-else class="mt-5 space-y-3">
            <div
              v-for="order in accountOrders"
              :key="order.id"
              class="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p class="font-bold text-gray-900">{{ getAccountOrderReference(order) }}</p>
                <p class="mt-1 text-xs text-gray-400">{{ formatCommerceDate(order.created_at) }}</p>
              </div>

              <div class="text-left sm:text-right">
                <p class="font-bold text-gray-900">{{ formatCommerceCurrency(getAccountOrderTotal(order)) }}</p>
                <p class="mt-1 text-sm text-gray-500">
                  Paid {{ formatCommerceCurrency(order.paid_amount) }} · Due {{ formatCommerceCurrency(getAccountOrderDue(order)) }}
                </p>
              </div>
            </div>
          </div>

          <div
            v-if="accountOrdersMode === 'all' && accountOrdersTotalPages > 1"
            class="mt-6 flex items-center justify-between gap-3"
          >
            <button
              type="button"
              :disabled="accountOrdersPage === 1"
              class="rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              @click="changeAccountOrdersPage(accountOrdersPage - 1)"
            >
              Previous
            </button>
            <p class="text-sm text-gray-500">Page {{ accountOrdersPage }} of {{ accountOrdersTotalPages }}</p>
            <button
              type="button"
              :disabled="accountOrdersPage === accountOrdersTotalPages"
              class="rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              @click="changeAccountOrdersPage(accountOrdersPage + 1)"
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { formatCommerceCurrency, formatCommerceDate } from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()

const activeAccountType = ref('supplier')
const accounts = ref([])
const supplierCount = ref(0)
const customerCount = ref(0)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const pageError = ref('')
const formError = ref('')
const searchQuery = ref('')
const editingId = ref('')
const isFormOpen = ref(false)
const isListOpen = ref(false)
const selectedAccount = ref(null)
const accountOrders = ref([])
const accountDetailsLoading = ref(false)
const accountDetailsError = ref('')
const accountOrdersMode = ref('latest')
const accountOrdersPage = ref(1)
const accountOrdersTotalPages = ref(1)
const accountSummary = reactive({
  order_count: 0,
  total_amount: 0,
  paid_amount: 0,
  settlement_due: 0
})
let searchTimeoutId = null

const createEmptyForm = () => ({
  entity_type: 'company',
  name: '',
  code: '',
  email: '',
  phone: '',
  tax_number: '',
  address_line_1: '',
  city: '',
  country: 'Egypt',
  notes: '',
  primary_contact_name: '',
  primary_contact_role: '',
  primary_contact_email: '',
  primary_contact_phone: '',
  is_active: true
})

const form = reactive(createEmptyForm())

const currentTypeLabel = computed(() => activeAccountType.value === 'supplier' ? 'Supplier' : 'Customer')
const currentTypeListLabel = computed(() => activeAccountType.value === 'supplier' ? 'Suppliers' : 'Customers')
const trimmedSearchQuery = computed(() => searchQuery.value.trim())

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST202'
}

const resetForm = () => {
  editingId.value = ''
  Object.assign(form, createEmptyForm())
  formError.value = ''
}

const mapPayload = () => ({
  account_type: activeAccountType.value,
  entity_type: form.entity_type,
  name: String(form.name || '').trim(),
  code: String(form.code || '').trim() || null,
  email: String(form.email || '').trim() || null,
  phone: String(form.phone || '').trim() || null,
  tax_number: String(form.tax_number || '').trim() || null,
  address_line_1: String(form.address_line_1 || '').trim() || null,
  city: String(form.city || '').trim() || null,
  country: String(form.country || '').trim() || null,
  notes: String(form.notes || '').trim() || null,
  primary_contact_name: String(form.primary_contact_name || '').trim() || null,
  primary_contact_role: String(form.primary_contact_role || '').trim() || null,
  primary_contact_email: String(form.primary_contact_email || '').trim() || null,
  primary_contact_phone: String(form.primary_contact_phone || '').trim() || null,
  is_active: Boolean(form.is_active),
  updated_at: new Date().toISOString()
})

const loadCounts = async () => {
  const [
    supplierResult,
    customerResult
  ] = await Promise.all([
    supabase
      .from('commerce_crm_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'supplier'),
    supabase
      .from('commerce_crm_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'customer')
  ])

  if (supplierResult.error) {
    throw supplierResult.error
  }

  if (customerResult.error) {
    throw customerResult.error
  }

  supplierCount.value = supplierResult.count || 0
  customerCount.value = customerResult.count || 0
}

const loadAccounts = async () => {
  loading.value = true
  pageError.value = ''

  try {
    let query = supabase
      .from('commerce_crm_accounts')
      .select('*')
      .eq('account_type', activeAccountType.value)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (trimmedSearchQuery.value) {
      const pattern = `%${trimmedSearchQuery.value}%`
      query = query.or([
        `name.ilike.${pattern}`,
        `primary_contact_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`
      ].join(','))
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    accounts.value = data || []
    await loadCounts()
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load CRM records.'
  } finally {
    loading.value = false
  }
}

const loadAccountSummary = async () => {
  const { data, error } = await supabase.rpc('commerce_get_crm_account_summary', {
    p_account_id: selectedAccount.value.id
  })

  if (error) throw error

  Object.assign(accountSummary, {
    order_count: Number(data?.order_count || 0),
    total_amount: Number(data?.total_amount || 0),
    paid_amount: Number(data?.paid_amount || 0),
    settlement_due: Number(data?.settlement_due || 0)
  })
}

const loadAccountOrders = async () => {
  const isSupplier = selectedAccount.value.account_type === 'supplier'
  const tableName = isSupplier ? 'commerce_procurement_orders' : 'commerce_sales_orders'
  const accountField = isSupplier ? 'supplier_id' : 'customer_id'
  const fields = isSupplier
    ? 'id, invoice_number, total_cost, paid_amount, created_at'
    : 'id, order_number, total_amount, paid_amount, created_at'
  const pageSize = accountOrdersMode.value === 'latest' ? 5 : 10
  const page = accountOrdersMode.value === 'latest' ? 1 : accountOrdersPage.value
  const from = (page - 1) * pageSize

  const { data, error, count } = await supabase
    .from(tableName)
    .select(fields, { count: 'exact' })
    .eq(accountField, selectedAccount.value.id)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error

  accountOrders.value = data || []
  accountOrdersTotalPages.value = Math.max(1, Math.ceil(Number(count || 0) / pageSize))
}

const refreshAccountDetails = async ({ includeSummary = false } = {}) => {
  if (!selectedAccount.value) return

  accountDetailsLoading.value = true
  accountDetailsError.value = ''

  try {
    const requests = [loadAccountOrders()]
    if (includeSummary) requests.push(loadAccountSummary())
    await Promise.all(requests)
  } catch (error) {
    accountDetailsError.value = isMissingSchemaError(error)
      ? 'Run the latest Commerce SQL migration first, then reopen this account.'
      : error.message || 'Could not load the connected CRM orders.'
  } finally {
    accountDetailsLoading.value = false
  }
}

const openAccountDetails = async (account) => {
  selectedAccount.value = account
  accountOrders.value = []
  accountOrdersMode.value = 'latest'
  accountOrdersPage.value = 1
  accountOrdersTotalPages.value = 1
  Object.assign(accountSummary, {
    order_count: 0,
    total_amount: 0,
    paid_amount: 0,
    settlement_due: 0
  })
  await refreshAccountDetails({ includeSummary: true })
}

const closeAccountDetails = () => {
  selectedAccount.value = null
  accountOrders.value = []
  accountDetailsError.value = ''
}

const setAccountOrdersMode = async (mode) => {
  if (accountOrdersMode.value === mode) return
  accountOrdersMode.value = mode
  accountOrdersPage.value = 1
  await refreshAccountDetails()
}

const changeAccountOrdersPage = async (page) => {
  if (page < 1 || page > accountOrdersTotalPages.value) return
  accountOrdersPage.value = page
  await refreshAccountDetails()
}

const getAccountOrderReference = (order) => {
  return order.invoice_number || order.order_number || `Order #${String(order.id || '').slice(0, 8)}`
}

const getAccountOrderTotal = (order) => {
  return Number(order.total_cost ?? order.total_amount ?? 0)
}

const getAccountOrderDue = (order) => {
  return Math.max(getAccountOrderTotal(order) - Number(order.paid_amount || 0), 0)
}

const startEdit = (account) => {
  isFormOpen.value = true
  editingId.value = account.id
  Object.assign(form, {
    entity_type: account.entity_type || 'company',
    name: account.name || '',
    code: account.code || '',
    email: account.email || '',
    phone: account.phone || '',
    tax_number: account.tax_number || '',
    address_line_1: account.address_line_1 || '',
    city: account.city || '',
    country: account.country || 'Egypt',
    notes: account.notes || '',
    primary_contact_name: account.primary_contact_name || '',
    primary_contact_role: account.primary_contact_role || '',
    primary_contact_email: account.primary_contact_email || '',
    primary_contact_phone: account.primary_contact_phone || '',
    is_active: account.is_active ?? true
  })
  formError.value = ''
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

const saveAccount = async () => {
  formError.value = ''

  const payload = mapPayload()

  if (!payload.name) {
    formError.value = 'Name is required.'
    return
  }

  saving.value = true

  try {
    if (editingId.value) {
      const { error } = await supabase
        .from('commerce_crm_accounts')
        .update(payload)
        .eq('id', editingId.value)

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.crm.update',
        description: `Updated ${activeAccountType.value} ${payload.name}.`,
        metadata: {
          account_id: editingId.value,
          account_type: activeAccountType.value
        }
      })
    } else {
      const { data, error } = await supabase
        .from('commerce_crm_accounts')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.crm.create',
        description: `Added ${activeAccountType.value} ${payload.name}.`,
        metadata: {
          account_id: data?.id || null,
          account_type: activeAccountType.value
        }
      })
    }

    resetForm()
    await loadAccounts()
  } catch (error) {
    formError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not save this record.'
  } finally {
    saving.value = false
  }
}

const deleteAccount = async () => {
  if (!editingId.value) {
    return
  }

  const confirmed = confirm('Delete this CRM record?')

  if (!confirmed) {
    return
  }

  deleting.value = true
  formError.value = ''

  try {
    const name = form.name
    const accountId = editingId.value
    const { error } = await supabase
      .from('commerce_crm_accounts')
      .delete()
      .eq('id', accountId)

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.crm.delete',
      description: `Deleted ${activeAccountType.value} ${name}.`,
      metadata: {
        account_id: accountId,
        account_type: activeAccountType.value
      }
    })

    resetForm()
    await loadAccounts()
  } catch (error) {
    formError.value = error.message || 'Could not delete this record.'
  } finally {
    deleting.value = false
  }
}

watch(activeAccountType, () => {
  closeAccountDetails()
  resetForm()
  loadAccounts()
})

watch(searchQuery, () => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }

  searchTimeoutId = setTimeout(() => {
    loadAccounts()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeoutId) {
    clearTimeout(searchTimeoutId)
  }
})

onMounted(async () => {
  await loadAccounts()
})
</script>
