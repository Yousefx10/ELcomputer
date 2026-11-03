<template>
  <section class="rounded-2xl border bg-gray-50 p-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="text-lg font-bold text-gray-900">{{ $t('common.productVariants') }}</h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ $t('dashboard.products.giveEachColorANameAddItsPicturesUnderExtraImagesAfterSaving') }}
        </p>
      </div>

      <button
        type="button"
        :disabled="disabled"
        class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        @click="addVariant"
      >
        <Icon name="lucide:plus" size="17" />
        {{ $t('common.addVariant') }}
      </button>
    </div>

    <p
      v-if="!rows.length"
      class="mt-5 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500"
    >
      {{ $t('dashboard.products.addAnOptionUseDefaultIfThereAreNoVariations') }}
    </p>

    <div v-else class="mt-5 space-y-4">
      <article
        v-for="(row, index) in rows"
        :key="row._key"
        class="rounded-2xl border bg-white p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="font-bold text-gray-900">{{ $t('common.variantValue', { value0: (index + 1) }) }}</p>

          <button
            type="button"
            :disabled="disabled || rows.length <= 1"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            :aria-label="$t('common.removeVariantValue', { value0: (index + 1) })"
            :title="rows.length <= 1 ? $t('dashboard.products.everyProductRequiresAtLeastOneVariant') : undefined"
            @click="removeVariant(index)"
          >
            <Icon name="lucide:trash-2" size="16" />
            {{ $t('common.remove') }}
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label
              :for="fieldId(row, 'name')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              {{ $t('common.variantName') }}
            </label>
            <input
              :id="fieldId(row, 'name')"
              v-model="row.name"
              type="text"
              maxlength="120"
              :disabled="disabled"
              :placeholder="$t('common.exampleBlack16Gb')"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'name')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'code')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              {{ $t('common.optionCode') }}
            </label>
            <input
              :id="fieldId(row, 'code')"
              v-model="row.code"
              type="text"
              maxlength="80"
              :disabled="disabled"
              :placeholder="$t('common.exampleBlack16')"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'code')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'sku')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              {{ $t('common.variantSku') }}
            </label>
            <input
              :id="fieldId(row, 'sku')"
              v-model="row.sku"
              type="text"
              maxlength="120"
              :disabled="disabled"
              :placeholder="$t('common.uniqueSku')"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'sku')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'color-name')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              {{ $t('common.colorName') }}
            </label>
            <input
              :id="fieldId(row, 'color-name')"
              v-model="row.color_name"
              type="text"
              maxlength="80"
              :disabled="disabled"
              :placeholder="$t('common.exampleMidnightBlack')"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              @blur="trimField(row, 'color_name')"
            >
          </div>

          <div>
            <label
              :for="fieldId(row, 'color-hex')"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              {{ $t('common.color') }}
            </label>
            <div class="flex gap-2">
              <input
                :id="fieldId(row, 'color-picker')"
                type="color"
                :value="pickerColor(row.color_hex)"
                :disabled="disabled"
                class="h-12 w-14 shrink-0 cursor-pointer rounded-lg border bg-white p-1 disabled:cursor-not-allowed disabled:bg-gray-100"
                :aria-label="$t('dashboard.products.chooseColorForVariantValue', { value0: (index + 1) })"
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

        </div>
        <div class="mt-4 border-t pt-4">
          <label :for="fieldId(row, 'sale-price')" class="block text-sm font-semibold">{{ $t('modernProduct.priceOverride') }}</label>
          <input :id="fieldId(row, 'sale-price')" v-model="row.sale_price" type="text" inputmode="decimal" maxlength="13" :disabled="disabled" class="mt-2 w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 sm:max-w-xs">
          <p class="mt-1 text-xs text-gray-500">{{ $t('modernProduct.inheritPrice') }}</p>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2"><h4 class="text-sm font-semibold">{{ $t('modernProduct.attributes') }}</h4><button type="button" :disabled="disabled || row._attributes.length >= 8" class="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50" @click="row._attributes.push({ name: '', value: '' })">{{ $t('modernProduct.addAttribute') }}</button></div>
          <p class="mt-1 text-xs text-gray-500">{{ $t('modernProduct.attributeHelp') }}</p>
          <div v-for="(attribute, attributeIndex) in row._attributes" :key="attributeIndex" class="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label class="text-xs font-medium" :for="fieldId(row, `attribute-${attributeIndex}`)">{{ $t('modernProduct.attribute') }}<input :id="fieldId(row, `attribute-${attributeIndex}`)" v-model="attribute.name" :list="fieldId(row, 'attribute-names')" maxlength="60" :disabled="disabled" class="mt-1 min-h-11 w-full rounded-lg border bg-white p-2" @blur="attribute.name = attribute.name.trim()"></label>
            <label class="text-xs font-medium" :for="fieldId(row, `value-${attributeIndex}`)">{{ $t('modernProduct.value') }}<input :id="fieldId(row, `value-${attributeIndex}`)" v-model="attribute.value" maxlength="120" :disabled="disabled" class="mt-1 min-h-11 w-full rounded-lg border bg-white p-2" @blur="attribute.value = attribute.value.trim()"></label>
            <button type="button" :disabled="disabled" :aria-label="$t('modernProduct.removeAttribute')" class="min-h-11 self-end rounded-lg border px-3 text-red-600 disabled:opacity-50" @click="row._attributes.splice(attributeIndex, 1)"><Icon name="lucide:x" size="16" aria-hidden="true" /></button>
          </div>
          <datalist :id="fieldId(row, 'attribute-names')"><option v-for="key in optionDimensionKeys" :key="key" :value="key">{{ $t(`modernProduct.options.${key}`) }}</option></datalist>
        </div>
      </article>
    </div>

    <div
      v-if="rows.length"
      class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"
    >
      <span class="font-medium text-gray-500">
        {{ rows.length }} {{ rows.length === 1 ? $t('common.variant') : 'variants' }}
      </span>
      <span class="font-semibold text-blue-700">
        {{ $t('dashboard.products.stockAndItemIdsAreCreatedThroughProcurement') }}
      </span>
    </div>
  </section>
</template>

<script setup>
import { optionDimensionKeys, validOptionValues } from '~/utils/productOptions'
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

const rowOptions = row => {
  if (!row._attributes) return row.option_values === undefined ? {} : row.option_values
  const entries = row._attributes.map(item => [item.name, item.value])
  const value = Object.fromEntries(entries)
  return new Set(entries.map(([name]) => name.toLowerCase())).size === entries.length && validOptionValues(value) ? value : entries
}
const toPublicRow = (row = {}) => ({
  id: row.id ? String(row.id) : null,
  name: String(row.name || ''),
  code: String(row.code || ''),
  sku: String(row.sku || ''),
  color_name: String(row.color_name || ''),
  color_hex: normalizeHexValue(row.color_hex),
  sale_price: row.sale_price ?? '',
  option_values: rowOptions(row)
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
      _attributes: (Array.isArray(normalizedRow.option_values) ? normalizedRow.option_values : Object.entries(normalizedRow.option_values || {})).map(([name, value]) => ({ name, value })),
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
    sale_price: '',
    _attributes: [],
    _key: createRowKey()
  })
}

const removeVariant = (index) => {
  if (props.disabled || rows.value.length <= 1) {
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

const fieldId = (row, suffix) => {
  return `${row._key}-${suffix}`
}

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
