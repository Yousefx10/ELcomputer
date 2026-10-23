<template>
  <section class="tariff-manager rounded-xl border p-4" :aria-label="t('title')">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h4 class="font-bold">{{ t('title') }} · {{ company.name }}</h4><p class="mt-1 text-sm">{{ t('checkoutHeld') }}</p></div>
      <button type="button" class="tariff-button" @click="close">{{ t('close') }}</button>
    </div>
    <p v-if="loading" class="mt-4" role="status">{{ t('loading') }}</p>
    <p v-if="error" class="mt-4 text-red-600" role="alert">{{ t(error) }}</p>
    <p v-if="message" class="mt-3 text-green-700" role="status">{{ t(message) }}</p>
    <div class="my-4 flex flex-wrap gap-3">
      <label>{{ t('version') }}<select :value="selected?.id || ''" :disabled="busy" @change="openVersion($event)"><option value="">{{ t('newDraft') }}</option><option v-for="v in versions" :key="v.id" :value="v.id">{{ v.version }} · {{ v.title }} · {{ t(v.status) }}</option></select></label>
      <button type="button" class="tariff-button" :disabled="busy" @click="newDraft">{{ t('newDraft') }}</button>
      <button type="button" class="tariff-button" :disabled="busy" @click="reload">{{ t('reload') }}</button>
      <button type="button" class="tariff-button" :disabled="!form.title" @click="exportDraft">{{ t('export') }}</button>
      <label class="tariff-button">{{ t('import') }}<input type="file" accept=".json,application/json" class="sr-only" :disabled="busy || readOnly" @change="importFile"></label>
    </div>
    <template v-if="ready">
      <p class="text-sm font-semibold">{{ selected ? t(selected.viewed_status || selected.status) : t('draft') }} · {{ t('revision') }} {{ selected?.viewed_revision || 0 }}</p>
      <p v-if="readOnly" class="my-3 text-sm">{{ t('frozen') }}</p>
      <form class="mt-4 space-y-4" @submit.prevent="save(false)">
        <fieldset :disabled="busy || readOnly" class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label>{{ t('name') }}<input v-model="form.title" maxlength="120" required></label>
            <label>{{ t('product') }}<input v-model.number="form.product_id" type="number" min="1" list="tariff-products"><datalist id="tariff-products"><option v-for="p in context.products" :key="p.id" :value="p.id">{{ p.name }}</option></datalist></label>
            <label>{{ t('from') }}<input v-model="form.effective_from" type="date"></label>
            <label>{{ t('until') }}<input v-model="form.effective_until" type="date"></label>
            <label>{{ t('baseWeight') }}<input v-model="form.base_weight_kg" inputmode="decimal" required></label>
            <label>{{ t('divisor') }}<input v-model.number="form.volumetric_divisor" type="number" min="1" required></label>
            <label>{{ t('weightRounding') }}<select v-model="form.extra_weight_rounding"><option v-for="r in tariffRounding" :key="r" :value="r">{{ t(r) }}</option></select></label>
            <label>{{ t('vat') }}<input v-model="form.vat_percent" inputmode="decimal" required></label>
            <label>{{ t('vatScope') }}<select v-model="form.vat_scope"><option v-for="r in tariffVatScopes" :key="r" :value="r">{{ t(r) }}</option></select></label>
            <label>{{ t('cod') }}<input v-model="form.cod_percent" inputmode="decimal" required></label>
            <label>{{ t('codBasis') }}<select v-model="form.cod_basis"><option v-for="basis in ['unverified','collected_amount','declared_value']" :key="basis" :value="basis">{{ t(basis) }}</option></select></label>
            <label>{{ t('insurance') }}<input v-model="form.insurance_percent" inputmode="decimal" required></label>
            <label>{{ t('failed') }}<input v-model="form.failed_delivery_percent" inputmode="decimal" required></label>
            <label>{{ t('failedBasis') }}<select v-model="form.failed_delivery_basis"><option v-for="basis in ['unverified','freight_ex_vat','freight_inc_vat']" :key="basis" :value="basis">{{ t(basis) }}</option></select></label>
            <label>{{ t('invoice') }}<input v-model.number="form.invoice_days" type="number" min="0" max="365" required></label>
            <label>{{ t('annualReview') }}<input v-model="form.annual_review_month_day" placeholder="MM-DD" maxlength="5"></label>
          </div>
          <p class="text-sm">{{ t('weightFormula') }}</p><p class="text-sm">{{ t('noIncrease') }}</p>
          <label class="block">{{ t('source') }}<textarea v-model="form.source_note" rows="2" maxlength="2000" /></label>
          <label class="tariff-check"><input v-model="form.insurance_enabled" type="checkbox">{{ t('insuranceSelected') }}</label>
          <div class="overflow-x-auto">
            <table class="w-full text-sm"><thead><tr><th>{{ t('zone') }}</th><th>{{ t('label') }}</th><th>{{ t('base') }}</th><th>{{ t('extra') }}</th></tr></thead><tbody><tr v-for="z in form.zones" :key="z.id"><td>{{ z.id }}</td><td><input v-model="z.label" maxlength="120" :aria-label="t('label') + ' ' + z.id"></td><td><input v-model="z.base_price" inputmode="decimal" required :aria-label="t('base') + ' ' + z.id"></td><td><input v-model="z.additional_kg_price" inputmode="decimal" required :aria-label="t('extra') + ' ' + z.id"></td></tr></tbody></table>
          </div>
          <h5 class="font-semibold">{{ t('surcharges') }}</h5>
          <div v-for="(s, i) in form.surcharges" :key="s.id" class="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
            <label>{{ t('label') }}<input v-model="s.label" maxlength="120" required></label>
            <label>{{ t('kind') }}<select v-model="s.kind"><option value="fixed">{{ t('fixed') }}</option><option value="percent">{{ t('percent') }}</option></select></label>
            <label>{{ t('value') }}<input v-model="s.value" inputmode="decimal" required></label>
            <label>{{ t('basis') }}<select v-model="s.basis"><option v-for="basis in ['freight','declared_value','cod']" :key="basis" :value="basis">{{ t(basis) }}</option></select></label>
            <label>{{ t('zonesAll') }}<select v-model="s.zone_ids" multiple><option v-for="z in form.zones" :key="z.id" :value="z.id">{{ z.id }}</option></select></label>
            <div><label class="tariff-check"><input v-model="s.vat_applicable" type="checkbox">{{ t('vatApplies') }}</label><button type="button" class="tariff-button mt-2" @click="form.surcharges.splice(i,1)">{{ t('remove') }}</button></div>
          </div>
          <button type="button" class="tariff-button" :disabled="form.surcharges.length >= 50" @click="addSurcharge">{{ t('addSurcharge') }}</button>
          <div class="flex flex-wrap gap-4"><label class="tariff-check"><input v-model="form.product_confirmed" type="checkbox">{{ t('confirmProduct') }}</label><label class="tariff-check"><input v-model="form.validity_confirmed" type="checkbox">{{ t('confirmValidity') }}</label><label class="tariff-check"><input v-model="form.surcharges_confirmed" type="checkbox">{{ t('confirmSurcharges') }}</label></div>
        </fieldset>
        <details class="rounded-lg border p-3">
          <summary class="cursor-pointer font-semibold">{{ t('mappings') }} ({{ form.mappings.length }})</summary>
          <p class="my-3 text-sm">{{ t('mappingHelp') }}</p>
          <div class="flex flex-wrap gap-3"><label>{{ t('search') }}<input v-model="mappingSearch" type="search"></label><label>{{ t('filter') }}<select v-model="mappingFilter"><option value="all">{{ t('all') }}</option><option v-for="state in ['unverified','confirmed','excluded']" :key="state" :value="state">{{ t(state) }}</option></select></label><button type="button" class="tariff-button" :disabled="readOnly || busy" @click="addExistingAliases">{{ t('addAliases') }}</button></div>
          <div class="mt-3 overflow-x-auto"><table class="w-full text-sm"><thead><tr><th>{{ t('city') }}</th><th>{{ t('candidates') }}</th><th>{{ t('zone') }}</th><th>{{ t('review') }}</th></tr></thead><tbody><tr v-for="m in visibleMappings" :key="m.provider_city_id"><td>{{ m.provider_city_id }} · {{ m.governorate }} · {{ locale === 'ar' ? m.city_arabic || m.city : m.city }}</td><td>{{ m.candidate_zone_ids.join(', ') || '—' }}</td><td><select v-model="m.zone_id" :disabled="readOnly || busy" :aria-label="t('zone') + ' ' + m.provider_city_id"><option :value="null">{{ t('unverified') }}</option><option v-for="z in form.zones" :key="z.id" :value="z.id">{{ z.id }}</option></select></td><td><select v-model="m.review_state" :disabled="readOnly || busy" :aria-label="t('review') + ' ' + m.provider_city_id"><option v-for="state in ['unverified','confirmed','excluded']" :key="state" :value="state">{{ t(state) }}</option></select></td></tr></tbody></table></div>
          <div class="mt-3 flex items-center gap-3"><button type="button" class="tariff-button" :disabled="mappingPage === 0" @click="mappingPage--">{{ t('previous') }}</button><span>{{ mappingPage + 1 }} / {{ mappingPages }}</span><button type="button" class="tariff-button" :disabled="mappingPage + 1 >= mappingPages" @click="mappingPage++">{{ t('next') }}</button></div>
        </details>
        <div v-if="readiness" class="rounded-lg border p-3"><p class="font-semibold">{{ readiness.can_verify ? t('readyToVerify') : t('unverified') }}</p><ul class="mt-2 list-inside list-disc text-sm"><li v-for="issue in readiness.issues" :key="issue">{{ t('issues.' + issue) }}</li></ul></div>
        <div class="flex flex-wrap gap-3">
          <button v-if="!readOnly && !pending" type="submit" class="tariff-button" :disabled="busy">{{ t('save') }}</button>
          <button v-if="!readOnly && !pending" type="button" class="tariff-button" :disabled="busy || !readiness?.can_verify" @click="save(true)">{{ t('verify') }}</button>
          <button v-if="pending" type="button" class="tariff-button" :disabled="saving" @click="recoverSave">{{ t('recoverSave') }}</button>
          <button v-if="!readOnly" type="button" class="tariff-button" :disabled="busy" @click="previewDocument(form)">{{ t('preview') }}</button>
        </div>
      </form>
      <div v-if="preview" class="mt-4 rounded-lg border p-3" data-tariff-preview>
        <h5 class="font-semibold">{{ t('preview') }}</h5><p class="my-2 text-sm">{{ t('previewOnly') }}</p>
        <p class="text-sm">{{ t('changes') }}: {{ preview.diff.length }}</p>
        <details v-for="(change,i) in preview.diff" :key="i" class="my-2"><summary>{{ change.field || t('document') }}</summary><pre class="overflow-auto whitespace-pre-wrap text-xs" dir="ltr">{{ JSON.stringify({ before: change.before, after: change.after }, null, 2) }}</pre></details>
        <ul class="my-3 list-inside list-disc text-sm"><li v-for="issue in preview.readiness.issues" :key="issue">{{ t('issues.' + issue) }}</li></ul>
        <button v-if="!readOnly" type="button" class="tariff-button" :disabled="busy" @click="usePreview">{{ t('usePreview') }}</button>
        <button type="button" class="tariff-button ms-2" @click="preview = null">{{ t('close') }}</button>
      </div>
      <details v-if="history.length" class="mt-4 rounded-lg border p-3"><summary class="cursor-pointer font-semibold">{{ t('history') }}</summary><div v-for="entry in history" :key="entry.revision" class="mt-2 flex flex-wrap items-center gap-3 text-sm"><span>{{ t('revision') }} {{ entry.revision }} · {{ t(entry.status) }} · {{ entry.created_at }}</span><button type="button" class="tariff-button" :disabled="busy" @click="load(selected.id, entry.revision)">{{ t('view') }}</button></div></details>
    </template>
  </section>
</template>

<script setup>
import { emptyTariff, normalizeTariff, tariffReadiness, tariffRounding, tariffVatScopes } from '~/utils/shippingTariffs'
const props = defineProps({ company: { type: Object, required: true } })
const emit = defineEmits(['close'])
const { t: translate, locale } = useI18n()
const t = key => translate('shippingTariffs.' + key)
const client = useSupportClient()
const form = ref(emptyTariff()), baseline = ref(''), selected = ref(null), versions = ref([]), history = ref([])
const context = ref({ aliases: [], cities: [], products: [] }), ready = ref(false), loading = ref(false), saving = ref(false), error = ref(''), message = ref(''), preview = ref(null), pending = ref(null)
const newId = ref(''), mappingSearch = ref(''), mappingFilter = ref('all'), mappingPage = ref(0)
const busy = computed(() => loading.value || saving.value || !!pending.value)
const readOnly = computed(() => selected.value?.status === 'verified' || selected.value && selected.value.viewed_revision !== selected.value.revision)
const dirty = computed(() => ready.value && JSON.stringify(form.value) !== baseline.value)
const readiness = computed(() => { try { return tariffReadiness(document(), context.value) } catch { return null } })
const filteredMappings = computed(() => form.value.mappings.filter(m => (mappingFilter.value === 'all' || m.review_state === mappingFilter.value) && `${m.provider_city_id} ${m.governorate} ${m.city} ${m.city_arabic || ''}`.toLocaleLowerCase().includes(mappingSearch.value.trim().toLocaleLowerCase())))
const mappingPages = computed(() => Math.max(1, Math.ceil(filteredMappings.value.length / 25)))
const visibleMappings = computed(() => filteredMappings.value.slice(mappingPage.value * 25, (mappingPage.value + 1) * 25))
watch([mappingSearch, mappingFilter], () => { mappingPage.value = 0 })
const canLeave = () => !pending.value && (!dirty.value || window.confirm(t('discard')))
defineExpose({ canLeave })
const close = () => { if (canLeave()) emit('close') }
const endpoint = () => '/api/admin-shipping/companies/' + props.company.id + '/tariffs'
const document = () => ({ ...structuredClone(toRaw(form.value)), product_id: form.value.product_id === '' ? null : form.value.product_id, effective_from: form.value.effective_from || null, effective_until: form.value.effective_until || null, annual_review_month_day: form.value.annual_review_month_day || null })
const load = async (id = null, revision = null, guard = true) => {
  if (guard && !canLeave()) return
  loading.value = true; error.value = ''
  try {
    const response = await client.request(endpoint(), { method: 'GET', query: { ...(id ? { tariff: id } : {}), ...(revision ? { revision } : {}) }, retry: 0, timeout: 15000 })
    versions.value = response.versions; selected.value = response.selected; history.value = response.history; context.value = response.context
    form.value = response.selected ? structuredClone(response.selected.document) : emptyTariff()
    newId.value = response.selected?.id || crypto.randomUUID(); baseline.value = JSON.stringify(form.value); preview.value = null; ready.value = true; mappingPage.value = 0
  } catch { error.value = 'loadFailed' } finally { loading.value = false }
}
const openVersion = async event => { const id = event.target.value; if (id) await load(id); else newDraft(); event.target.value = selected.value?.id || '' }
const reload = () => load(selected.value?.id || null)
const newDraft = () => {
  if (busy.value || !canLeave()) return
  const d = selected.value ? structuredClone(toRaw(form.value)) : emptyTariff()
  d.validity_confirmed = false; d.product_confirmed = false; d.surcharges_confirmed = false; d.effective_from = null; d.effective_until = null
  for (const m of d.mappings) if (m.review_state !== 'excluded') m.review_state = 'unverified'
  form.value = d; selected.value = null; history.value = []; newId.value = crypto.randomUUID(); baseline.value = ''; preview.value = null; message.value = ''; error.value = ''; ready.value = true
}
const previewDocument = async input => {
  if (busy.value) return
  error.value = ''; saving.value = true
  try {
    preview.value = await client.request(endpoint(), { method: 'POST', body: { action: 'preview', tariff_id: newId.value, expected_revision: selected.value?.revision || 0, document: normalizeTariff(input === form.value ? document() : input) }, retry: 0, timeout: 15000 })
  } catch (e) { error.value = e?.statusCode === 409 ? 'conflict' : 'invalid' } finally { saving.value = false }
}
const importFile = async event => {
  const file = event.target.files?.[0]; event.target.value = ''
  if (!file || busy.value || readOnly.value) return
  try {
    if (file.size > 1500000) throw Error('size')
    const d = normalizeTariff(JSON.parse(await file.text()))
    d.product_confirmed = false; d.validity_confirmed = false; d.surcharges_confirmed = false; d.insurance_enabled = false
    for (const m of d.mappings) if (m.review_state !== 'excluded') m.review_state = 'unverified'
    await previewDocument(d)
  } catch { error.value = 'invalid' }
}
const usePreview = () => { if (preview.value && !busy.value && !readOnly.value) { form.value = structuredClone(toRaw(preview.value.document)); preview.value = null; message.value = 'previewLoaded' } }
const save = async verify => {
  if (busy.value || readOnly.value) return
  if (verify && !window.confirm(t('verifyConfirm'))) return
  error.value = ''; message.value = ''
  try { pending.value = { action: verify ? 'verify' : 'save', tariff_id: newId.value, command_id: crypto.randomUUID(), expected_revision: selected.value?.revision || 0, document: normalizeTariff(document()) } }
  catch { error.value = 'invalid'; return }
  await recoverSave()
}
const recoverSave = async () => {
  if (!pending.value || saving.value) return
  saving.value = true; error.value = ''
  try {
    const result = await client.request(endpoint(), { method: 'POST', body: pending.value, retry: 0, timeout: 15000 })
    pending.value = null; baseline.value = JSON.stringify(form.value); message.value = 'saved'
    await load(result.id, null, false)
  } catch (e) {
    const status = e?.statusCode || e?.response?.status
    if (status >= 400 && status < 500) { pending.value = null; error.value = status === 409 ? 'conflict' : 'invalid' }
    else error.value = 'uncertain'
  } finally { saving.value = false }
}
const addSurcharge = () => form.value.surcharges.push({ id: crypto.randomUUID(), label: '', kind: 'fixed', value: '', basis: 'freight', zone_ids: [], vat_applicable: false })
const addExistingAliases = () => { const existing = new Set(form.value.mappings.map(m => m.provider_city_id)); for (const a of context.value.aliases) if (!existing.has(a.provider_city_id)) { form.value.mappings.push({ ...a, candidate_zone_ids: [], zone_id: null, review_state: 'unverified' }); existing.add(a.provider_city_id) } }
const exportDraft = () => {
  try { const url = URL.createObjectURL(new Blob([JSON.stringify(document(), null, 2) + '\n'], { type: 'application/json' })); const a = window.document.createElement('a'); a.href = url; a.download = 'shipping-tariff.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) } catch { error.value = 'invalid' }
}
const beforeUnload = event => { if (dirty.value || pending.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(() => canLeave())
onBeforeRouteUpdate(() => canLeave())
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); load(null, null, false) })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped>
.tariff-manager label { font-size: .875rem; font-weight: 500; }
.tariff-manager input:not([type=checkbox]):not([type=file]), .tariff-manager select, .tariff-manager textarea { display: block; width: 100%; min-height: 2.5rem; margin-top: .25rem; padding: .5rem; border: 1px solid #cbd5e1; border-radius: .375rem; background: transparent; color: inherit; }
.tariff-manager input[type=checkbox] { margin: 0; }
.tariff-manager th, .tariff-manager td { padding: .5rem; text-align: start; vertical-align: top; }
.tariff-manager td input { min-width: 6rem; }
.tariff-check { display: flex; align-items: center; gap: .5rem; }
.tariff-button { min-height: 2.5rem; padding: .5rem .75rem; border: 1px solid #cbd5e1; border-radius: .375rem; font-size: .875rem; align-self: end; }
.tariff-manager :disabled { opacity: .55; cursor: not-allowed; }
</style>
