<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Warehouses</h3>
          <p class="mt-1 text-sm text-gray-500">
            Define storage locations, move stock between them, and review current inventory movement.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Warehouses</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ warehouses.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Inventory Rows</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ inventoryRows.length }}</p>
          </div>

          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Recent Movements</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ recentMovements.length }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">
            {{ editingWarehouseId ? 'Edit Warehouse' : 'Add Warehouse' }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            Add the core details for each physical storage location.
          </p>
        </div>

        <button
          v-if="editingWarehouseId"
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
          @click="resetWarehouseForm"
        >
          Cancel Edit
        </button>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Warehouse Name</label>
          <input
            v-model="warehouseForm.name"
            type="text"
            placeholder="Main warehouse"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Code</label>
          <input
            v-model="warehouseForm.code"
            type="text"
            placeholder="WH-CAI-01"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Contact Name</label>
          <input
            v-model="warehouseForm.contact_name"
            type="text"
            placeholder="Warehouse manager"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Contact Phone</label>
          <input
            v-model="warehouseForm.contact_phone"
            type="text"
            placeholder="+20..."
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">City</label>
          <input
            v-model="warehouseForm.city"
            type="text"
            placeholder="Cairo"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Country</label>
          <input
            v-model="warehouseForm.country"
            type="text"
            placeholder="Egypt"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Address</label>
          <textarea
            v-model="warehouseForm.address_line_1"
            rows="3"
            placeholder="Warehouse address"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            v-model="warehouseForm.notes"
            rows="3"
            placeholder="Optional notes"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <label class="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <input v-model="warehouseForm.is_active" type="checkbox">
        Active
      </label>

      <p v-if="warehouseFormError" class="mt-4 text-sm text-red-600">
        {{ warehouseFormError }}
      </p>

      <div class="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="savingWarehouse"
          class="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          @click="saveWarehouse"
        >
          {{ savingWarehouse ? 'Saving...' : editingWarehouseId ? 'Save Warehouse' : 'Add Warehouse' }}
        </button>

        <button
          v-if="editingWarehouseId"
          type="button"
          :disabled="deletingWarehouse"
          class="rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          @click="deleteWarehouse"
        >
          {{ deletingWarehouse ? 'Deleting...' : 'Delete' }}
        </button>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Transfer Stock</h3>
          <p class="mt-1 text-sm text-gray-500">
            Move products between warehouses and keep movement history in sync.
          </p>
        </div>

        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-300"
          @click="resetTransferForm"
        >
          Reset
        </button>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">From Warehouse</label>
          <select
            v-model="transferForm.from_warehouse_id"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">Select warehouse</option>

            <option
              v-for="warehouse in activeWarehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">To Warehouse</label>
          <select
            v-model="transferForm.to_warehouse_id"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">Select warehouse</option>

            <option
              v-for="warehouse in activeWarehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Reference</label>
          <input
            v-model="transferForm.reference_number"
            type="text"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="TRF-20260715..."
          >
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700">Product Search</label>
          <input
            v-model="productSearchQuery"
            type="text"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="Search by title or slug"
          >
        </div>

        <div class="md:col-span-2">
          <label class="mb-2 block text-sm font-semibold text-gray-700">Notes</label>
          <textarea
            v-model="transferForm.notes"
            rows="3"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            placeholder="Optional transfer notes"
          />
        </div>
      </div>

      <div class="mt-6 rounded-2xl border bg-gray-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 class="text-lg font-bold text-gray-900">Transfer Items</h4>
            <p class="mt-1 text-sm text-gray-500">
              Move quantities from one warehouse to another without changing total product stock.
            </p>
          </div>

          <button
            type="button"
            class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
            @click="addTransferItem"
          >
            Add Product
          </button>
        </div>

        <div class="mt-4 space-y-3">
          <div
            v-for="(item, index) in transferForm.items"
            :key="index"
            class="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[minmax(0,2fr)_140px_auto]"
          >
            <select
              v-model="item.product_id"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
            >
              <option value="">Select product</option>

              <option
                v-for="product in productOptions"
                :key="product.id"
                :value="product.id"
              >
                {{ product.title }}{{ product.slug ? ` (${product.slug})` : '' }}
              </option>
            </select>

            <input
              v-model="item.quantity"
              type="number"
              min="1"
              class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              placeholder="Qty"
            >

            <button
              type="button"
              class="rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-200"
              :disabled="transferForm.items.length === 1"
              @click="removeTransferItem(index)"
            >
              Remove
            </button>
          </div>
        </div>

        <p v-if="transferFormError" class="mt-4 text-sm text-red-600">
          {{ transferFormError }}
        </p>

        <div class="mt-5 flex justify-end">
          <button
            type="button"
            :disabled="savingTransfer || !isTransferReady"
            class="rounded-lg px-5 py-3 font-bold text-white"
            :class="savingTransfer || !isTransferReady
              ? 'cursor-not-allowed bg-gray-300'
              : 'bg-blue-600 hover:bg-blue-700'"
            @click="saveTransfer"
          >
            {{ savingTransfer ? 'Saving...' : 'Transfer Inventory' }}
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Current Inventory</h3>
          <p class="mt-1 text-sm text-gray-500">
            Quick warehouse stock overview.
          </p>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <select
            v-model="inventoryWarehouseFilter"
            class="rounded-lg border p-3 outline-none focus:border-blue-500"
          >
            <option value="">All warehouses</option>

            <option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :value="warehouse.id"
            >
              {{ warehouse.name }}
            </option>
          </select>

          <input
            v-model="inventorySearchQuery"
            type="text"
            placeholder="Search product"
            class="rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>
      </div>

      <p v-if="pageError" class="mt-5 text-sm text-red-600">
        {{ pageError }}
      </p>

      <p v-else-if="loadingInventory" class="mt-5 text-sm text-gray-500">
        Loading inventory...
      </p>

      <p v-else-if="!inventoryRows.length" class="mt-5 text-sm text-gray-500">
        No inventory rows found.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="row in inventoryRows"
          :key="row.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <p class="font-bold text-gray-900">
                {{ productNameMap[row.product_id] || 'Unknown product' }}
              </p>

              <p class="text-sm text-gray-500">
                {{ warehouseNameMap[row.warehouse_id] || 'Unknown warehouse' }}
                <span v-if="productSlugMap[row.product_id]"> · {{ productSlugMap[row.product_id] }}</span>
              </p>

              <p class="text-xs text-gray-400">
                Updated {{ formatCommerceDate(row.updated_at || row.created_at) }}
              </p>
            </div>

            <div class="flex flex-wrap gap-3 text-sm">
              <div class="rounded-xl bg-gray-100 px-4 py-3">
                <p class="text-gray-500">Quantity</p>
                <p class="mt-1 text-lg font-bold text-gray-900">{{ row.quantity }}</p>
              </div>

              <div class="rounded-xl bg-gray-100 px-4 py-3">
                <p class="text-gray-500">Avg. Cost</p>
                <p class="mt-1 text-lg font-bold text-gray-900">{{ formatCommerceCurrency(row.average_cost) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-2xl font-bold">Recent Movements</h3>
          <p class="mt-1 text-sm text-gray-500">
            Procurement, transfers, and returns are tracked here.
          </p>
        </div>

        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="loadRecentMovements"
        >
          Refresh
        </button>
      </div>

      <p v-if="loadingMovements" class="mt-5 text-sm text-gray-500">
        Loading movement history...
      </p>

      <p v-else-if="!recentMovements.length" class="mt-5 text-sm text-gray-500">
        No inventory movements found yet.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="movement in recentMovements"
          :key="movement.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-gray-900">
                  {{ productNameMap[movement.product_id] || 'Unknown product' }}
                </p>

                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                  {{ formatMovementType(movement.movement_type) }}
                </span>
              </div>

              <p class="text-sm text-gray-500">
                {{ warehouseNameMap[movement.warehouse_id] || 'Unknown warehouse' }}
              </p>

              <p class="text-xs text-gray-400">
                {{ formatCommerceDate(movement.created_at) }}
              </p>
            </div>

            <div class="text-left md:text-right">
              <p
                class="text-lg font-bold"
                :class="Number(movement.quantity_change) >= 0 ? 'text-green-700' : 'text-red-700'"
              >
                {{ Number(movement.quantity_change) >= 0 ? '+' : '' }}{{ movement.quantity_change }}
              </p>

              <p class="text-sm text-gray-500">
                After {{ movement.quantity_after }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-2xl font-bold">Warehouse List</h3>
          <p class="mt-1 text-sm text-gray-500">
            Review all defined warehouses and open any one for editing.
          </p>
        </div>
      </div>

      <p v-if="loadingWarehouses" class="mt-5 text-sm text-gray-500">
        Loading warehouses...
      </p>

      <p v-else-if="!warehouses.length" class="mt-5 text-sm text-gray-500">
        No warehouses found yet.
      </p>

      <div v-else class="mt-6 space-y-3">
        <div
          v-for="warehouse in warehouses"
          :key="warehouse.id"
          class="rounded-2xl border p-4"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-gray-900">{{ warehouse.name }}</p>

                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                  :class="warehouse.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                >
                  {{ warehouse.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>

              <p class="text-sm text-gray-500">
                {{ warehouse.city || 'No city' }}<span v-if="warehouse.country"> · {{ warehouse.country }}</span>
                <span v-if="warehouse.code"> · {{ warehouse.code }}</span>
              </p>

              <p class="text-xs text-gray-400">
                {{ warehouse.contact_name || 'No contact' }}<span v-if="warehouse.contact_phone"> · {{ warehouse.contact_phone }}</span>
              </p>
            </div>

            <button
              type="button"
              class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
              @click="startEditWarehouse(warehouse)"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import {
  buildCommerceReference,
  createEmptyTransferItem,
  formatCommerceCurrency,
  formatCommerceDate
} from '~/utils/commerce'

const supabase = useSupabaseClient()
const { recordAdminLog } = useAdminLogs()

const warehouses = ref([])
const productOptions = ref([])
const productCatalog = ref([])
const inventoryRows = ref([])
const recentMovements = ref([])
const loadingWarehouses = ref(false)
const loadingInventory = ref(false)
const loadingMovements = ref(false)
const savingWarehouse = ref(false)
const deletingWarehouse = ref(false)
const savingTransfer = ref(false)
const pageError = ref('')
const warehouseFormError = ref('')
const transferFormError = ref('')
const editingWarehouseId = ref('')
const productSearchQuery = ref('')
const inventoryWarehouseFilter = ref('')
const inventorySearchQuery = ref('')
let productSearchTimeoutId = null
let inventorySearchTimeoutId = null

const createEmptyWarehouseForm = () => ({
  name: '',
  code: '',
  address_line_1: '',
  city: '',
  country: 'Egypt',
  contact_name: '',
  contact_phone: '',
  notes: '',
  is_active: true
})

const createEmptyTransferForm = () => ({
  from_warehouse_id: '',
  to_warehouse_id: '',
  reference_number: buildCommerceReference('TRF'),
  notes: '',
  items: [createEmptyTransferItem()]
})

const warehouseForm = reactive(createEmptyWarehouseForm())
const transferForm = reactive(createEmptyTransferForm())

const activeWarehouses = computed(() => {
  return warehouses.value.filter((warehouse) => warehouse.is_active)
})

const warehouseNameMap = computed(() => {
  return Object.fromEntries(warehouses.value.map((warehouse) => [warehouse.id, warehouse.name]))
})

const productNameMap = computed(() => {
  return Object.fromEntries(productCatalog.value.map((product) => [product.id, product.title]))
})

const productSlugMap = computed(() => {
  return Object.fromEntries(productCatalog.value.map((product) => [product.id, product.slug || '']))
})

const isTransferReady = computed(() => {
  if (
    !transferForm.from_warehouse_id
    || !transferForm.to_warehouse_id
    || transferForm.from_warehouse_id === transferForm.to_warehouse_id
  ) {
    return false
  }

  return transferForm.items.every((item) => {
    return item.product_id && Number(item.quantity || 0) > 0
  })
})

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST202'
}

const formatMovementType = (value) => {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const mapWarehousePayload = () => ({
  name: String(warehouseForm.name || '').trim(),
  code: String(warehouseForm.code || '').trim() || null,
  address_line_1: String(warehouseForm.address_line_1 || '').trim() || null,
  city: String(warehouseForm.city || '').trim() || null,
  country: String(warehouseForm.country || '').trim() || null,
  contact_name: String(warehouseForm.contact_name || '').trim() || null,
  contact_phone: String(warehouseForm.contact_phone || '').trim() || null,
  notes: String(warehouseForm.notes || '').trim() || null,
  is_active: Boolean(warehouseForm.is_active),
  updated_at: new Date().toISOString()
})

const resetWarehouseForm = () => {
  editingWarehouseId.value = ''
  Object.assign(warehouseForm, createEmptyWarehouseForm())
  warehouseFormError.value = ''
}

const resetTransferForm = () => {
  Object.assign(transferForm, createEmptyTransferForm())
  transferFormError.value = ''
}

const addTransferItem = () => {
  transferForm.items.push(createEmptyTransferItem())
}

const removeTransferItem = (index) => {
  if (transferForm.items.length === 1) {
    return
  }

  transferForm.items.splice(index, 1)
}

const loadProductCatalogByIds = async (productIds = []) => {
  if (!productIds.length) {
    return
  }

  const existingIds = new Set(productCatalog.value.map((product) => product.id))
  const missingIds = productIds.filter((productId) => !existingIds.has(productId))

  if (!missingIds.length) {
    return
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, title, slug')
    .in('id', missingIds)

  if (error) {
    throw error
  }

  productCatalog.value = [
    ...productCatalog.value,
    ...(data || [])
  ]
}

const loadWarehouses = async () => {
  loadingWarehouses.value = true

  try {
    const { data, error } = await supabase
      .from('commerce_warehouses')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    warehouses.value = data || []
  } finally {
    loadingWarehouses.value = false
  }
}

const loadProductOptions = async () => {
  let query = supabase
    .from('products')
    .select('id, title, slug')
    .order('created_at', { ascending: false })
    .limit(30)

  const searchValue = String(productSearchQuery.value || '').trim()

  if (searchValue) {
    const pattern = `%${searchValue}%`
    query = query.or(`title.ilike.${pattern},slug.ilike.${pattern}`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  productOptions.value = data || []
  await loadProductCatalogByIds(productOptions.value.map((product) => product.id))
}

const resolveProductIdsBySearch = async (searchValue) => {
  if (!searchValue) {
    return null
  }

  const pattern = `%${searchValue}%`
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .or(`title.ilike.${pattern},slug.ilike.${pattern}`)
    .limit(40)

  if (error) {
    throw error
  }

  return (data || []).map((product) => product.id)
}

const loadInventoryRows = async () => {
  loadingInventory.value = true

  try {
    const searchValue = String(inventorySearchQuery.value || '').trim()
    const matchedProductIds = await resolveProductIdsBySearch(searchValue)

    if (matchedProductIds && !matchedProductIds.length) {
      inventoryRows.value = []
      return
    }

    let query = supabase
      .from('commerce_warehouse_inventory')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(30)

    if (inventoryWarehouseFilter.value) {
      query = query.eq('warehouse_id', inventoryWarehouseFilter.value)
    }

    if (matchedProductIds) {
      query = query.in('product_id', matchedProductIds)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    inventoryRows.value = data || []
    await loadProductCatalogByIds(inventoryRows.value.map((row) => row.product_id))
  } finally {
    loadingInventory.value = false
  }
}

const loadRecentMovements = async () => {
  loadingMovements.value = true

  try {
    const searchValue = String(inventorySearchQuery.value || '').trim()
    const matchedProductIds = await resolveProductIdsBySearch(searchValue)

    if (matchedProductIds && !matchedProductIds.length) {
      recentMovements.value = []
      return
    }

    let query = supabase
      .from('commerce_inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(18)

    if (inventoryWarehouseFilter.value) {
      query = query.eq('warehouse_id', inventoryWarehouseFilter.value)
    }

    if (matchedProductIds) {
      query = query.in('product_id', matchedProductIds)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    recentMovements.value = data || []
    await loadProductCatalogByIds(recentMovements.value.map((movement) => movement.product_id))
  } finally {
    loadingMovements.value = false
  }
}

const refreshStockViews = async () => {
  await Promise.all([
    loadInventoryRows(),
    loadRecentMovements()
  ])
}

const startEditWarehouse = (warehouse) => {
  editingWarehouseId.value = warehouse.id
  Object.assign(warehouseForm, {
    name: warehouse.name || '',
    code: warehouse.code || '',
    address_line_1: warehouse.address_line_1 || '',
    city: warehouse.city || '',
    country: warehouse.country || 'Egypt',
    contact_name: warehouse.contact_name || '',
    contact_phone: warehouse.contact_phone || '',
    notes: warehouse.notes || '',
    is_active: warehouse.is_active ?? true
  })
  warehouseFormError.value = ''
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

const saveWarehouse = async () => {
  warehouseFormError.value = ''
  const payload = mapWarehousePayload()

  if (!payload.name) {
    warehouseFormError.value = 'Warehouse name is required.'
    return
  }

  savingWarehouse.value = true

  try {
    if (editingWarehouseId.value) {
      const { error } = await supabase
        .from('commerce_warehouses')
        .update(payload)
        .eq('id', editingWarehouseId.value)

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.warehouse.update',
        description: `Updated warehouse ${payload.name}.`,
        metadata: {
          warehouse_id: editingWarehouseId.value
        }
      })
    } else {
      const { data, error } = await supabase
        .from('commerce_warehouses')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      await recordAdminLog({
        actionKey: 'commerce.warehouse.create',
        description: `Added warehouse ${payload.name}.`,
        metadata: {
          warehouse_id: data?.id || null
        }
      })
    }

    resetWarehouseForm()
    await loadWarehouses()
  } catch (error) {
    warehouseFormError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not save this warehouse.'
  } finally {
    savingWarehouse.value = false
  }
}

const deleteWarehouse = async () => {
  if (!editingWarehouseId.value) {
    return
  }

  const confirmed = confirm('Delete this warehouse?')
  if (!confirmed) {
    return
  }

  deletingWarehouse.value = true

  try {
    const warehouseId = editingWarehouseId.value
    const warehouseName = warehouseForm.name
    const { error } = await supabase
      .from('commerce_warehouses')
      .delete()
      .eq('id', warehouseId)

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.warehouse.delete',
      description: `Deleted warehouse ${warehouseName}.`,
      metadata: {
        warehouse_id: warehouseId
      }
    })

    resetWarehouseForm()
    await Promise.all([
      loadWarehouses(),
      refreshStockViews()
    ])
  } catch (error) {
    warehouseFormError.value = error.message || 'Could not delete this warehouse.'
  } finally {
    deletingWarehouse.value = false
  }
}

const saveTransfer = async () => {
  transferFormError.value = ''

  if (!isTransferReady.value) {
    transferFormError.value = 'Select two different warehouses and complete every item first.'
    return
  }

  savingTransfer.value = true

  try {
    const payloadItems = transferForm.items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity || 0)
    }))

    const { data, error } = await supabase.rpc('commerce_transfer_inventory', {
      p_from_warehouse_id: transferForm.from_warehouse_id,
      p_to_warehouse_id: transferForm.to_warehouse_id,
      p_reference_number: String(transferForm.reference_number || '').trim() || null,
      p_notes: String(transferForm.notes || '').trim() || null,
      p_items: payloadItems
    })

    if (error) {
      throw error
    }

    await recordAdminLog({
      actionKey: 'commerce.warehouse.transfer',
      description: `Transferred inventory from ${warehouseNameMap.value[transferForm.from_warehouse_id] || 'warehouse'} to ${warehouseNameMap.value[transferForm.to_warehouse_id] || 'warehouse'}.`,
      metadata: {
        transfer_id: data || null,
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        lines: payloadItems.length
      }
    })

    resetTransferForm()
    await refreshStockViews()
  } catch (error) {
    transferFormError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not transfer inventory.'
  } finally {
    savingTransfer.value = false
  }
}

watch(productSearchQuery, () => {
  if (productSearchTimeoutId) {
    clearTimeout(productSearchTimeoutId)
  }

  productSearchTimeoutId = setTimeout(() => {
    loadProductOptions()
  }, 300)
})

watch([inventoryWarehouseFilter, inventorySearchQuery], () => {
  if (inventorySearchTimeoutId) {
    clearTimeout(inventorySearchTimeoutId)
  }

  inventorySearchTimeoutId = setTimeout(() => {
    refreshStockViews()
  }, 300)
})

onBeforeUnmount(() => {
  if (productSearchTimeoutId) {
    clearTimeout(productSearchTimeoutId)
  }

  if (inventorySearchTimeoutId) {
    clearTimeout(inventorySearchTimeoutId)
  }
})

onMounted(async () => {
  pageError.value = ''

  try {
    await Promise.all([
      loadWarehouses(),
      loadProductOptions(),
      refreshStockViews()
    ])
  } catch (error) {
    pageError.value = isMissingSchemaError(error)
      ? 'Run the new commerce SQL first, then refresh this page.'
      : error.message || 'Could not load warehouse data.'
  }
})
</script>
