<template>
  <div class="space-y-3" data-order-courier>
    <p v-if="!loaded" class="text-sm text-gray-500" role="status">{{ $t('common.loading') }}</p>
    <p v-if="errorMessage" class="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ $uiMessage(errorMessage) }}</p>

    <section v-if="shipping" class="rounded-lg border border-gray-200 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-bold text-gray-900">{{ $t('common.pdcShipping') }}</h3>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="stateClass">{{ $t(`liveSales.states.${shipping.state}`) }}</span>
      </div>
      <p v-if="shipping.awb" class="mt-2 text-sm font-semibold text-gray-900">{{ $t('common.awbValue', { value0: shipping.awb }) }}</p>
      <p v-if="shipping.provider_status_name" class="mt-1 text-sm text-gray-600">{{ shipping.provider_status_name }}</p>
      <p v-if="shipping.last_error" class="mt-1 text-sm text-red-600">{{ shipping.last_error }}</p>
      <p v-if="shipping.state === 'uncertain'" class="mt-1 text-sm text-amber-700">{{ $t('liveSales.uncertain') }}</p>

      <form v-if="canBook" class="mt-3 flex flex-wrap items-end gap-2" @submit.prevent="book">
        <label class="min-w-28 flex-1 text-xs font-semibold text-gray-600">{{ $t('pdcParcel.weight') }}
          <input v-model="weight" type="number" min="0.001" max="99999.99" step="0.001" required class="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal text-gray-900">
        </label>
        <button type="submit" :disabled="busy || orderStatus !== 'ready_to_deliver'" class="min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{{ $t('liveSales.book') }}</button>
      </form>
      <div class="mt-3 flex flex-wrap gap-2 empty:hidden">
        <button v-if="canRecover" type="button" :disabled="busy" class="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold" @click="courierAction('recover')">{{ $t('liveSales.recover') }}</button>
        <button v-if="shipping.awb && !shipping.label_ready" type="button" :disabled="busy" class="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold" @click="courierAction('label')">{{ $t('liveSales.label') }}</button>
        <button v-if="shipping.label_ready" type="button" :disabled="labelLoading" class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50" @click="openLabel('print')"><Icon name="lucide:printer" size="16" />{{ $t('confirmOrders.printLabel') }}</button>
        <button v-if="shipping.label_ready" type="button" :disabled="labelLoading" class="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold" @click="openLabel('download')">{{ $t('shippingLabel.download') }}</button>
      </div>
      <details v-if="canBook && !shipping.awb" class="mt-3 text-sm">
        <summary class="cursor-pointer font-semibold text-gray-600">{{ $t('confirmOrders.attachAwb') }}</summary>
        <form class="mt-2 space-y-2" @submit.prevent="attachAwb">
          <p class="text-xs text-gray-500">{{ $t('beta.attachAwbHelp') }}</p>
          <input v-model="manualAwb" required maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_-]*" :aria-label="$t('beta.actualAwb')" :placeholder="$t('beta.actualAwb')" class="min-h-10 w-full rounded-lg border border-gray-300 px-3">
          <label class="flex items-start gap-2 text-xs"><input v-model="manualAwbConfirmed" type="checkbox" required class="mt-0.5">{{ $t('beta.verifyAwb') }}</label>
          <button type="submit" :disabled="busy" class="min-h-10 rounded-lg border border-gray-300 px-3 font-semibold disabled:opacity-50">{{ $t('confirmOrders.attachAwb') }}</button>
        </form>
      </details>
    </section>

    <section v-if="loaded" class="flex flex-wrap items-center gap-2">
      <button v-if="bill" type="button" :disabled="billLoading" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-50" @click="downloadBill"><Icon name="lucide:file-text" size="16" />{{ $t('bill.title') }}</button>
      <span v-else-if="externalErp" class="text-sm text-gray-500" role="status">{{ $t('confirmOrders.billPreparing') }}</span>
      <button v-if="sessionId" type="button" :disabled="videoLoading" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-50" @click="downloadVideo"><Icon name="lucide:video" size="16" />{{ $t('common.packingVideo') }}</button>
      <slot />
    </section>
    <DashboardShippingLabelPreview v-if="labelPreview" :key="labelPreview.identity.jobId" :document="labelPreview" :auto-print="labelAutoPrint" @close="labelPreview = null" />
  </div>
</template>

<script setup>
import { downloadPdf } from '~/utils/downloadPdf'
import { measuredParcelWeight } from '~/utils/parcelWeight'
import { readShippingLabelResponse } from '~/utils/shippingLabelDownload'

const props = defineProps({ orderId: { type: String, required: true }, sessionId: { type: String, default: '' }, notice: { type: String, default: '' } })
const emit = defineEmits(['updated'])
const supabase = useSupabaseClient()
const { t } = useI18n()
const { data: erpState } = useNuxtData('active-erp')
const externalErp = computed(() => erpState.value?.mode === 'daftra')
const loaded = ref(false), shipping = ref(null), bill = ref(null), orderStatus = ref(''), weight = ref('1'), errorMessage = ref(props.notice)
const busy = ref(false), labelLoading = ref(false), billLoading = ref(false), videoLoading = ref(false), labelPreview = ref(null), labelAutoPrint = ref(false)
const manualAwb = ref(''), manualAwbConfirmed = ref(false)
const canBook = computed(() => ['not_booked', 'queued', 'blocked', 'failed'].includes(shipping.value?.state))
const canRecover = computed(() => ['uncertain', 'submitting'].includes(shipping.value?.state) && !shipping.value?.awb)
const stateClass = computed(() => {
  if (shipping.value?.state === 'ready') return 'bg-green-100 text-green-800'
  return ['blocked', 'failed', 'uncertain'].includes(shipping.value?.state) ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
})
const headers = async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Please log in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
let timer = null, polls = 0, disposed = false
const load = async () => {
  try {
    const response = await $fetch(`/api/admin-orders/${props.orderId}`, { headers: await headers(), retry: 0 })
    if (disposed) return
    shipping.value = response.shipping || null
    bill.value = response.bill || null
    orderStatus.value = response.order?.status || ''
    if (!weight.value || weight.value === '1') weight.value = String(response.shipping?.default_weight_kg || 1)
  } catch (error) { if (!disposed) errorMessage.value = error?.data?.statusMessage || 'Could not load order details.' }
  finally { if (!disposed) loaded.value = true }
}
// A bill follows the ERP worker and a label follows the courier, so both can arrive a little later.
const schedule = () => {
  clearTimeout(timer)
  const waiting = ['queued', 'submitting', 'label_pending'].includes(shipping.value?.state) || (externalErp.value && !bill.value)
  if (!disposed && waiting && polls < 24) timer = setTimeout(async () => { polls++; await load(); schedule() }, 8000)
}
const courierAction = async (action, body = { action }) => {
  if (busy.value) return
  busy.value = true; errorMessage.value = ''
  try {
    await $fetch(`/api/admin-shipping/orders/${props.orderId}/booking`, { method: 'POST', body, headers: await headers(), retry: 0 })
    await load(); polls = 0; schedule(); emit('updated')
  } catch (error) { errorMessage.value = error?.data?.statusMessage || t('shipment.actionFailed'); await load() }
  finally { busy.value = false }
}
const book = () => {
  const value = measuredParcelWeight(weight.value)
  if (value === null) { errorMessage.value = 'Measure and confirm the packed parcel weight.'; return }
  return courierAction('book', { action: 'book', actual_weight_kg: value, weight_confirmed: true })
}
const attachAwb = async () => {
  if (busy.value || !manualAwbConfirmed.value) return
  busy.value = true; errorMessage.value = ''
  try {
    await $fetch(`/api/admin-shipping/orders/${props.orderId}/manual-awb`, { method: 'POST', body: { awb: manualAwb.value.trim(), confirmed: true }, headers: await headers(), retry: 0 })
    manualAwb.value = ''; manualAwbConfirmed.value = false
    await load(); emit('updated')
  } catch (error) { errorMessage.value = error?.data?.statusMessage || 'Review the original booking.' }
  finally { busy.value = false }
}
const saveBlob = (blob, name) => {
  const href = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = href; link.download = name; document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}
const openLabel = async action => {
  if (!shipping.value?.label_ready || labelLoading.value) return
  labelLoading.value = true; errorMessage.value = ''
  const expected = { orderId: props.orderId, jobId: shipping.value.id, awb: shipping.value.awb }
  try {
    const response = await fetch(`/api/admin-shipping/orders/${expected.orderId}/label`, { headers: await headers(), redirect: 'error', cache: 'no-store' })
    const label = await readShippingLabelResponse(response, expected)
    if (action === 'download') saveBlob(new Blob([label.bytes], { type: 'application/pdf' }), `PDC-${label.identity.awb}.pdf`)
    else { labelAutoPrint.value = true; labelPreview.value = label }
  } catch { errorMessage.value = t('shippingLabel.unavailable') }
  finally { labelLoading.value = false }
}
const downloadBill = async () => {
  if (!bill.value || billLoading.value) return
  billLoading.value = true; errorMessage.value = ''
  try { await downloadPdf(`/api/admin-orders/${props.orderId}/bill`, await headers(), `Bill-${String(bill.value.number).replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`) }
  catch (error) { errorMessage.value = error?.statusMessage || 'The bill is unavailable. Try again later.' }
  finally { billLoading.value = false }
}
const downloadVideo = async () => {
  if (!props.sessionId || videoLoading.value) return
  videoLoading.value = true; errorMessage.value = ''
  try { saveBlob(await $fetch(`/api/admin-orders/packing/${encodeURIComponent(props.sessionId)}/video`, { responseType: 'blob', headers: await headers() }), 'packing-video.webm') }
  catch (error) { errorMessage.value = error?.data?.statusMessage || 'Could not download the packing video.' }
  finally { videoLoading.value = false }
}
onMounted(async () => { await load(); schedule() })
onBeforeUnmount(() => { disposed = true; clearTimeout(timer) })
</script>
