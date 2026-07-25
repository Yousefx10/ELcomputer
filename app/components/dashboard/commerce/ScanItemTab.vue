<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold">Scan Item</h3>
          <p class="mt-1 max-w-2xl text-sm text-gray-500">
            Scan a serialized-item QR code or enter its token to see its current state, purchaser, order, and full movement history.
          </p>
        </div>

        <div>
          <div class="rounded-2xl bg-gray-100 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Lookup</p>
            <p class="mt-2 text-lg font-bold text-gray-900">
              {{ lookupLoading ? 'Searching...' : item ? 'Item Found' : 'Ready' }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="lookupError"
      class="rounded-2xl bg-red-50 p-4 text-sm text-red-700 shadow"
      role="alert"
    >
      {{ lookupError }}
    </div>

    <div
      v-if="returnMessage"
      class="rounded-2xl bg-green-50 p-4 text-sm text-green-700 shadow"
      role="status"
    >
      {{ returnMessage }}
    </div>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div>
        <h4 class="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Icon name="lucide:scan-line" size="24" class="shrink-0 text-gray-500" />
          Manual Lookup
        </h4>
        <p class="mt-1 text-sm text-gray-500">
          Keep this field focused and scan with your QR scanner, or paste the token or full scan URL.
        </p>

        <form class="mt-4" @submit.prevent="lookupItem(tokenInput)">
          <label for="serialized-token" class="mb-2 block text-sm font-semibold text-gray-700">
            QR Token or Scan URL
          </label>
          <div class="flex flex-col gap-3 sm:flex-row">
            <input
              id="serialized-token"
              ref="tokenInputElement"
              v-model="tokenInput"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              autofocus
              placeholder="Scan or paste token"
              class="min-w-0 flex-1 rounded-lg border p-3 font-mono text-sm outline-none focus:border-blue-500"
              @focus="$event.currentTarget.select()"
            >
            <button
              type="submit"
              :disabled="lookupLoading || !tokenInput.trim()"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="lucide:search" size="18" />
              {{ lookupLoading ? 'Looking Up...' : 'Find Item' }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <section
      v-if="lookupLoading"
      class="rounded-2xl bg-white p-8 text-center text-gray-500 shadow"
    >
      Loading serialized item details...
    </section>

    <template v-else-if="item">
      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-3">
              <span
                class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                :class="getSerializedItemStatusClass(item.status)"
              >
                {{ formatSerializedItemStatus(item.status) }}
              </span>
              <span class="text-xs text-gray-400">Updated {{ formatCommerceDate(item.updatedAt || item.createdAt) }}</span>
            </div>

            <h3 class="mt-4 break-words text-3xl font-bold text-gray-900">
              {{ item.product.title }}
            </h3>
            <p class="mt-2 text-lg text-gray-600">
              {{ item.variant.name || 'Default variant' }}
            </p>

            <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
              <span v-if="item.variant.sku || item.product.sku">
                SKU <strong class="text-gray-700">{{ item.variant.sku || item.product.sku }}</strong>
              </span>
              <span v-if="item.variant.code">
                Variant <strong class="text-gray-700">{{ item.variant.code }}</strong>
              </span>
              <span v-if="item.variant.colorName || item.variant.colorHex" class="inline-flex items-center gap-2">
                <span
                  v-if="isValidHexColor(item.variant.colorHex)"
                  class="h-3 w-3 rounded-full border"
                  :style="{ backgroundColor: item.variant.colorHex }"
                  aria-hidden="true"
                />
                <strong class="text-gray-700">{{ item.variant.colorName || item.variant.colorHex }}</strong>
              </span>
            </div>
          </div>

          <div class="w-full rounded-2xl bg-gray-950 p-5 text-white lg:max-w-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Unit Code</p>
            <p class="mt-2 break-all font-mono text-xl font-bold">{{ item.unitCode }}</p>
            <dl class="mt-5 space-y-3 text-sm">
              <div class="flex items-start justify-between gap-4">
                <dt class="text-gray-400">Warehouse</dt>
                <dd class="text-right font-semibold">{{ item.warehouse.name || 'Not assigned' }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4">
                <dt class="text-gray-400">Created</dt>
                <dd class="text-right font-semibold">{{ formatCommerceDate(item.createdAt) }}</dd>
              </div>
              <div v-if="item.soldAt" class="flex items-start justify-between gap-4">
                <dt class="text-gray-400">Sold</dt>
                <dd class="text-right font-semibold">{{ formatCommerceDate(item.soldAt) }}</dd>
              </div>
              <div v-if="item.returnedAt" class="flex items-start justify-between gap-4">
                <dt class="text-gray-400">Returned</dt>
                <dd class="text-right font-semibold">{{ formatCommerceDate(item.returnedAt) }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex items-center gap-3">
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700">
              <Icon name="lucide:shopping-bag" size="20" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Order</h3>
              <p class="text-sm text-gray-500">The sale linked to this exact unit.</p>
            </div>
          </div>

          <div v-if="item.order.id || item.order.orderNumber" class="mt-5 space-y-3">
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-500">Order Number</span>
              <span class="text-right font-bold text-gray-900">{{ item.order.orderNumber || item.order.id }}</span>
            </div>
            <div v-if="item.order.status" class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-500">Order Status</span>
              <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {{ formatPlainLabel(item.order.status) }}
              </span>
            </div>
            <div v-if="item.order.createdAt" class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-500">Order Date</span>
              <span class="text-right text-sm font-semibold text-gray-700">{{ formatCommerceDate(item.order.createdAt) }}</span>
            </div>
            <NuxtLink
              v-if="item.order.orderNumber"
              :to="{
                path: '/dashboard/orders',
                query: { search: item.order.orderNumber }
              }"
              class="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Open in Orders
              <Icon name="lucide:arrow-up-right" size="16" />
            </NuxtLink>
          </div>

          <p v-else class="mt-5 rounded-xl border border-dashed p-5 text-sm text-gray-500">
            This unit is not linked to a customer order.
          </p>
        </section>

        <section class="rounded-2xl bg-white p-6 shadow">
          <div class="flex items-center gap-3">
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-700">
              <Icon name="lucide:user-round" size="20" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Purchaser</h3>
              <p class="text-sm text-gray-500">Customer details from the linked order.</p>
            </div>
          </div>

          <div v-if="hasPurchaser" class="mt-5 space-y-3">
            <div class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-500">Name</span>
              <span class="text-right font-bold text-gray-900">{{ item.purchaser.name || item.customerName }}</span>
            </div>
            <div v-if="item.purchaser.email" class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-500">Email</span>
              <a
                :href="`mailto:${item.purchaser.email}`"
                class="break-all text-right text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {{ item.purchaser.email }}
              </a>
            </div>
            <div v-if="item.purchaser.phone" class="flex items-start justify-between gap-4">
              <span class="text-sm text-gray-500">Phone</span>
              <a
                :href="`tel:${item.purchaser.phone}`"
                class="text-right text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {{ item.purchaser.phone }}
              </a>
            </div>
          </div>

          <p v-else class="mt-5 rounded-xl border border-dashed p-5 text-sm text-gray-500">
            No purchaser is linked to this unit.
          </p>
        </section>
      </div>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="text-2xl font-bold">Return This Unit</h3>
            <p class="mt-1 text-sm text-gray-500">
              A sold unit can be returned to one warehouse. The server verifies its current state before changing stock.
            </p>
          </div>

          <button
            v-if="item.status === 'sold' && !returnFormOpen"
            type="button"
            class="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            @click="openReturnForm"
          >
            Start Return
          </button>
        </div>

        <div
          v-if="item.status !== 'sold'"
          class="mt-5 rounded-xl border border-dashed p-5 text-sm text-gray-500"
        >
          Return is unavailable because this unit is currently
          <strong>{{ formatSerializedItemStatus(item.status) }}</strong>.
          Only sold units can use this action.
        </div>

        <form v-else-if="returnFormOpen" class="mt-6" @submit.prevent="submitReturn">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label for="return-warehouse" class="mb-2 block text-sm font-semibold text-gray-700">
                Receiving Warehouse *
              </label>
              <select
                id="return-warehouse"
                v-model="returnForm.warehouse_id"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              >
                <option value="">Select warehouse</option>
                <option
                  v-for="warehouse in warehouseOptions"
                  :key="warehouse.id"
                  :value="warehouse.id"
                  :disabled="Boolean(item.product.primaryWarehouseId)
                    && warehouse.id !== item.product.primaryWarehouseId"
                >
                  {{ warehouse.name }}{{ warehouse.code ? ` · ${warehouse.code}` : '' }}
                </option>
              </select>
            </div>

            <div>
              <label for="return-reason" class="mb-2 block text-sm font-semibold text-gray-700">
                Return Reason *
              </label>
              <input
                id="return-reason"
                v-model="returnForm.reason"
                type="text"
                maxlength="200"
                placeholder="Customer return, unopened item..."
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div class="md:col-span-2">
              <label for="return-notes" class="mb-2 block text-sm font-semibold text-gray-700">
                Notes
              </label>
              <textarea
                id="return-notes"
                v-model="returnForm.notes"
                rows="4"
                maxlength="1000"
                placeholder="Optional receiving and inspection notes"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <p v-if="returnError" class="mt-4 text-sm text-red-600" role="alert">
            {{ returnError }}
          </p>

          <div class="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              :disabled="returnSaving"
              class="rounded-lg bg-amber-600 px-5 py-3 font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ returnSaving ? 'Recording Return...' : 'Confirm Unit Return' }}
            </button>
            <button
              type="button"
              :disabled="returnSaving"
              class="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              @click="closeReturnForm"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-2xl font-bold">Movement History</h3>
            <p class="mt-1 text-sm text-gray-500">
              Immutable status and warehouse events for this unit.
            </p>
          </div>
          <p class="text-sm font-semibold text-gray-500">
            {{ item.movements.length }} {{ item.movements.length === 1 ? 'event' : 'events' }}
          </p>
        </div>

        <div v-if="item.movements.length" class="mt-6 space-y-0">
          <article
            v-for="(movement, index) in item.movements"
            :key="movement.id || `${movement.createdAt}-${index}`"
            class="relative grid grid-cols-[32px_minmax(0,1fr)] gap-4 pb-6 last:pb-0"
          >
            <div class="relative flex justify-center">
              <span class="relative z-10 mt-1 grid h-8 w-8 place-items-center rounded-full bg-gray-900 text-white">
                <Icon :name="getMovementIcon(movement.movementType)" size="15" />
              </span>
              <span
                v-if="index < item.movements.length - 1"
                class="absolute bottom-0 top-8 w-px bg-gray-200"
                aria-hidden="true"
              />
            </div>

            <div class="rounded-2xl border bg-gray-50 p-4">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="font-bold text-gray-900">
                    {{ formatPlainLabel(movement.movementType) }}
                  </p>
                  <p v-if="movement.fromStatus || movement.toStatus" class="mt-1 text-sm text-gray-600">
                    <span v-if="movement.fromStatus">{{ formatSerializedItemStatus(movement.fromStatus) }}</span>
                    <span v-if="movement.fromStatus && movement.toStatus"> → </span>
                    <span v-if="movement.toStatus">{{ formatSerializedItemStatus(movement.toStatus) }}</span>
                  </p>
                </div>
                <p class="shrink-0 text-xs text-gray-400">{{ formatCommerceDate(movement.createdAt) }}</p>
              </div>

              <p v-if="movement.notes" dir="auto" class="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                {{ movement.notes }}
              </p>

              <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span v-if="movement.orderNumber">Order {{ movement.orderNumber }}</span>
                <span v-if="movement.actorName">By {{ movement.actorName }}</span>
              </div>
            </div>
          </article>
        </div>

        <p v-else class="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
          No movement events were returned for this item.
        </p>
      </section>
    </template>

    <section
      v-else
      class="rounded-2xl border border-dashed bg-white p-10 text-center shadow"
    >
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 text-gray-500">
        <Icon name="lucide:scan-search" size="28" />
      </div>
      <h3 class="mt-4 text-xl font-bold text-gray-900">Scan a unit to begin</h3>
      <p class="mx-auto mt-2 max-w-md text-sm text-gray-500">
        Item details remain hidden until an authorized lookup succeeds.
      </p>
    </section>
  </div>
</template>

<script setup>
import {
  formatCommerceDate,
  formatSerializedItemStatus,
  getSerializedItemStatusClass
} from '~/utils/commerce'

defineOptions({
  name: 'DashboardCommerceScanItemTab'
})

const supabase = useSupabaseClient()
const route = useRoute()
const tokenInputElement = ref(null)
const tokenInput = ref('')
const item = ref(null)
const lookupLoading = ref(false)
const lookupError = ref('')
const lastLookupToken = ref('')
const warehouseOptions = ref([])
const optionsError = ref('')
const returnFormOpen = ref(false)
const returnSaving = ref(false)
const returnError = ref('')
const returnMessage = ref('')

const returnForm = reactive({
  warehouse_id: '',
  reason: '',
  notes: ''
})

const hasPurchaser = computed(() => {
  return Boolean(
    item.value?.purchaser?.name
    || item.value?.customerName
    || item.value?.purchaser?.email
    || item.value?.purchaser?.phone
  )
})

const getAdminAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const getRelatedRecord = (record, keys = []) => {
  for (const key of keys) {
    const relatedValue = record?.[key]

    if (Array.isArray(relatedValue)) {
      if (relatedValue[0]) {
        return relatedValue[0]
      }

      continue
    }

    if (relatedValue && typeof relatedValue === 'object') {
      return relatedValue
    }
  }

  return {}
}

const normalizeMovement = (record = {}) => {
  return {
    id: String(record.id || ''),
    movementType: String(record.movement_type || record.movementType || record.event_type || 'status update'),
    fromStatus: String(record.from_status || record.fromStatus || ''),
    toStatus: String(record.to_status || record.toStatus || ''),
    notes: String(record.notes || ''),
    createdAt: String(record.created_at || record.createdAt || ''),
    orderNumber: String(record.order_number || record.orderNumber || ''),
    actorName: String(record.actor_name || record.actorName || '')
  }
}

const normalizeItem = (record = {}) => {
  const product = getRelatedRecord(record, ['product', 'products'])
  const variant = getRelatedRecord(record, ['variant', 'product_variant', 'product_variants'])
  const warehouse = getRelatedRecord(record, ['warehouse', 'commerce_warehouses'])
  const order = getRelatedRecord(record, ['order', 'customer_order', 'customer_orders'])
  const purchaser = getRelatedRecord(record, ['purchaser', 'customer', 'customer_profile'])
  const movements = Array.isArray(record.movements)
    ? record.movements
    : Array.isArray(record.history)
      ? record.history
      : []

  return {
    id: String(record.id || ''),
    unitCode: String(record.unit_code || record.unitCode || record.serial_number || 'Unassigned'),
    qrToken: String(record.qr_token || record.qrToken || ''),
    status: String(record.status || 'unknown').trim().toLowerCase(),
    createdAt: String(record.created_at || record.createdAt || ''),
    updatedAt: String(record.updated_at || record.updatedAt || ''),
    soldAt: String(record.sold_at || record.soldAt || ''),
    returnedAt: String(record.returned_at || record.returnedAt || ''),
    customerName: String(record.customer_name || record.customerName || ''),
    product: {
      id: String(product.id || record.product_id || ''),
      title: String(product.title || record.product_title || 'Unknown product'),
      sku: String(product.sku || record.product_sku || ''),
      primaryWarehouseId: String(
        product.primary_warehouse_id
        || product.primaryWarehouseId
        || record.primary_warehouse_id
        || ''
      )
    },
    variant: {
      id: String(variant.id || record.variant_id || ''),
      name: String(variant.name || record.variant_name || ''),
      code: String(variant.code || record.variant_code || ''),
      sku: String(variant.sku || record.variant_sku || ''),
      colorName: String(variant.color_name || variant.colorName || record.color_name || ''),
      colorHex: String(variant.color_hex || variant.colorHex || record.color_hex || '')
    },
    warehouse: {
      id: String(warehouse.id || record.warehouse_id || ''),
      name: String(warehouse.name || record.warehouse_name || '')
    },
    order: {
      id: String(order.id || record.order_id || ''),
      orderNumber: String(order.order_number || order.orderNumber || record.order_number || ''),
      status: String(order.status || record.order_status || ''),
      createdAt: String(order.created_at || order.createdAt || record.order_created_at || '')
    },
    purchaser: {
      name: String(purchaser.name || purchaser.full_name || record.customer_name || ''),
      email: String(purchaser.email || record.customer_email || ''),
      phone: String(purchaser.phone || record.customer_phone || '')
    },
    movements: movements
      .map(normalizeMovement)
      .sort((firstMovement, secondMovement) => {
        return new Date(secondMovement.createdAt).getTime() - new Date(firstMovement.createdAt).getTime()
      })
  }
}

const formatPlainLabel = (value) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return 'Unknown'
  }

  return normalizedValue
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const isValidHexColor = (value) => {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
}

const getMovementIcon = (movementType) => {
  const normalizedType = String(movementType || '').toLowerCase()

  if (normalizedType.includes('return')) {
    return 'lucide:undo-2'
  }

  if (normalizedType.includes('sale') || normalizedType.includes('sold')) {
    return 'lucide:shopping-cart'
  }

  if (normalizedType.includes('receive') || normalizedType.includes('create')) {
    return 'lucide:package-plus'
  }

  if (normalizedType.includes('damage')) {
    return 'lucide:triangle-alert'
  }

  if (normalizedType.includes('transfer') || normalizedType.includes('move')) {
    return 'lucide:arrow-left-right'
  }

  return 'lucide:history'
}

const normalizeScannedToken = (value) => {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return ''
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const scannedUrl = new URL(rawValue)
      const queryToken = scannedUrl.searchParams.get('token')

      if (queryToken) {
        return queryToken.trim()
      }

      const itemPathMatch = scannedUrl.pathname.match(/\/admin-inventory\/items\/([^/]+)\/?$/i)

      if (itemPathMatch?.[1]) {
        return decodeURIComponent(itemPathMatch[1]).trim()
      }

      return ''
    } catch {
      return ''
    }
  }

  return rawValue
}

const lookupItem = async (value, { preserveMessage = false } = {}) => {
  const token = normalizeScannedToken(value)

  if (!token) {
    lookupError.value = 'Enter a valid QR token or scan URL.'
    return
  }

  lookupLoading.value = true
  lookupError.value = ''
  returnError.value = ''

  if (!preserveMessage) {
    returnMessage.value = ''
  }

  try {
    const response = await $fetch(`/api/admin-inventory/items/${encodeURIComponent(token)}`, {
      headers: await getAdminAuthHeaders()
    })
    const payload = response?.data && typeof response.data === 'object'
      ? response.data
      : response || {}
    const itemRecord = payload.item || payload
    const normalizedItem = normalizeItem(itemRecord)

    if (!normalizedItem.id) {
      throw new Error('The item lookup returned an incomplete record.')
    }

    item.value = normalizedItem
    tokenInput.value = token
    lastLookupToken.value = token
    returnFormOpen.value = false
    returnForm.warehouse_id = normalizedItem.product.primaryWarehouseId
      || normalizedItem.warehouse.id
      || ''
    returnForm.reason = ''
    returnForm.notes = ''
  } catch (error) {
    item.value = null
    lastLookupToken.value = ''
    lookupError.value = error?.data?.statusMessage || error?.message || 'Could not find this serialized item.'
  } finally {
    lookupLoading.value = false
    await nextTick()
    tokenInputElement.value?.focus()
    tokenInputElement.value?.select()
  }
}

const loadWarehouseOptions = async () => {
  optionsError.value = ''

  try {
    const response = await $fetch('/api/admin-inventory/options', {
      headers: await getAdminAuthHeaders()
    })
    const payload = response?.data && typeof response.data === 'object'
      ? response.data
      : response || {}

    warehouseOptions.value = (Array.isArray(payload.warehouses) ? payload.warehouses : []).map((warehouse) => ({
      id: String(warehouse.id || ''),
      name: String(warehouse.name || 'Unnamed warehouse'),
      code: String(warehouse.code || '')
    })).filter((warehouse) => warehouse.id)
  } catch (error) {
    optionsError.value = error?.data?.statusMessage || error?.message || 'Could not load return warehouses.'
  }
}

const openReturnForm = async () => {
  if (item.value?.status !== 'sold') {
    return
  }

  if (!warehouseOptions.value.length) {
    await loadWarehouseOptions()
  }

  returnForm.warehouse_id = item.value.product.primaryWarehouseId
    || item.value.warehouse.id
    || returnForm.warehouse_id
  returnForm.reason = ''
  returnForm.notes = ''
  returnError.value = optionsError.value
  returnFormOpen.value = true
}

const closeReturnForm = () => {
  if (returnSaving.value) {
    return
  }

  returnFormOpen.value = false
  returnError.value = ''
}

const submitReturn = async () => {
  if (!item.value?.id || item.value.status !== 'sold' || returnSaving.value) {
    return
  }

  const warehouseId = String(returnForm.warehouse_id || '').trim()
  const reason = String(returnForm.reason || '').trim()

  if (!warehouseId) {
    returnError.value = 'Select the warehouse that physically received this unit.'
    return
  }

  if (!reason) {
    returnError.value = 'Enter a return reason.'
    return
  }

  const receivingWarehouse = warehouseOptions.value.find((warehouse) => warehouse.id === warehouseId)
  const shouldReturn = window.confirm(
    `Return unit ${item.value.unitCode} to ${receivingWarehouse?.name || 'the selected warehouse'}?`
  )

  if (!shouldReturn) {
    return
  }

  returnSaving.value = true
  returnError.value = ''
  returnMessage.value = ''

  try {
    const response = await $fetch(`/api/admin-inventory/items/${encodeURIComponent(item.value.id)}/return`, {
      method: 'POST',
      headers: await getAdminAuthHeaders(),
      body: {
        warehouse_id: warehouseId,
        reason,
        notes: String(returnForm.notes || '').trim() || null
      }
    })
    const payload = response?.data && typeof response.data === 'object'
      ? response.data
      : response || {}
    const returnReference = payload.returnId
      ? ` Return reference: ${payload.returnId}.`
      : ''

    returnMessage.value = `Unit ${item.value.unitCode} was returned to ${receivingWarehouse?.name || 'inventory'}.${returnReference}`
    returnFormOpen.value = false
    await lookupItem(lastLookupToken.value, {
      preserveMessage: true
    })
  } catch (error) {
    returnError.value = error?.data?.statusMessage || error?.message || 'Could not return this unit.'
  } finally {
    returnSaving.value = false
  }
}

onMounted(async () => {
  await loadWarehouseOptions()

  const routeToken = Array.isArray(route.query.token)
    ? route.query.token[0]
    : route.query.token

  if (routeToken) {
    tokenInput.value = String(routeToken)
    await lookupItem(routeToken)
  } else {
    await nextTick()
    tokenInputElement.value?.focus()
  }
})

watch(() => route.query.token, async (nextToken) => {
  if (!import.meta.client || !nextToken) {
    return
  }

  const normalizedToken = normalizeScannedToken(Array.isArray(nextToken) ? nextToken[0] : nextToken)

  if (normalizedToken && normalizedToken !== lastLookupToken.value) {
    tokenInput.value = normalizedToken
    await lookupItem(normalizedToken)
  }
})
</script>
