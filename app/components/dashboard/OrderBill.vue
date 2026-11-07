<template>
  <section class="rounded-xl border border-gray-200 p-4" data-order-bill>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="font-semibold">{{ $t('bill.title') }}</p>
        <p class="text-sm text-gray-500">{{ $t('bill.number', { value0: bill.number }) }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50" :disabled="busy" @click="download">{{ $t('bill.download') }}</button>
        <button type="button" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="busy" @click="resend">{{ $t(sending ? 'bill.sending' : 'bill.sendAgain') }}</button>
      </div>
    </div>
    <p v-if="message" class="mt-2 text-sm text-green-700" role="status">{{ $t(message) }}</p>
    <p v-if="errorMessage" class="mt-2 text-sm text-red-700" role="alert">{{ $uiMessage(errorMessage) }}</p>
  </section>
</template>

<script setup>
import { downloadPdf } from '~/utils/downloadPdf'
const props = defineProps({ orderId: { type: String, required: true }, bill: { type: Object, required: true } })
const supabase = useSupabaseClient()
const busy = ref(false), sending = ref(false), message = ref(''), errorMessage = ref('')
async function headers() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
  return { authorization: `Bearer ${data.session.access_token}` }
}
async function download() {
  busy.value = true; message.value = ''; errorMessage.value = ''
  try { await downloadPdf(`/api/admin-orders/${encodeURIComponent(props.orderId)}/bill`, await headers(), `Bill-${props.bill.number}.pdf`) }
  catch (error) { errorMessage.value = error?.statusMessage || 'The bill is unavailable. Try again later.' }
  finally { busy.value = false }
}
async function resend() {
  busy.value = true; sending.value = true; message.value = ''; errorMessage.value = ''
  try { await $fetch(`/api/admin-orders/${encodeURIComponent(props.orderId)}/bill-email`, { method: 'POST', headers: await headers() }); message.value = 'bill.sent' }
  catch (error) { errorMessage.value = error?.data?.statusMessage || 'The bill email could not be sent.' }
  finally { busy.value = false; sending.value = false }
}
</script>
