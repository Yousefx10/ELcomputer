<template>
  <section class="border-b px-4 py-3 text-sm" data-catalog-transfer>
    <button
      type="button"
      :disabled="locked"
      class="font-semibold text-blue-700 hover:underline disabled:opacity-50"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ $t('catalogTransfer.title') }}
    </button>
    <div v-if="open" class="mt-3 space-y-3">
      <p class="text-xs text-gray-600">{{ $t('catalogTransfer.readOnly') }}</p>
      <fieldset :disabled="busy || locked" class="flex min-w-0 flex-wrap items-end gap-3">
        <div>
          <label
            for="catalog-export-format"
            class="mb-1 block text-xs font-semibold text-gray-700"
            >{{ $t('catalogTransfer.format') }}</label
          ><select
            id="catalog-export-format"
            v-model="format"
            class="rounded-lg border bg-white p-2 text-sm text-gray-900"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
        </div>
        <div>
          <label
            for="catalog-export-scope"
            class="mb-1 block text-xs font-semibold text-gray-700"
            >{{ $t('catalogTransfer.scope') }}</label
          ><select
            id="catalog-export-scope"
            v-model="scope"
            class="max-w-full rounded-lg border bg-white p-2 text-sm text-gray-900"
          >
            <option value="selected">
              {{ $t('catalogTransfer.selected', { count: selected.length }) }}
            </option>
            <option value="filtered">{{ $t('catalogTransfer.filtered', { count: total }) }}</option>
          </select>
        </div>
        <button
          type="button"
          :disabled="loading || (scope === 'selected' ? !selected.length : total > 250)"
          class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
          @click="download(false)"
        >
          {{ $t('catalogTransfer.export') }}
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-sm text-gray-700"
          @click="download(true)"
        >
          {{ $t('catalogTransfer.template') }}
        </button>
      </fieldset>
      <p class="text-xs text-gray-500">{{ $t('catalogTransfer.exportHelp') }}</p>
      <fieldset
        v-if="canPreview"
        :disabled="busy || locked"
        class="flex min-w-0 flex-wrap items-end gap-3"
      >
        <div class="min-w-0">
          <label
            for="catalog-preview-file"
            class="mb-1 block text-xs font-semibold text-gray-700"
            >{{ $t('catalogTransfer.file') }}</label
          ><input
            id="catalog-preview-file"
            ref="input"
            type="file"
            accept=".csv,.xlsx"
            class="max-w-full text-xs text-gray-700"
            @change="chooseFile"
          />
        </div>
        <button
          type="button"
          :disabled="!file"
          class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
          @click="preview"
        >
          {{ $t('catalogTransfer.preview') }}
        </button>
      </fieldset>
      <p v-if="canPreview" class="text-xs text-gray-500">{{ $t('catalogTransfer.fileHelp') }}</p>
      <div v-if="busy" class="flex flex-wrap items-center gap-3">
        <p role="status" class="text-xs text-gray-600">{{ $t('catalogTransfer.processing') }}</p>
        <button type="button" class="text-xs underline" @click="cancel">
          {{ $t('common.cancel') }}
        </button>
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-600">{{ errorText }}</p>
      <p v-if="notice" role="status" class="text-xs text-gray-600">
        {{ $t('catalogTransfer.downloaded') }}
      </p>
      <div v-if="result" data-catalog-preview>
        <p class="text-sm font-semibold text-gray-900" role="status">
          {{ $t('catalogTransfer.productResults', result.products) }}
        </p>
        <p class="mt-1 text-xs text-gray-600">
          {{
            $t('catalogTransfer.rowResults', {
              count: result.row_count,
              invalid: result.rows.invalid,
              conflicted: result.rows.conflicted,
              missing: result.missing_references,
              duplicates: result.duplicates,
              references: result.rows.reference,
            })
          }}
        </p>
        <p class="mt-1 text-xs text-gray-500">{{ $t('catalogTransfer.matchHelp') }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ $t('catalogTransfer.omitHelp') }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ $t('catalogTransfer.warehouseHelp') }}</p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-start text-xs">
            <thead class="border-b bg-gray-50 text-gray-600">
              <tr>
                <th class="p-2 text-start">{{ $t('catalogTransfer.row') }}</th>
                <th class="p-2 text-start">{{ $t('productList.product') }}</th>
                <th class="p-2 text-start">{{ $t('catalogTransfer.result') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, i) in pageItems"
                :key="`${item.table}-${item.row}-${i}`"
                class="border-b"
              >
                <td class="p-2 align-top">{{ tableLabel(item.table) }} · {{ item.row }}</td>
                <td class="max-w-48 break-words p-2 align-top text-gray-900">
                  {{ item.title || item.product_key || item.id }}
                </td>
                <td class="p-2 align-top">
                  <p
                    :class="
                      ['invalid', 'conflicted'].includes(item.status)
                        ? 'text-red-600'
                        : 'text-gray-700'
                    "
                  >
                    {{ statusLabel(item.status) }}
                  </p>
                  <ul v-if="item.errors.length" class="mt-1 space-y-1 text-red-600">
                    <li v-for="(issue, j) in item.errors" :key="j">
                      <span dir="ltr">{{ issue.field }}:</span> {{ fieldError(issue.code) }}
                    </li>
                  </ul>
                  <details v-if="item.changes.length" class="mt-1 text-gray-600">
                    <summary class="cursor-pointer">
                      {{ $t('catalogTransfer.fields', { count: item.changes.length }) }}
                    </summary>
                    <ul>
                      <li
                        v-for="change in item.changes"
                        :key="change.field"
                        class="mt-1 max-w-60 break-words"
                      >
                        <span dir="ltr">{{ change.field }}</span
                        >:
                        {{
                          change.kind === 'clear'
                            ? $t('catalogTransfer.clear')
                            : display(change.before) + ' → ' + display(change.after)
                        }}
                      </li>
                    </ul>
                  </details>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav
          class="mt-2 flex items-center justify-between gap-3"
          :aria-label="$t('catalogTransfer.pages')"
        >
          <button
            type="button"
            :disabled="page <= 1"
            class="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
            @click="page--"
          >
            {{ $t('common.previous') }}
          </button>
          <p class="text-xs text-gray-600">{{ $t('productList.page', { page, pages }) }}</p>
          <button
            type="button"
            :disabled="page >= pages"
            class="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
            @click="page++"
          >
            {{ $t('common.next') }}
          </button>
        </nav>
      </div>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
const props = defineProps({
  selected: { type: Array, required: true },
  filters: { type: Object, required: true },
  total: { type: Number, default: 0 },
  locked: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['busy'])
const { t } = useI18n(),
  { adminUser, hasPermission } = useAdminAccess(),
  { getAdminAuthHeaders } = useAdminLogs()
const canPreview = computed(() => hasPermission('products.add') || hasPermission('products.edit'))
const open = ref(false),
  format = ref('xlsx'),
  scope = ref('selected'),
  file = ref(null),
  input = ref(null),
  busy = ref(false),
  error = ref(''),
  notice = ref(false),
  result = ref(null),
  page = ref(1)
const visibleItems = computed(
  () => result.value?.items.filter((item) => item.status !== 'reference') || [],
)
const pages = computed(() => Math.max(1, Math.ceil(visibleItems.value.length / 50))),
  pageItems = computed(() => visibleItems.value.slice((page.value - 1) * 50, page.value * 50))
let generation = 0,
  controller
const cancel = () => {
  generation++
  controller?.abort()
  busy.value = false
  emit('busy', false)
}
const chooseFile = () => {
  error.value = ''
  notice.value = false
  result.value = null
  const selected = input.value?.files?.[0]
  if (selected && selected.size <= 4 * 1024 * 1024 && /\.(csv|xlsx)$/i.test(selected.name))
    file.value = selected
  else {
    file.value = null
    error.value = 'file'
  }
}
const run = async (action) => {
  if (busy.value || props.locked) return
  const id = ++generation
  controller = new AbortController()
  busy.value = true
  emit('busy', true)
  error.value = ''
  notice.value = false
  try {
    const headers = await getAdminAuthHeaders()
    if (id !== generation) return
    await action(headers, controller.signal, id)
  } catch (e) {
    if (id !== generation) return
    let details = e?.data
    // ofetch also decodes download errors as blobs. Read only a small JSON
    // error envelope; never display arbitrary response content.
    if (details instanceof Blob && details.size <= 16000) {
      try {
        details = JSON.parse(await details.text())
      } catch {
        details = null
      }
    }
    if (id !== generation) return
    const status = e?.statusCode || e?.response?.status
    error.value = [401, 403].includes(status)
      ? 'permission'
      : status === 413
        ? 'limit'
        : details?.data?.catalogTransferError || 'failed'
  } finally {
    if (id === generation) {
      busy.value = false
      emit('busy', false)
    }
  }
}
const download = (template) => {
  const requestedFormat = format.value,
    requestedScope = scope.value
  const selectedIds = props.selected.map((product) => product.id)
  const filters = { ...props.filters }
  delete filters.page
  return run(async (headers, signal, id) => {
    const blob = await $fetch(
      template ? '/api/admin-products/transfer/template' : '/api/admin-products/transfer/export',
      {
        headers,
        signal,
        retry: 0,
        timeout: 20000,
        responseType: 'blob',
        ...(template
          ? { query: { format: requestedFormat } }
          : {
              method: 'POST',
              body: {
                format: requestedFormat,
                scope: requestedScope,
                ids: requestedScope === 'selected' ? selectedIds : [],
                filters: Object.fromEntries(
                  Object.entries(filters).filter(
                    ([key, value]) => key !== 'page' && typeof value === 'string',
                  ),
                ),
              },
            }),
      },
    )
    if (id !== generation) return
    const url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download = `catalog-v1-${template ? 'template' : requestedScope}.${requestedFormat}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice.value = true
  })
}
const preview = () => {
  if (!file.value) return
  const source = file.value,
    fileFormat = source.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx'
  return run(async (headers, signal, id) => {
    const data = await $fetch('/api/admin-products/transfer/preview', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/octet-stream' },
      query: { format: fileFormat },
      body: source,
      signal,
      retry: 0,
      timeout: 30000,
    })
    if (id !== generation) return
    if (
      data?.read_only !== true ||
      !Array.isArray(data.items) ||
      data.items.length > 6000 ||
      !data.products ||
      !data.rows
    )
      throw Error('Invalid preview')
    result.value = data
    page.value = 1
    file.value = null
    if (input.value) input.value.value = ''
  })
}
watch(
  () =>
    JSON.stringify([
      adminUser.value?.id,
      adminUser.value?.is_active,
      adminUser.value?.permissions,
      adminUser.value?.role,
    ]),
  () => {
    cancel()
    file.value = null
    result.value = null
    error.value = ''
    notice.value = false
    open.value = false
    if (input.value) input.value.value = ''
  },
)
watch(open, (value) => {
  if (!value) {
    cancel()
    file.value = null
    result.value = null
    error.value = ''
    notice.value = false
    if (input.value) input.value.value = ''
  }
})
onBeforeUnmount(cancel)
const errorText = computed(() =>
  error.value === 'permission'
    ? t('catalogTransfer.permission')
    : error.value === 'limit'
      ? t('catalogTransfer.limit')
      : error.value === 'file'
        ? t('catalogTransfer.fileError')
        : error.value === 'excel_cell'
          ? t('catalogTransfer.excelCell')
          : [
                'formula',
                'workbook',
                'content',
                'encoding',
                'csv',
                'headers',
                'columns',
                'structure',
                'version',
              ].includes(error.value)
            ? t('catalogTransfer.structureError')
            : t('catalogTransfer.failed'),
)
const statusLabel = (status) =>
  status === 'create'
    ? t('catalogTransfer.create')
    : status === 'update'
      ? t('catalogTransfer.update')
      : status === 'unchanged'
        ? t('productBulk.unchanged')
        : status === 'conflicted'
          ? t('catalogTransfer.conflicted')
          : status === 'reference'
            ? t('catalogTransfer.reference')
            : t('catalogTransfer.invalid')
const tableLabel = (table) =>
  table === 'Products'
    ? t('productList.title')
    : table === 'Variants'
      ? t('catalogTransfer.variants')
      : table === 'Specifications'
        ? t('common.specifications')
        : table === 'Images'
          ? t('catalogTransfer.images')
          : table === 'Categories'
            ? t('catalogTransfer.categories')
            : table === 'Brands'
              ? t('catalogTransfer.brands')
              : t('catalogTransfer.definitions')
const fieldError = (code) =>
  code === 'required'
    ? t('catalogTransfer.required')
    : code === 'conflict'
      ? t('catalogTransfer.conflictError')
      : code === 'reference_missing'
        ? t('catalogTransfer.missingReference')
        : code === 'duplicate'
          ? t('catalogTransfer.duplicate')
          : code === 'permission'
            ? t('catalogTransfer.permission')
            : code === 'cannot_clear'
              ? t('catalogTransfer.cannotClear')
              : code === 'readonly'
                ? t('catalogTransfer.readonlyField')
                : code === 'text_required'
                  ? t('catalogTransfer.textRequired')
                  : code === 'warehouse'
                    ? t('catalogTransfer.warehouse')
                    : code === 'readiness'
                      ? t('catalogTransfer.readiness')
                      : code === 'image'
                        ? t('catalogTransfer.image')
                        : code === 'options' || code === 'variant' || code === 'gallery'
                          ? t('catalogTransfer.optionError')
                          : code === 'related'
                            ? t('catalogTransfer.related')
                            : code === 'legacy'
                              ? t('catalogTransfer.legacy')
                              : code === 'missing' || code === 'parent'
                                ? t('catalogTransfer.missingRecord')
                                : t('catalogTransfer.fieldError')
const display = (value) =>
  value == null
    ? '—'
    : String(value).length > 180
      ? String(value).slice(0, 180) + '…'
      : String(value)
</script>
