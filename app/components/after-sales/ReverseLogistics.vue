<script setup>
import { claimDate, claimErrorKey } from '~/utils/afterSalesClaims.js'
const props = defineProps({ claim: { type: Object, required: true }, staff: Boolean })
const emit = defineEmits(['changed'])
const { t, locale } = useI18n(), { intlLocale } = useUiLocale(), { request, downloadFrom } = useSupportClient()
const data = ref(null), loading = ref(true), saving = ref(false), error = ref(''), notice = ref(''), confirming = ref(false)
const pickup = reactive({ name: '', phone: '', address: '', city_mapping_id: '' }), handling = ref(''), reason = ref(''), returnRequired = ref(false)
const api = computed(() => `${props.staff ? '/api/admin-after-sales' : '/api/account/after-sales'}/claims/${props.claim.id}`)
const latest = computed(() => data.value?.jobs[0]), bookingKey = ref('')
const canBook = computed(() => data.value?.can_book && data.value?.handling_resolutions.length && (!latest.value || data.value.can_retry))
let generation = 0
const load = async () => {
  const current = ++generation; loading.value = true; error.value = ''
  try {
    const result = await request(`${api.value}/reverse`)
    if (current !== generation) return
    data.value = result
    if (!confirming.value && result.prefill) Object.assign(pickup, result.prefill)
    if (!handling.value && result.handling_resolutions.length === 1) handling.value = result.handling_resolutions[0]
  } catch (cause) { if (current === generation) error.value = t(claimErrorKey(cause)) }
  finally { if (current === generation) loading.value = false }
}
const begin = () => { bookingKey.value = crypto.randomUUID(); confirming.value = true; notice.value = ''; error.value = '' }
const book = async () => {
  saving.value = true; error.value = ''
  try {
    await request(`${api.value}/reverse`, { method: 'POST', body: { revision: props.claim.revision, idempotency_key: bookingKey.value, pickup: { ...pickup }, handling_resolution: handling.value, reason: reason.value, return_required: returnRequired.value, ...(latest.value ? { previous_job_id: latest.value.id } : {}) } })
    confirming.value = false; notice.value = t('reverse.queued'); await load(); emit('changed')
  } catch (cause) { error.value = t(claimErrorKey(cause)); if (cause.statusCode === 409) emit('changed') }
  finally { saving.value = false }
}
const operate = async (job, action) => {
  saving.value = true; error.value = ''
  try {
    await request(`${api.value}/reverse-actions`, { method: 'POST', body: { job_id: job.id, action } })
    notice.value = t(action === 'label' ? 'reverse.labelQueued' : 'reverse.updated'); await load(); emit('changed')
  } catch (cause) { error.value = t(claimErrorKey(cause)) }
  finally { saving.value = false }
}
const label = async job => { try { await downloadFrom(`${api.value}/reverse-label?job_id=${job.id}`, `PDC-${job.awb}.pdf`) } catch (cause) { error.value = t(claimErrorKey(cause)) } }
onMounted(load)
watch(() => props.claim.id, load)
onBeforeUnmount(() => { generation++ })
</script>
<template>
  <section v-if="staff || data?.jobs.length || error" data-reverse-logistics :aria-busy="loading" class="rounded-2xl border border-slate-200 bg-white p-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-bold">{{ $t('reverse.title') }}</h2><button type="button" :disabled="loading || saving" class="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold" @click="load">{{ $t('claims.refresh') }}</button></div>
    <p v-if="error" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ error }}</p><p v-if="notice" role="status" class="mt-3 text-sm text-green-700">{{ notice }}</p>
    <p v-if="loading && !data" class="mt-3 text-sm text-slate-600">{{ $t('claims.loading') }}</p>
    <template v-if="data">
      <p v-if="staff && !data.operational" class="mt-3 text-sm text-slate-600">{{ $t('reverse.restricted') }}</p>
      <p v-if="staff && data.operational && !data.provider_ready" data-reverse-disabled class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{{ $t('reverse.notReady') }}</p>
      <p v-if="staff && !data.jobs.length" class="mt-3 text-sm text-slate-600">{{ $t('reverse.noBooking') }}</p>
      <div v-for="job in data.jobs" :key="job.id" :data-reverse-job="job.id" class="mt-4 space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
        <div class="flex flex-wrap justify-between gap-2"><span class="font-semibold">PDC · {{ $t(`reverse.states.${job.state}`) }}</span><time class="text-xs text-slate-600">{{ claimDate(job.created_at, intlLocale) }}</time></div>
        <p v-if="job.awb" data-reverse-awb class="break-all font-semibold">{{ $t('reverse.awb') }}: {{ job.awb }}</p><p v-if="staff && data.operational" class="break-all text-xs text-slate-500">{{ job.to_ref }}</p>
        <p>{{ $t(`shipment.states.${job.normalized_state}`) }}</p><p v-if="job.pickup" class="whitespace-pre-wrap break-words text-slate-600">{{ job.pickup.name }} · {{ job.pickup.phone }}<br>{{ job.pickup.address }} · {{ job.pickup.city }} · {{ job.pickup.governorate }}</p>
        <p v-if="job.state === 'uncertain'" class="rounded-lg bg-amber-50 p-3 text-amber-800">{{ $t('reverse.uncertain') }}</p><p v-if="job.diagnostic" class="text-xs text-slate-500">{{ $t(`reverse.diagnostics.${job.diagnostic}`) }}</p>
        <div v-if="staff && data.operational" class="flex flex-wrap gap-2">
          <button v-if="job.can_recover && data.can_retry" type="button" :disabled="saving || !data.provider_ready" class="min-h-10 rounded-lg border border-slate-300 px-3 font-semibold disabled:opacity-50" @click="operate(job, 'recover')">{{ $t('reverse.recover') }}</button>
          <button v-if="job.can_refresh && data.can_retry" type="button" :disabled="saving || !data.provider_ready" class="min-h-10 rounded-lg border border-slate-300 px-3 font-semibold disabled:opacity-50" @click="operate(job, 'refresh')">{{ $t('reverse.refresh') }}</button>
          <button v-if="job.can_label && !job.label_ready" type="button" :disabled="saving || !data.provider_ready" class="min-h-10 rounded-lg border border-slate-300 px-3 font-semibold disabled:opacity-50" @click="operate(job, 'label')">{{ $t('reverse.prepareLabel') }}</button>
          <button v-if="job.label_ready" type="button" class="min-h-10 rounded-lg border border-slate-300 px-3 font-semibold" @click="label(job)">{{ $t('reverse.downloadLabel') }}</button>
        </div>
      </div>
      <button v-if="staff && canBook && !confirming" data-reverse-begin type="button" :disabled="!data.provider_ready || saving" class="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-50" @click="begin">{{ $t(latest ? 'reverse.rebook' : 'reverse.schedule') }}</button>
      <form v-if="staff && confirming" data-reverse-form class="mt-4 space-y-4" @submit.prevent="book">
        <p class="text-sm text-slate-600">{{ $t('reverse.confirmDetails') }}</p>
        <div class="grid gap-4 sm:grid-cols-2"><label class="block text-sm font-semibold">{{ $t('reverse.name') }}<input v-model="pickup.name" required maxlength="100" class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3"></label><label class="block text-sm font-semibold">{{ $t('reverse.phone') }}<input v-model="pickup.phone" required inputmode="tel" pattern="01[0-9]{9}" maxlength="11" dir="ltr" class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3"></label></div>
        <label class="block text-sm font-semibold">{{ $t('reverse.city') }}<select v-model="pickup.city_mapping_id" required class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3"><option value="">{{ $t('claims.choose') }}</option><option v-for="city in data.cities" :key="city.id" :value="city.id">{{ city.governorate }} · {{ locale === 'ar' ? city.city_arabic || city.city : city.city }}</option></select></label>
        <label class="block text-sm font-semibold">{{ $t('reverse.address') }}<textarea v-model="pickup.address" required maxlength="1000" rows="3" class="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"></textarea></label>
        <label class="block text-sm font-semibold">{{ $t('reverse.handling') }}<select v-model="handling" required class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3"><option value="">{{ $t('claims.choose') }}</option><option v-for="choice in data.handling_resolutions" :key="choice" :value="choice">{{ $t(`claims.resolutions.${choice}`) }}</option></select></label>
        <p class="text-xs text-slate-600">{{ $t('reverse.handlingHelp') }}</p><label class="block text-sm font-semibold">{{ $t('reverse.reason') }}<textarea v-model="reason" required maxlength="1000" rows="2" class="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"></textarea></label>
        <label class="flex gap-2 text-sm"><input v-model="returnRequired" required type="checkbox">{{ $t('reverse.returnRequired') }}</label>
        <button type="submit" :disabled="saving || !data.provider_ready" class="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white disabled:opacity-50">{{ $t('reverse.confirmBooking') }}</button><button type="button" class="ms-3 min-h-11 px-3 text-sm font-semibold" @click="confirming = false">{{ $t('claims.close') }}</button>
      </form>
      <div v-if="data.events.length" class="mt-5"><h3 class="font-semibold">{{ $t('reverse.history') }}</h3><ol class="mt-3 space-y-3"><li v-for="event in data.events" :key="event.id" class="border-s-2 border-blue-200 ps-3 text-sm"><p>{{ $t(`shipment.states.${event.state}`) }}</p><time class="text-xs text-slate-500">{{ claimDate(event.status_date || event.observed_at, intlLocale) }} · {{ $t(event.status_date ? 'reverse.providerTime' : 'reverse.observedTime') }}</time><p v-if="event.provider_label" class="mt-1 break-words text-xs text-slate-600">{{ event.provider_status_id }} · {{ event.provider_label }} · {{ event.provider_reason }}</p></li></ol></div>
    </template>
  </section>
</template>
