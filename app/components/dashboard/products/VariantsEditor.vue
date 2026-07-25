<template>
  <section class="rounded-2xl border bg-gray-50 p-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="text-lg font-bold text-gray-900">Product Variants</h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ existingMode
            ? 'Update each option and its available quantity.'
            : 'Add color or model options and set the quantity available for each one.' }}
        </p>
      </div>

      <button
        type="button"
        :disabled="disabled"
        class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        @click="addVariant"
      >
        <Icon name="lucide:plus" size="17" />
        Add Variant
      </button>
    </div>

    <p
      v-if="!rows.length"
      class="mt-5 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500"
    >
      No variants added. The product will continue using its main color and stock quantity.
    </p>

    <div v-else class="mt-5 space-y-4">
      <article
        v-for="(row, index) in rows"
        :key="row._key"
        class="rounded-2xl border bg-white p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="font-bold text-gray-900">Variant {{ index + 1 }}</p>

          <button
            type="button"
            :disabled="disabled"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            :aria-label="`Remove variant ${index + 1}`"
            @click="removeVariant(index)"
          >
            <Icon name="lucide:trash-2" size="16" />
            Remove
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label
              :for="fieldId(row, 'name')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Variant Name *
            </label>
            <input
              :id="fieldId(row, 'name')"
              v-model="row.name"
              type="text"
              maxlength="120"
              :disabled="disabled"
              placeholder="Example: Black / 16 GB"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'name')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'code')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Option Code
            </label>
            <input
              :id="fieldId(row, 'code')"
              v-model="row.code"
              type="text"
              maxlength="80"
              :disabled="disabled"
              placeholder="Example: BLACK-16"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'code')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'sku')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Variant SKU
            </label>
            <input
              :id="fieldId(row, 'sku')"
              v-model="row.sku"
              type="text"
              maxlength="120"
              :disabled="disabled"
              placeholder="Unique SKU"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'sku')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'color-name')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Color Name
            </label>
            <input
              :id="fieldId(row, 'color-name')"
              v-model="row.color_name"
              type="text"
              maxlength="80"
              :disabled="disabled"
              placeholder="Example: Midnight Black"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'color_name')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'color-hex')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Color
            </label>
            <div class="flex gap-2">
              <input
                :id="fieldId(row, 'color-picker')"
                type="color"
                :value="pickerColor(row.color_hex)"
                :disabled="disabled"
                class="h-12 w-14 shrink-0 cursor-pointer rounded-lg border bg-white p-1 disabled:cursor-not-allowed disabled:bg-gray-100"
                :aria-label="`Choose color for variant ${index + 1}`"
                @input="setPickerColor(row, $event)"
              >
              <input
                :id="fieldId(row, 'color-hex')"
                v-model="row.color_hex"
                type="text"
                maxlength="7"
                :disabled="disabled"
                placeholder="#000000"
                class="min-w-0 flex-1 rounded-lg border bg-white p-3 uppercase outline-none focus:border-blue-500 disabled:bg-gray-100"
                @blur="normalizeHexField(row)"
              >
            </div>
          </div>

          <div>
            <label
              :for="fieldId(row, 'quantity')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Stock Quantity *
            </label>
            <input
              :id="fieldId(row, 'quantity')"
              v-model.number="row.quantity"
              type="number"
              min="0"
              max="1000"
              step="1"
              :disabled="disabled"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="normalizeQuantity(row)"
            >
          </div>
        </div>
      </article>
    </div>

    <div
      v-if="rows.length"
      class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"
    >
      <span class="font-medium text-gray-500">
        {{ rows.length }} {{ rows.length === 1 ? 'variant' : 'variants' }}
      </span>
      <span class="font-bold text-gray-900">
        Total quantity: {{ totalQuantity }}
      </span>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  existingMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

let nextRowKey = 0
const rows = ref([])

const createRowKey = () => {
  nextRowKey += 1
  return `variant-row-${nextRowKey}`
}

const normalizeQuantityValue = (value) => {
  const quantity = Number.parseInt(value, 10)
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : 0
}

const normalizeHexValue = (value) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return ''
  }

  const withHash = normalizedValue.startsWith('#')
    ? normalizedValue
    : `#${normalizedValue}`

  return /^#[0-9a-f]{6}$/i.test(withHash)
    ? withHash.toUpperCase()
    : normalizedValue.toUpperCase()
}

const toPublicRow = (row = {}) => ({
  id: row.id ? String(row.id) : null,
  name: String(row.name || ''),
  code: String(row.code || ''),
  sku: String(row.sku || ''),
  color_name: String(row.color_name || ''),
  color_hex: normalizeHexValue(row.color_hex),
  quantity: normalizeQuantityValue(row.quantity ?? row.stock_quantity)
})

const serializeRows = (value = rows.value) => {
  return value.map(toPublicRow)
}

const rowsMatch = (left, right) => {
  return JSON.stringify(serializeRows(left)) === JSON.stringify(serializeRows(right))
}

const hydrateRows = (value) => {
  const incomingRows = Array.isArray(value) ? value : []

  return incomingRows.map((row, index) => {
    const existingRow = rows.value[index]
    const normalizedRow = toPublicRow(row)

    return {
      ...normalizedRow,
      _key: (
        normalizedRow.id
        && existingRow?.id === normalizedRow.id
        && existingRow?._key
      ) || existingRow?._key || createRowKey()
    }
  })
}

const emitRows = () => {
  emit('update:modelValue', serializeRows())
}

const addVariant = () => {
  if (props.disabled) {
    return
  }

  rows.value.push({
    id: null,
    name: '',
    code: '',
    sku: '',
    color_name: '',
    color_hex: '',
    quantity: 0,
    _key: createRowKey()
  })
}

const removeVariant = (index) => {
  if (props.disabled) {
    return
  }

  rows.value.splice(index, 1)
}

const trimField = (row, field) => {
  row[field] = String(row[field] || '').trim()
}

const pickerColor = (value) => {
  const normalizedValue = normalizeHexValue(value)
  return /^#[0-9A-F]{6}$/.test(normalizedValue) ? normalizedValue : '#000000'
}

const setPickerColor = (row, event) => {
  row.color_hex = String(event?.target?.value || '').toUpperCase()
}

const normalizeHexField = (row) => {
  row.color_hex = normalizeHexValue(row.color_hex)
}

const normalizeQuantity = (row) => {
  row.quantity = normalizeQuantityValue(row.quantity)
}

const fieldId = (row, suffix) => {
  return `${row._key}-${suffix}`
}

const totalQuantity = computed(() => {
  return rows.value.reduce((total, row) => {
    return total + normalizeQuantityValue(row.quantity)
  }, 0)
})

watch(
  () => props.modelValue,
  (nextRows) => {
    if (rowsMatch(rows.value, nextRows)) {
      return
    }

    rows.value = hydrateRows(nextRows)
  },
  {
    deep: true,
    immediate: true
  }
)

watch(
  rows,
  () => {
    emitRows()
  },
  {
    deep: true
  }
)
</script>
