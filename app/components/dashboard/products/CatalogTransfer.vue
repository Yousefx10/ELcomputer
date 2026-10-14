<template>
  <section class="border-b px-4 py-3 text-sm" data-catalog-transfer>
    <NuxtLinkLocale
      v-if="!working"
      :to="transferLink"
      class="me-4 font-semibold text-blue-700 hover:underline"
      >{{ $t('catalogImport.open') }}</NuxtLinkLocale
    >
    <button
      v-if="!working"
      type="button"
      :disabled="locked"
      class="font-semibold text-blue-700 hover:underline disabled:opacity-50"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ $t('catalogImport.exports') }}
    </button>
    <div v-if="open" class="mt-3 space-y-3">
      <p v-if="working" class="text-xs text-gray-600">{{ $t('catalogImport.help') }}</p>
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
        v-if="working && canPreview"
        :disabled="busy || locked"
        class="flex min-w-0 flex-wrap items-end gap-3"
      >
        <div v-if="hasPermission('products.add')">
          <label
            for="catalog-import-warehouse"
            class="mb-1 block text-xs font-semibold text-gray-700"
            >{{ $t('catalogImport.warehouse') }}</label
          >
          <select
            id="catalog-import-warehouse"
            v-model="warehouse"
            :disabled="Boolean(job)"
            class="max-w-64 rounded-lg border bg-white p-2 text-sm text-gray-900"
          >
            <option value="">{{ $t('catalogImport.chooseWarehouse') }}</option>
            <option v-for="option in warehouses" :key="option.id" :value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
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
      <p v-if="working && canPreview" class="text-xs text-gray-500">
        {{ $t('catalogTransfer.fileHelp') }}
      </p>
      <div v-if="working && job" class="space-y-3 border-t pt-3" data-catalog-job>
        <p class="text-sm font-semibold text-gray-900" role="status">
          {{ $t('catalogImport.results', job.counts) }}
        </p>
        <p class="break-all text-xs text-gray-500">
          {{ $t('catalogImport.receipt') }}: <span dir="ltr">{{ job.id }}</span>
        </p>
        <p class="text-xs text-gray-600">
          {{
            $t('catalogImport.expiry', { time: new Date(job.expires_at).toLocaleString(locale) })
          }}
        </p>
        <p v-if="job.closed_reason" class="text-xs text-gray-600">
          {{ importMessage(job.closed_reason) }}
        </p>
        <p v-if="!result && job.counts.pending" class="text-xs text-gray-600">
          {{ $t('catalogImport.reupload') }}
        </p>
        <fieldset v-if="!job.approved && job.counts.pending" :disabled="busy" class="space-y-2">
          <label class="flex items-start gap-2 text-sm text-gray-700"
            ><input v-model="confirmed" type="checkbox" class="mt-1" data-import-confirm />{{
              $t('catalogImport.confirm', { count: job.items.length })
            }}</label
          >
          <label v-if="job.publish_count" class="flex items-start gap-2 text-sm text-gray-700"
            ><input v-model="publishAccepted" type="checkbox" class="mt-1" data-import-publish />{{
              $t('catalogImport.publish', { count: job.publish_count })
            }}</label
          >
        </fieldset>
        <div class="flex flex-wrap gap-3">
          <button
            v-if="job.counts.pending"
            type="button"
            :disabled="
              busy ||
              !file ||
              (!job.approved &&
                (!result ||
                  result.rows.invalid ||
                  result.rows.conflicted ||
                  !confirmed ||
                  (job.publish_count && !publishAccepted)))
            "
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-import-apply
            @click="applyReviewed"
          >
            {{ $t(job.approved ? 'catalogImport.resume' : 'catalogImport.apply') }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            data-import-status
            @click="checkJob"
          >
            {{ $t('catalogImport.check') }}
          </button>
          <button
            v-if="job.counts.pending"
            type="button"
            :disabled="busy"
            class="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            data-import-close
            @click="closeJob"
          >
            {{ $t('catalogImport.cancel') }}
          </button>
          <template v-else>
            <button
              v-if="job.counts.failed || job.counts.conflicted"
              type="button"
              :disabled="busy"
              class="rounded-lg border px-3 py-2 text-sm text-gray-700"
              data-import-retry
              @click="reviewFailed"
            >
              {{ $t('catalogImport.retry') }}
            </button>
            <button
              type="button"
              :disabled="busy"
              class="rounded-lg border px-3 py-2 text-sm text-gray-700"
              @click="newReview"
            >
              {{ $t('catalogImport.new') }}
            </button>
          </template>
        </div>
        <details>
          <summary class="cursor-pointer text-xs text-gray-700">
            {{ $t('productBulk.details') }}
          </summary>
          <ul class="mt-2 space-y-2 text-xs text-gray-700">
            <li v-for="item in job.items" :key="item.product_key" class="flex flex-wrap gap-2">
              <span class="break-all" dir="auto">{{ item.product_key }}</span
              ><span>{{ importStatus(item.status) }}</span
              ><span v-if="item.reason" class="text-red-600">{{ importMessage(item.reason) }}</span
              ><NuxtLinkLocale
                v-if="item.result_id && hasPermission('products.edit')"
                :to="'/dashboard/products/edit/' + item.result_id"
                class="text-blue-700 hover:underline"
                >{{ $t('common.edit') }}</NuxtLinkLocale
              >
            </li>
          </ul>
        </details>
      </div>
      <p v-if="retryOf" class="text-xs text-gray-600">{{ $t('catalogImport.retryHelp') }}</p>
      <div v-if="busy" class="flex flex-wrap items-center gap-3">
        <p role="status" class="text-xs text-gray-600">{{ $t('catalogTransfer.processing') }}</p>
        <button type="button" class="text-xs underline" @click="pause">
          {{ $t(job?.approved ? 'catalogImport.pause' : 'common.cancel') }}
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({
  working: { type: Boolean, default: false },
  selected: { type: Array, required: true },
  filters: { type: Object, required: true },
  total: { type: Number, default: 0 },
  locked: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['busy'])
const { t, locale } = useI18n(),
  { adminUser, hasPermission } = useAdminAccess(),
  { getAdminAuthHeaders } = useAdminLogs()
const { invalidate } = useDashboardCache()
const canPreview = computed(() => hasPermission('products.add') || hasPermission('products.edit'))
const open = ref(props.working),
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
const job = ref(null),
  warehouse = ref(''),
  warehouses = ref([]),
  confirmed = ref(false),
  publishAccepted = ref(false),
  retryOf = ref(''),
  requestId = ref('')
const transferLink = computed(() => ({
  path: '/dashboard/products/transfer',
  query: {
    ...Object.fromEntries(
      Object.entries(props.filters).filter(
        ([key, value]) => key !== 'page' && typeof value === 'string',
      ),
    ),
    ...(props.selected.length ? { ids: props.selected.map((p) => p.id).join(',') } : {}),
  },
}))
const storageKey = () => 'catalog-import:' + adminUser.value?.id
const remember = () => {
  try {
    sessionStorage.setItem(
      storageKey(),
      JSON.stringify({
        id: job.value?.id || requestId.value,
        warehouse: warehouse.value,
        retryOf: retryOf.value,
      }),
    )
  } catch {}
}
const acceptJob = (data) => {
  if (
    !data ||
    !Array.isArray(data.items) ||
    data.items.length > 250 ||
    !data.counts ||
    !data.review_hash
  )
    throw Error('Invalid import receipt')
  const statuses = ['succeeded', 'unchanged', 'conflicted', 'failed', 'pending']
  if (
    !/^[a-f0-9-]{36}$/i.test(data.id || '') ||
    !/^[a-f0-9]{64}$/.test(data.review_hash) ||
    !/^[a-f0-9]{64}$/.test(data.source_hash || '') ||
    typeof data.approved !== 'boolean' ||
    new Set(data.items.map((item) => item.product_key)).size !== data.items.length ||
    statuses.some(
      (status) =>
        !Number.isInteger(data.counts[status]) ||
        data.counts[status] !== data.items.filter((item) => item.status === status).length,
    ) ||
    statuses.reduce((sum, status) => sum + data.counts[status], 0) !== data.items.length ||
    data.items.some(
      (item) =>
        ['succeeded', 'unchanged'].includes(item.status) &&
        (!/^[a-f0-9-]{36}$/i.test(item.result_id || '') ||
          !Number.isSafeInteger(item.revision) ||
          item.revision < 0),
    )
  )
    throw Error('Invalid import receipt')
  job.value = data
  if (data.counts.succeeded > 0) {
    invalidate('dashboard:products:')
    invalidate('dashboard:home')
  }
  requestId.value = data.id
  warehouse.value = data.warehouse_id || ''
  remember()
}
const api = '/api/admin-products/transfer/import'
const importStatus = (status) =>
  ({
    succeeded: t('catalogImport.succeeded'),
    unchanged: t('catalogImport.unchanged'),
    conflicted: t('catalogImport.conflicted'),
    failed: t('catalogImport.failed'),
    pending: t('catalogImport.pending'),
  })[status]
const importMessage = (code) =>
  t(
    'catalogImport.messages.' +
      ([
        'cancelled',
        'expired',
        'conflict',
        'identifier',
        'reference',
        'media',
        'history',
        'retry',
        'validation',
      ].includes(code)
        ? code
        : 'validation'),
  )
let generation = 0,
  controller
const cancel = () => {
  generation++
  controller?.abort()
  busy.value = false
  emit('busy', false)
}
const pause = () => {
  cancel()
  if (job.value?.approved) checkJob()
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
        : details?.data?.catalogImportError || details?.data?.catalogTransferError || 'failed'
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
    requestId.value ||= crypto.randomUUID()
    remember()
    const data = await $fetch(api, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/octet-stream' },
      query: {
        format: fileFormat,
        job_id: requestId.value,
        ...(warehouse.value ? { warehouse_id: warehouse.value } : {}),
        ...(retryOf.value ? { retry_of: retryOf.value } : {}),
      },
      body: source,
      signal,
      retry: 0,
      timeout: 30000,
    })
    if (id !== generation) return
    if (data.preview) {
      if (
        data.preview.read_only !== true ||
        !Array.isArray(data.preview.items) ||
        data.preview.items.length > 6000
      )
        throw Error('Invalid preview')
      result.value = data.preview
      page.value = 1
    }
    if (data.job) acceptJob(data.job)
    else {
      job.value = null
      requestId.value = ''
      remember()
    }
    confirmed.value = false
    publishAccepted.value = false
  })
}
const checkJob = () =>
  run(async (headers, signal, id) => {
    if (!requestId.value) return
    const data = await $fetch(api, {
      headers,
      signal,
      query: { job_id: requestId.value },
      retry: 0,
      timeout: 30000,
    })
    if (id === generation) acceptJob(data)
  })
const applyReviewed = () => {
  if (
    !job.value ||
    !file.value ||
    (!job.value.approved &&
      (!result.value ||
        result.value.rows.invalid ||
        result.value.rows.conflicted ||
        !confirmed.value ||
        (job.value.publish_count && !publishAccepted.value)))
  )
    return
  const source = file.value,
    fileFormat = source.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx'
  return run(async (headers, signal, id) => {
    if (!job.value.approved) {
      const data = await $fetch(api + '/approve', {
        method: 'POST',
        headers,
        body: {
          job_id: job.value.id,
          review_hash: job.value.review_hash,
          publish: publishAccepted.value,
        },
        signal,
        retry: 0,
        timeout: 30000,
      })
      if (id !== generation) return
      acceptJob(data)
    }
    while (job.value.counts.pending && id === generation) {
      const data = await $fetch(api + '/apply', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/octet-stream' },
        query: { job_id: job.value.id, review_hash: job.value.review_hash, format: fileFormat },
        body: source,
        signal,
        retry: 0,
        timeout: 120000,
      })
      if (id !== generation) return
      acceptJob(data)
    }
    if (!job.value.counts.pending) {
      file.value = null
      if (input.value) input.value.value = ''
    }
  })
}
const closeJob = () =>
  run(async (headers, signal, id) => {
    const data = await $fetch(api + '/cancel', {
      method: 'POST',
      headers,
      body: { job_id: job.value.id, review_hash: job.value.review_hash },
      signal,
      retry: 0,
      timeout: 30000,
    })
    if (id === generation) acceptJob(data)
  })
const newReview = () => {
  warehouse.value = ''
  job.value = null
  result.value = null
  requestId.value = ''
  retryOf.value = ''
  confirmed.value = false
  publishAccepted.value = false
  file.value = null
  error.value = ''
  if (input.value) input.value.value = ''
  try {
    sessionStorage.removeItem(storageKey())
  } catch {}
}
const reviewFailed = () => {
  const parent = job.value.id
  newReview()
  retryOf.value = parent
  remember()
}
const restore = async () => {
  if (!props.working || !canPreview.value) return
  const actor = adminUser.value?.id
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey()) || 'null')
    if (/^[a-f0-9-]{36}$/i.test(saved?.id || '')) {
      requestId.value = saved.id
      warehouse.value = saved.warehouse || ''
      retryOf.value = saved.retryOf || ''
    }
  } catch {}
  await run(async (headers, signal, id) => {
    const options = await $fetch(api, { headers, signal, retry: 0 })
    if (id !== generation || actor !== adminUser.value?.id) return
    warehouses.value = options
    if (requestId.value) {
      try {
        const data = await $fetch(api, {
          headers,
          signal,
          query: { job_id: requestId.value },
          retry: 0,
        })
        if (id === generation) acceptJob(data)
      } catch (e) {
        if ((e?.statusCode || e?.response?.status) !== 404) throw e
      }
    }
  })
}
onMounted(restore)

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
    open.value = props.working
    job.value = null
    warehouse.value = ''
    warehouses.value = []
    requestId.value = ''
    retryOf.value = ''
    confirmed.value = false
    publishAccepted.value = false
    restore()
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
  [
    'source',
    'stale',
    'reused',
    'expired',
    'warehouse',
    'approval',
    'retry',
    'publication',
  ].includes(error.value)
    ? t('catalogImport.errors.' + error.value)
    : error.value === 'permission'
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
              : job.value?.approved
                ? t('catalogImport.unconfirmed')
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
