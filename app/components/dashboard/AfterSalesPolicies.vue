<script setup>
import { afterSalesFields } from '~/utils/afterSalesFields'
const props = defineProps({ canEdit: Boolean })
const { request } = useSupportClient()
const { t, locale } = useI18n()
const route = useUiRoute()
const initial = ['category', 'product'].includes(route.query.scope) ? route.query.scope : 'warranty'
const tab = ref(initial)
const tabs = ['warranty', 'returns', 'category', 'product', 'reasons']
const scope = computed(() => ['category', 'product'].includes(tab.value) ? tab.value : 'global')
const selectedId = ref(String(route.query.id || ''))
const search = ref(''), catalog = ref([]), loading = ref(false), saving = ref(false), message = ref(''), error = ref('')
const record = ref({}), effective = ref(null), parent = ref(null), values = ref({}), reasons = ref([]), reason = ref(null)
const fields = computed(() => afterSalesFields.filter(field => scope.value !== 'global' || field.group === tab.value || field.group === 'shared'))
let sequence = 0
const fail = err => { error.value = t(err?.statusCode === 409 || err?.data?.statusCode === 409 ? 'afterSales.stale' : 'afterSales.error') }
const searchCatalog = async () => { const kind = scope.value; try { const result = await request('/api/admin-after-sales/catalog', { query: { kind: scope.value, q: search.value } }); if (scope.value === kind) catalog.value = result.items } catch (err) { fail(err) } }
const load = async () => {
  const current = ++sequence
  loading.value = true; error.value = ''; message.value = ''; effective.value = null
  try {
    if (tab.value === 'reasons') { const result = await request('/api/admin-after-sales/reasons'); if (current === sequence) { reasons.value = result.reasons; reason.value = null } }
    else {
      if (scope.value !== 'global') await searchCatalog()
      if (current !== sequence) return
      if (scope.value !== 'global' && !selectedId.value) return
      const result = await request('/api/admin-after-sales/policy', { query: { scope: scope.value, ...(scope.value !== 'global' ? { id: selectedId.value } : {}) } })
      if (current !== sequence) return
      record.value = result.record; effective.value = result.effective; parent.value = result.parent
      if (result.scope_item && !catalog.value.some(item => item.id === result.scope_item.id)) catalog.value.unshift(result.scope_item)
      values.value = Object.fromEntries(fields.value.map(field => [field.key, result.record[field.key] ?? null]))
    }
  } catch (err) { if (current === sequence) fail(err) } finally { if (current === sequence) loading.value = false }
}
const changeTab = next => { if (saving.value) return; tab.value = next; selectedId.value = ''; search.value = ''; load() }
const save = async () => {
  if (!props.canEdit || saving.value || !effective.value) return
  saving.value = true; error.value = ''; message.value = ''
  try { await request('/api/admin-after-sales/policy', { method: 'PATCH', body: { scope: scope.value, ...(scope.value !== 'global' ? { id: selectedId.value } : {}), section: scope.value === 'global' ? tab.value : 'overrides', revision: record.value.revision, values: values.value } }); await load(); if (!error.value) message.value = t('afterSales.saved') } catch (err) { fail(err) } finally { saving.value = false }
}
const editReason = item => { reason.value = item ? { key: item.key, label_en: item.label_en, label_ar: item.label_ar, is_enabled: item.is_enabled, sort_order: item.sort_order, fault: item.fault, shipping: item.shipping, opened: item.opened, evidence: item.evidence, revision: item.revision } : { key: '', label_en: '', label_ar: '', is_enabled: true, sort_order: 10, fault: 'neutral', shipping: null, opened: null, evidence: null, revision: 0 }; error.value = ''; message.value = '' }
const saveReason = async () => {
  if (!props.canEdit || saving.value) return
  saving.value = true; error.value = ''
  try { await request('/api/admin-after-sales/reasons', { method: 'POST', body: reason.value }); await load(); if (!error.value) message.value = t('afterSales.saved') } catch (err) { fail(err) } finally { saving.value = false }
}
const display = value => Array.isArray(value) ? (value.map(item => t(`afterSales.values.${item}`)).join('، ') || t('afterSales.emptyList')) : typeof value === 'boolean' ? t(value ? 'afterSales.enabled' : 'afterSales.disabled') : typeof value === 'number' || String(value).includes('/') ? value : t(`afterSales.values.${value}`)
watch(() => [route.query.scope, route.query.id], ([nextScope, nextId]) => { if (['category', 'product'].includes(nextScope) && !saving.value) { tab.value = nextScope; selectedId.value = String(nextId || ''); search.value = ''; load() } })
onMounted(load)
</script>

<template>
  <section class="space-y-5" data-after-sales>
    <div><h2 class="text-xl font-bold text-slate-900">{{ $t('afterSales.title') }}</h2><p class="mt-1 text-sm text-slate-600">{{ $t('afterSales.intro') }}</p></div>
    <nav class="flex flex-wrap gap-2" :aria-label="$t('afterSales.title')">
      <button v-for="item in tabs" :key="item" type="button" :data-policy-tab="item" :aria-pressed="tab === item" :disabled="saving" class="rounded-lg border px-3 py-2 text-sm font-medium" :class="tab === item ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-700'" @click="changeTab(item)">{{ $t(`afterSales.tabs.${item}`) }}</button>
    </nav>
    <p v-if="!canEdit" class="text-sm text-slate-600">{{ $t('afterSales.readOnly') }}</p>
    <p v-if="error" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    <p v-if="message" role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{{ message }}</p>
    <div v-if="scope !== 'global'" class="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <form class="flex gap-2" @submit.prevent="searchCatalog"><input v-model="search" :aria-label="$t('afterSales.search')" maxlength="80" class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><button class="rounded-lg border px-3 py-2 text-slate-700">{{ $t('common.search') }}</button></form>
      <select v-model="selectedId" :disabled="saving || loading" data-policy-scope class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" :aria-label="$t(`afterSales.tabs.${scope}`)" @change="load"><option value="">{{ $t('afterSales.choose') }}</option><option v-for="item in catalog" :key="item.id" :value="item.id">{{ item.title || (locale === 'ar' && item.name_ar ? item.name_ar : item.name) }}</option></select>
    </div>
    <p v-if="loading" role="status" class="text-sm text-slate-600">{{ $t('common.loading') }}</p>
    <template v-else-if="effective && tab !== 'reasons'">
      <p v-if="scope === 'global' && !effective.policy[tab === 'warranty' ? 'warranty_configured' : 'return_configured']" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{{ $t('afterSales.draft') }}</p>
      <p class="text-sm text-slate-600">{{ $t('afterSales.durationNote') }}</p>
      <div class="grid gap-3 md:grid-cols-2"><DashboardAfterSalesPolicyField v-for="field in fields" :key="field.key" v-model="values[field.key]" :field="field" :scoped="scope !== 'global'" :inherited-value="parent?.policy[field.key]" :disabled="!canEdit || saving" /></div>
      <p class="text-sm text-slate-600">{{ $t('afterSales.dateNote') }}</p>
      <div class="flex gap-3"><button type="button" data-policy-save :disabled="!canEdit || saving" class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" @click="save">{{ $t('common.save') }}</button><button type="button" :disabled="saving" class="rounded-lg border px-4 py-2 text-sm text-slate-700" @click="load">{{ $t('afterSales.reload') }}</button></div>
      <details class="rounded-xl border border-slate-200 bg-white p-4" data-policy-effective><summary class="cursor-pointer text-sm font-semibold text-slate-900">{{ $t('afterSales.effective') }}</summary><p class="mt-2 text-sm text-slate-600">{{ $t('afterSales.savedPreview') }}</p><dl class="mt-3 space-y-3"><div v-for="field in fields" :key="field.key" class="flex flex-wrap justify-between gap-2 text-sm"><dt class="text-slate-600">{{ $t(`afterSales.fields.${field.key}`) }}</dt><dd class="text-slate-900">{{ display(effective.policy[field.key]) }} <span class="text-slate-600">({{ $t(`afterSales.sources.${effective.sources[field.key]}`) }})</span></dd></div></dl></details>
    </template>
    <div v-else-if="!loading && tab === 'reasons'" class="space-y-4">
      <button type="button" :disabled="!canEdit || saving || reasons.length >= 50" class="rounded-lg border px-4 py-2 text-sm text-slate-700 disabled:opacity-50" @click="editReason(null)">{{ $t('afterSales.addReason') }}</button>
      <div class="space-y-2"><button v-for="item in reasons" :key="item.key" type="button" :data-reason="item.key" class="flex w-full flex-wrap justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-start text-sm text-slate-900" @click="editReason(item)"><span>{{ $i18n.locale === 'ar' ? item.label_ar : item.label_en }}</span><span class="text-slate-600">{{ item.sort_order }} · {{ $t(item.is_enabled ? 'afterSales.enabled' : 'afterSales.disabled') }}</span></button></div>
      <form v-if="reason" class="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-reason-form @submit.prevent="saveReason">
        <fieldset :disabled="!canEdit || saving" class="grid gap-3 md:grid-cols-2">
          <label v-for="key in ['key', 'label_en', 'label_ar', 'sort_order']" :key="key" class="text-sm text-slate-700">{{ $t(`afterSales.reason.${key}`) }}<input v-model="reason[key]" :type="key === 'sort_order' ? 'number' : 'text'" :disabled="key === 'key' && reason.revision > 0" :min="key === 'sort_order' ? 0 : undefined" :max="key === 'sort_order' ? 10000 : undefined" :maxlength="key === 'key' ? 64 : 160" required :dir="key === 'label_ar' ? 'rtl' : 'ltr'" :data-reason-field="key" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"></label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="reason.is_enabled" type="checkbox" data-reason-field="is_enabled">{{ $t('afterSales.enabled') }}</label>
          <label v-for="(options, key) in { fault: ['customer', 'seller', 'neutral'], shipping: ['elcomputer', 'customer', 'manual'], opened: ['allowed', 'not_allowed', 'manual'], evidence: ['disabled', 'optional', 'required'] }" :key="key" class="text-sm text-slate-700">{{ $t(`afterSales.reason.${key}`) }}<select v-model="reason[key]" :data-reason-field="key" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option v-if="key !== 'fault'" :value="null">{{ $t('afterSales.inherit') }}</option><option v-for="option in options" :key="option" :value="option">{{ $t(`afterSales.values.${option}`) }}</option></select></label>
        </fieldset>
        <button :disabled="!canEdit || saving" class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{{ $t('common.save') }}</button>
      </form>
    </div>
  </section>
</template>
