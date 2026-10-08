<script setup>
import { claimErrorKey } from '~/utils/afterSalesClaims.js'
const props = defineProps({ context: { type: Object, required: true }, claimType: { type: String, required: true } })
const emit = defineEmits(['close', 'created'])
const { t, locale } = useI18n()
const { request } = useSupportClient()
const current = ref(props.context), saving = ref(false), uploading = ref(false), error = ref(''), review = ref(false), picker = ref(null), files = ref([])
const form = reactive({ quantity: 1, reason_key: '', description: '', opened: '', packaging: '', serialText: '' })
let key = crypto.randomUUID()
let previewVersion = 0
const body = () => ({ item_id: props.context.item.id, claim_type: props.claimType, quantity: form.quantity,
  description: form.description, reason_key: props.claimType === 'return' ? form.reason_key || null : null,
  opened: form.opened === '' ? null : form.opened === 'yes', packaging: form.packaging === '' ? null : form.packaging === 'yes',
  serials: props.claimType === 'warranty' ? form.serialText.split('\n').map(value => value.trim()).filter(Boolean) : [],
  attachment_ids: files.value.map(file => file.id), idempotency_key: key, locale: locale.value === 'ar' ? 'ar' : 'en' })
const preview = async () => {
  const version = ++previewVersion
  try { const result = await request(`/api/account/after-sales/items/${props.context.item.id}`, { method: 'POST', body: body() }); if (version === previewVersion) current.value = result }
  catch (cause) { if (version === previewVersion) error.value = t(claimErrorKey(cause)) }
}
watch(() => [form.reason_key, form.opened, form.packaging, form.quantity], preview)
const prepare = async () => {
  saving.value = true; error.value = ''
  try {
    await preview()
    if (!current.value.can_submit) { error.value = t('claims.errors.eligibility'); return }
    review.value = true
  } finally { saving.value = false }
}
const submit = async () => {
  saving.value = true; error.value = ''
  try { const result = await request('/api/account/after-sales/claims', { method: 'POST', body: body() }); emit('created', result.id) }
  catch (cause) { error.value = t(claimErrorKey(cause)) }
  finally { saving.value = false }
}
const close = async () => {
  if (picker.value) await picker.value.clear()
  else for (const file of files.value) { try { await request(`/api/account/after-sales/evidence/${file.id}`, { method: 'DELETE' }) } catch {} }
  emit('close')
}
</script>

<template>
  <section data-claim-form class="rounded-2xl border border-blue-200 bg-white p-5 sm:p-6">
    <div class="flex flex-wrap justify-between gap-3"><div><h2 class="text-xl font-bold text-slate-900">{{ $t(`claims.types.${claimType}`) }}</h2><p class="mt-1 text-sm text-slate-600">{{ context.item.product_title }} · {{ context.order.order_number }}</p></div><button type="button" :disabled="saving || uploading" class="min-h-10 px-3 text-sm font-semibold text-slate-700" @click="close">{{ $t('claims.close') }}</button></div>
    <p v-if="error" role="alert" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    <form v-if="!review" class="mt-5 space-y-4" @submit.prevent="prepare">
      <label class="block text-sm font-semibold text-slate-800">{{ $t('claims.quantity') }}<input v-model.number="form.quantity" type="number" min="1" :max="context.available_quantity" required class="mt-1 min-h-11 w-28 rounded-lg border border-slate-300 bg-white px-3 text-slate-900"></label>
      <label v-if="claimType === 'return'" class="block text-sm font-semibold text-slate-800">{{ $t('claims.reason') }}<select v-model="form.reason_key" required class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"><option value="">{{ $t('claims.chooseReason') }}</option><option v-for="reason in context.reasons.filter(row => row.is_enabled)" :key="reason.key" :value="reason.key">{{ locale === 'ar' ? reason.label_ar : reason.label_en }}</option></select></label>
      <label class="block text-sm font-semibold text-slate-800">{{ $t(claimType === 'return' ? 'claims.description' : 'claims.issue') }}<textarea v-model="form.description" required maxlength="4000" rows="4" class="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900"></textarea></label>
      <div v-if="claimType === 'return'" class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-semibold text-slate-800">{{ $t('claims.opened') }}<select v-model="form.opened" required class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"><option value="">{{ $t('claims.choose') }}</option><option value="yes">{{ $t('claims.yes') }}</option><option value="no">{{ $t('claims.no') }}</option></select></label>
        <label class="block text-sm font-semibold text-slate-800">{{ $t('claims.packaging') }}<select v-model="form.packaging" required class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"><option value="">{{ $t('claims.choose') }}</option><option value="yes">{{ $t('claims.yes') }}</option><option value="no">{{ $t('claims.no') }}</option></select></label>
      </div>
      <template v-if="claimType === 'warranty'">
        <p v-if="context.purchased_serials.length" class="break-all text-sm text-slate-700">{{ $t('claims.purchasedSerial') }}: {{ context.purchased_serials.join(', ') }}</p>
        <label v-if="current.serial !== 'disabled' && !context.serial_authoritative" class="block text-sm font-semibold text-slate-800">{{ $t('claims.serial') }} · {{ $t(`claims.evidenceModes.${current.serial || 'optional'}`) }}<textarea v-model="form.serialText" :required="current.serial === 'required'" rows="2" maxlength="12000" class="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900"></textarea><span class="mt-1 block text-xs font-normal text-slate-600">{{ $t('claims.serialUnverified') }}</span></label>
      </template>
      <AfterSalesEvidencePicker ref="picker" v-model="files" :item-id="context.item.id" :claim-type="claimType" :reason-key="form.reason_key" :mode="current.evidence || 'disabled'" @busy="uploading = $event" />
      <p class="text-xs text-slate-600">{{ $t('claims.declarations') }}</p>
      <button type="submit" :disabled="saving || uploading || (claimType === 'return' && !form.reason_key)" class="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">{{ $t('claims.reviewSubmission') }}</button>
    </form>
    <div v-else data-claim-confirmation class="mt-5 space-y-4">
      <p class="text-sm font-semibold text-slate-900">{{ $t('claims.reviewNotice') }}</p>
      <dl class="space-y-3 text-sm text-slate-800"><div><dt class="text-slate-500">{{ $t('claims.quantity') }}</dt><dd>{{ form.quantity }}</dd></div><div><dt class="text-slate-500">{{ $t('claims.description') }}</dt><dd class="whitespace-pre-wrap break-words">{{ form.description }}</dd></div><div v-if="claimType === 'return'"><dt class="text-slate-500">{{ $t('claims.reason') }}</dt><dd>{{ context.reasons.find(reason => reason.key === form.reason_key)?.[locale === 'ar' ? 'label_ar' : 'label_en'] }}</dd><dd>{{ $t('claims.opened') }}: {{ $t(form.opened === 'yes' ? 'claims.yes' : 'claims.no') }} · {{ $t('claims.packaging') }}: {{ $t(form.packaging === 'yes' ? 'claims.yes' : 'claims.no') }}</dd></div><div v-if="files.length"><dt class="text-slate-500">{{ $t('claims.evidence') }}</dt><dd class="break-all">{{ files.map(file => file.original_name).join(', ') }}</dd></div></dl>
      <div class="flex flex-wrap gap-3"><button type="button" :disabled="saving" class="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50" @click="submit">{{ $t(saving ? 'claims.saving' : 'claims.submit') }}</button><button type="button" :disabled="saving" class="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-800" @click="review = false">{{ $t('claims.edit') }}</button></div>
    </div>
  </section>
</template>
