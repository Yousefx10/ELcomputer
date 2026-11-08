<template>
  <section class="overflow-hidden rounded-2xl bg-white shadow" data-product-links>
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-5">
      <div>
        <h3 class="text-xl font-bold">{{ $t('erp.productLinks') }}</h3>
        <p class="mt-1 text-sm text-gray-500">{{ $t('erp.productLinksHint') }}</p>
      </div>
      <button type="button" class="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50" :disabled="loading || !!saving" @click="load(true)">
        <Icon name="lucide:refresh-cw" size="16" :class="loading ? 'animate-spin' : ''" />{{ $t('erp.refreshDaftra') }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
      <button v-for="key in FILTERS" :key="key" type="button" class="rounded-full px-3 py-1.5 text-sm font-semibold"
        :class="filter === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" :aria-pressed="filter === key" @click="filter = key">
        {{ $t(`erp.filter_${key}`) }} <span class="ms-1 opacity-80">{{ counts[key] }}</span>
      </button>
      <label class="ms-auto flex items-center gap-2 text-sm text-gray-600"><input v-model="publishedOnly" type="checkbox">{{ $t('erp.publishedOnly') }}</label>
      <input v-model="search" type="search" :placeholder="$t('erp.searchProducts')" class="w-full rounded-xl border border-gray-200 p-2 text-sm sm:w-56">
    </div>

    <div v-if="counts.code && (filter === 'code' || filter === 'needs')" class="flex flex-wrap items-center justify-between gap-3 bg-blue-50 p-4 text-sm">
      <p class="text-blue-900">{{ $t('erp.codeMatchesReady', { value0: counts.code }) }}</p>
      <button type="button" class="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50" :disabled="!!saving" @click="linkAllCode">{{ saving === 'bulk' ? $t('common.saving') : $t('erp.linkAllCode') }}</button>
    </div>

    <p v-if="notice" class="m-4 rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status">{{ notice }}</p>
    <p v-if="error" class="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{{ $uiMessage(error) }}</p>
    <p v-if="loading && !rows.length" class="p-8 text-sm text-gray-500">{{ $t('common.loading') }}</p>

    <div class="divide-y divide-gray-100">
      <article v-for="row in pageRows" :key="row.variantId" class="flex flex-wrap items-center gap-4 p-4">
        <div class="flex min-w-0 flex-1 basis-64 items-center gap-3">
          <img v-if="row.image" :src="row.image" alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy">
          <div class="min-w-0">
            <p class="truncate font-semibold text-gray-900">{{ row.title }}</p>
            <p class="truncate text-xs text-gray-500">{{ isDefault(row.option) ? '' : row.option }}<span v-if="!row.published" class="ms-2 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{{ $t('common.draft') }}</span></p>
          </div>
        </div>

        <div class="min-w-0 flex-1 basis-64">
          <template v-if="picker !== row.variantId">
            <div v-if="current(row)" class="flex flex-wrap items-center gap-2">
              <span v-if="!row.link" class="rounded-full px-2 py-0.5 text-xs font-bold" :class="row.suggestion.reason === 'code' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'">{{ $t(row.suggestion.reason === 'code' ? 'erp.filter_code' : 'erp.filter_name') }}</span>
              <span class="min-w-0 truncate text-sm" :class="row.link ? 'font-semibold text-gray-900' : 'text-gray-700'">{{ current(row).name }}</span>
              <span class="text-xs text-gray-500" dir="ltr">{{ current(row).code }}</span>
            </div>
            <p v-else class="text-sm text-gray-500">{{ $t('erp.notLinked') }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button v-if="!row.link && row.suggestion" type="button" class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50" :disabled="!!saving" @click="save([{ variantId: row.variantId, daftraId: row.suggestion.daftraId, source: row.suggestion.reason }])">{{ $t('erp.link') }}</button>
              <button type="button" class="rounded-lg border px-3 py-1.5 text-sm font-bold disabled:opacity-50" :disabled="!!saving" @click="openPicker(row)">{{ $t(row.link ? 'erp.change' : 'erp.choose') }}</button>
              <button v-if="row.link" type="button" class="rounded-lg px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" :disabled="!!saving" @click="save([{ variantId: row.variantId, daftraId: null }])">{{ $t('erp.unlink') }}</button>
              <button v-if="!row.link && confirmCreate !== row.variantId" type="button" class="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50" :disabled="!!saving" @click="confirmCreate = row.variantId">{{ $t('erp.createInDaftra') }}</button>
            </div>
            <div v-if="!row.link && confirmCreate === row.variantId" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              <span>{{ $t('erp.createInDaftraConfirm') }}</span>
              <button type="button" class="rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white disabled:opacity-50" :disabled="!!saving" @click="createInDaftra(row)">{{ saving === row.variantId ? $t('common.saving') : $t('erp.create') }}</button>
              <button type="button" class="rounded-lg px-3 py-1.5 font-semibold text-gray-700 hover:bg-white" :disabled="!!saving" @click="confirmCreate = null">{{ $t('common.cancel') }}</button>
            </div>
          </template>
          <div v-else class="space-y-2">
            <input ref="pickerInput" v-model="pickerQuery" type="search" :placeholder="$t('erp.searchDaftra')" class="w-full rounded-lg border p-2 text-sm" @keydown.esc="picker = null">
            <ul class="max-h-64 divide-y overflow-y-auto rounded-lg border" role="listbox">
              <li v-for="item in pickerResults" :key="item.id">
                <button type="button" class="w-full px-3 py-2 text-start text-sm hover:bg-blue-50 disabled:opacity-50" :disabled="!!saving" @click="save([{ variantId: row.variantId, daftraId: item.id }])">
                  <span class="block">{{ item.name }}</span><span class="text-xs text-gray-500" dir="ltr">{{ item.code }}</span>
                </button>
              </li>
              <li v-if="!pickerResults.length" class="px-3 py-2 text-sm text-gray-500">{{ $t('erp.noDaftraMatches') }}</li>
            </ul>
            <button type="button" class="text-sm font-semibold text-gray-600" @click="picker = null">{{ $t('common.cancel') }}</button>
          </div>
        </div>
      </article>
      <p v-if="!loading && !filtered.length" class="p-10 text-center text-sm text-gray-500">{{ $t('erp.noRows') }}</p>
    </div>

    <nav v-if="pages > 1" class="flex items-center justify-center gap-3 border-t border-gray-100 p-4">
      <button type="button" class="rounded-lg border bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-40" :disabled="page <= 1" @click="page--">{{ $t('common.previous') }}</button>
      <span class="text-sm text-gray-600">{{ $t('common.pageValueOfValue', { value0: page, value1: pages }) }}</span>
      <button type="button" class="rounded-lg border bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-40" :disabled="page >= pages" @click="page++">{{ $t('common.next') }}</button>
    </nav>
  </section>
</template>

<script setup>
import { nameTokens } from '~/utils/daftraLinkSearch'

const { t } = useI18n()
const supabase = useSupabaseClient()
const FILTERS = ['needs', 'code', 'name', 'linked', 'all']
const PAGE_SIZE = 40
const rows = ref([]), daftra = ref([]), loading = ref(false), saving = ref(''), error = ref(''), notice = ref('')
const filter = ref('needs'), publishedOnly = ref(true), search = ref(''), page = ref(1), picker = ref(null), pickerQuery = ref(''), pickerInput = ref(null), confirmCreate = ref(null)

const daftraById = computed(() => new Map(daftra.value.map(item => [item.id, item])))
const isDefault = option => ['', 'default'].includes(String(option || '').trim().toLowerCase())
const current = row => daftraById.value.get(row.link?.daftraId || row.suggestion?.daftraId || '') || null
const matchesFilter = (row, key) => key === 'all' || (key === 'linked' ? !!row.link : !row.link && (key === 'needs' || row.suggestion?.reason === key))
const scoped = computed(() => rows.value.filter(row => !publishedOnly.value || row.published))
const counts = computed(() => Object.fromEntries(FILTERS.map(key => [key, scoped.value.filter(row => matchesFilter(row, key)).length])))
const filtered = computed(() => {
  const words = nameTokens(search.value)
  return scoped.value.filter(row => matchesFilter(row, filter.value) && (!words.length || words.every(word =>
    nameTokens(`${row.title} ${row.option} ${current(row)?.name || ''} ${current(row)?.code || ''}`).some(token => token.includes(word)))))
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const pickerResults = computed(() => {
  const words = nameTokens(pickerQuery.value)
  return daftra.value.filter(item => !words.length || words.every(word => nameTokens(`${item.name} ${item.code}`).some(token => token.includes(word)))).slice(0, 12)
})
watch([filter, publishedOnly, search], () => { page.value = 1 })

async function headers() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
async function load(refresh = false) {
  loading.value = true; error.value = ''
  try {
    const result = await $fetch('/api/admin-erp/product-links', { headers: await headers(), query: refresh ? { refresh: '1' } : {} })
    rows.value = result.rows || []; daftra.value = result.daftra || []
  } catch (failure) { error.value = failure?.data?.statusMessage || 'Product links are unavailable.' }
  finally { loading.value = false }
}
async function save(links, mode = 'row') {
  saving.value = mode; error.value = ''; notice.value = ''
  try {
    let saved = 0, requeued = 0
    for (let i = 0; i < links.length; i += 500) {
      const result = await $fetch('/api/admin-erp/product-links', { method: 'POST', headers: await headers(), body: { links: links.slice(i, i + 500) } })
      saved += result?.saved || 0; requeued += result?.requeued || 0
    }
    picker.value = null
    notice.value = [saved ? t('erp.linksSaved', { value0: saved }) : t('erp.linkRemoved'), requeued ? t('erp.billsRetry', { value0: requeued }) : ''].filter(Boolean).join(' ')
    await load()
  } catch (failure) { error.value = failure?.data?.statusMessage || 'Product links could not be saved. Reload and try again.' }
  finally { saving.value = '' }
}
// Creates the Daftra product, then links this option to it.
async function createInDaftra(row) {
  saving.value = row.variantId; error.value = ''; notice.value = ''
  try {
    const result = await $fetch('/api/admin-erp/product-create', { method: 'POST', headers: await headers(), body: { variantId: row.variantId } })
    confirmCreate.value = null
    notice.value = [t('erp.createdInDaftra'), result?.requeued ? t('erp.billsRetry', { value0: result.requeued }) : ''].filter(Boolean).join(' ')
    await load(true)
  } catch (failure) { error.value = failure?.data?.statusMessage || 'The product could not be created in Daftra.' }
  finally { saving.value = '' }
}
const linkAllCode = () => save(scoped.value.filter(row => !row.link && row.suggestion?.reason === 'code')
  .map(row => ({ variantId: row.variantId, daftraId: row.suggestion.daftraId, source: 'code' })), 'bulk')
async function openPicker(row) {
  picker.value = row.variantId
  pickerQuery.value = row.link ? '' : row.title.split(/\s+/).slice(0, 3).join(' ')
  await nextTick(); (Array.isArray(pickerInput.value) ? pickerInput.value[0] : pickerInput.value)?.focus()
}
onMounted(() => load())
</script>
