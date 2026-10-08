<script setup>
import { claimErrorKey } from '~/utils/afterSalesClaims.js'
const props = defineProps({ modelValue: { type: Array, default: () => [] }, itemId: { type: String, required: true }, claimType: { type: String, required: true }, reasonKey: { type: String, default: '' }, claimId: { type: String, default: '' }, mode: { type: String, default: 'optional' }, required: Boolean })
const emit = defineEmits(['update:modelValue', 'busy'])
const { t } = useI18n()
const { request, downloadFrom } = useSupportClient()
const busy = ref(false), error = ref(''), files = ref([]), input = ref(null)
const sync = () => emit('update:modelValue', files.value.filter(file => file.usable !== false))
const remove = async file => {
  busy.value = true; error.value = ''; emit('busy', true)
  try { await request(`/api/account/after-sales/evidence/${file.id}`, { method: 'DELETE' }); files.value = files.value.filter(row => row.id !== file.id); sync() }
  catch (cause) { error.value = t(claimErrorKey(cause)) }
  finally { busy.value = false; emit('busy', false) }
}
const clear = async () => { for (const file of [...files.value]) await remove(file) }
const upload = async event => {
  const selected = Array.from(event.target.files || [])
  if (files.value.length + selected.length > 5) { error.value = t('claims.errors.evidenceLimit'); event.target.value = ''; return }
  busy.value = true; error.value = ''; emit('busy', true)
  try {
    for (const file of selected) {
      if (file.size > 5242880) throw { data: { code: 'size' } }
      const form = new FormData()
      form.append('attachmentId', crypto.randomUUID()); form.append('type', props.claimType)
      if (props.claimId) form.append('claimId', props.claimId)
      else if (props.reasonKey) form.append('reasonKey', props.reasonKey)
      form.append('file', file)
      const result = await request(`/api/account/after-sales/items/${props.itemId}/evidence`, { method: 'POST', body: form })
      files.value.push({ ...result.item, usable: true }); sync()
    }
  } catch (cause) { error.value = t(claimErrorKey(cause)) }
  finally { if (input.value) input.value.value = ''; busy.value = false; emit('busy', false) }
}
const download = async file => { try { await downloadFrom(`/api/account/after-sales/evidence/${file.id}`, file.original_name) } catch { error.value = t('claims.errors.evidence') } }
onMounted(async () => {
  try { files.value = (await request(`/api/account/after-sales/items/${props.itemId}/evidence`, { query: { type: props.claimType, ...(props.claimId ? { claim: props.claimId } : {}) } })).items; sync() }
  catch (cause) { error.value = t(claimErrorKey(cause)) }
})
defineExpose({ clear })
</script>

<template>
  <section data-claim-evidence class="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 class="text-sm font-bold text-slate-900">{{ $t('claims.evidence') }} · {{ $t(required ? 'claims.required' : `claims.evidenceModes.${mode}`) }}</h3>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-700">{{ error }}</p>
    <p class="mt-1 text-xs text-slate-600">{{ $t('claims.privateFiles') }}</p>
    <label v-if="mode !== 'disabled'" class="mt-3 block text-sm font-semibold text-slate-800">{{ $t('claims.addFiles') }}<input ref="input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" :disabled="busy || files.length >= 5 || (claimType === 'return' && !reasonKey && !claimId)" class="mt-2 block w-full min-w-0 text-sm" @change="upload"></label>
    <ul v-if="files.length" class="mt-3 space-y-2">
      <li v-for="file in files" :key="file.id" class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span class="min-w-0 break-all text-slate-800">{{ file.original_name }} <span v-if="file.usable === false" class="text-amber-700">{{ $t('claims.unsubmittedExpired') }}</span></span>
        <span class="flex gap-2"><button v-if="file.usable !== false" type="button" class="min-h-10 px-2 font-semibold text-blue-700" @click="download(file)">{{ $t('claims.download') }}</button><button type="button" :disabled="busy" class="min-h-10 px-2 font-semibold text-red-700" @click="remove(file)">{{ $t('claims.remove') }}</button></span>
      </li>
    </ul>
    <p v-if="busy" role="status" class="mt-2 text-xs text-slate-600">{{ $t('claims.uploading') }}</p>
  </section>
</template>
