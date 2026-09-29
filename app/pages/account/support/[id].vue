<script setup>
const { uiLabel } = useUiLocale()
const { intlLocale } = useUiLocale()
const supportDate = value => baseSupportDate(value, intlLocale.value)

import { supportDate as baseSupportDate, supportReference, supportStatusLabel } from '~/utils/support'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
const route = useUiRoute()
const user = useSupabaseUser()
const { request, upload, download, errorText } = useSupportClient()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref(route.query.attachment === 'failed' ? 'Ticket created, but the attachment failed. You can try again in a reply.' : '')
const detail = ref(null)
const reply = ref('')
const fileInput = ref(null)
let replyKey = ''
const ticket = computed(() => detail.value?.ticket)
const canReply = computed(() => ticket.value && !['closed', 'resolved'].includes(ticket.value.status))
const canReopen = computed(() => ticket.value && ['closed', 'resolved'].includes(ticket.value.status)
  && Date.now() - new Date(ticket.value.updated_at).getTime() < 7 * 24 * 60 * 60 * 1000)
const load = async () => {
  loading.value = true
  error.value = ''
  try {
    detail.value = await request(`/api/support/tickets/${route.params.id}`)
    const unreadIds = (detail.value.messages || [])
      .filter(message => message.sender_type === 'staff' && !message.is_internal && !message.customer_read_at)
      .map(message => message.id)
    if (unreadIds.length) {
      try {
        await request(`/api/support/tickets/${detail.value.ticket.id}/read`, {
          method: 'PATCH', body: { messageIds: unreadIds }
        })
        const readAt = new Date().toISOString()
        detail.value.messages = detail.value.messages.map(message => unreadIds.includes(message.id)
          ? { ...message, customer_read_at: readAt } : message)
        window.dispatchEvent(new Event('support:unread-changed'))
      } catch (cause) { error.value = errorText(cause, 'Could not mark replies as read.') }
    }
  }
  catch (cause) { error.value = errorText(cause, 'Could not load ticket.') }
  finally { loading.value = false }
}
const sendReply = async () => {
  if (saving.value || !canReply.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  if (!replyKey) replyKey = crypto.randomUUID()
  try {
    const response = await request(`/api/support/tickets/${ticket.value.id}/messages`, {
      method: 'POST', body: { message: reply.value, idempotencyKey: replyKey }
    })
    const file = fileInput.value?.files?.[0]
    if (file) {
      try { await upload(`/api/support/tickets/${ticket.value.id}/attachments`, response.item.id, file) }
      catch { notice.value = 'Reply sent, but the attachment failed. Please try again.' }
    }
    reply.value = ''
    replyKey = ''
    if (fileInput.value) fileInput.value.value = ''
    await load()
  } catch (cause) { error.value = errorText(cause, 'Could not send reply.') }
  finally { saving.value = false }
}
const changeStatus = async (status) => {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await request(`/api/support/tickets/${ticket.value.id}`, { method: 'PATCH', body: { status } })
    await load()
  } catch (cause) { error.value = errorText(cause, 'Could not update ticket.') }
  finally { saving.value = false }
}
const downloadFile = async file => {
  try { await download(file.id, file.original_name) }
  catch (cause) { error.value = errorText(cause, 'Could not download file.') }
}
onMounted(load)
watch(() => route.params.id, load)
useHead(() => ({ title: ticket.value ? `${supportReference(ticket.value.reference_number)} | ${uiLabel('Support')}` : uiLabel('Support Ticket') }))
</script>

<template>
  <div class="space-y-5">
    <NuxtLinkLocale to="/account/support" class="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><Icon name="lucide:arrow-left" size="16" class="directional-icon" /> {{ $t('common.myTickets') }}</NuxtLinkLocale>
    <p v-if="error" role="alert" class="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{{ $uiMessage(error) }}</p>
    <p v-if="notice" role="status" class="mt-5 rounded-xl bg-amber-50 p-4 text-amber-800">{{ $uiLabel(notice) }}</p>
    <p v-if="loading && !detail" class="mt-6 text-gray-500">{{ $t('common.loadingTicket') }}</p>
    <template v-else-if="ticket">
      <header class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-sm font-bold text-blue-700">{{ supportReference(ticket.reference_number) }}</p><h1 class="mt-2 text-2xl font-bold text-gray-900">{{ ticket.subject }}</h1><p class="mt-2 text-sm text-gray-500">{{ $t('common.createdValue', { value0: (supportDate(ticket.created_at)) }) }}<span v-if="detail.order"> {{ $t('common.orderValue', { value0: (detail.order.order_number || detail.order.id.slice(0, 8)) }) }}</span></p></div><span class="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">{{ $uiLabel(supportStatusLabel(ticket.status)) }}</span></div><div class="mt-5 flex flex-wrap gap-3"><button v-if="canReply" type="button" :disabled="saving" class="text-sm font-semibold text-gray-600 hover:text-gray-900" @click="changeStatus('closed')">{{ $t('common.closeTicket') }}</button><button v-else-if="canReopen" type="button" :disabled="saving" class="text-sm font-semibold text-blue-700" @click="changeStatus('open')">{{ $t('common.reopenTicket') }}</button></div></header>
      <p v-if="detail.sourceChat" class="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">{{ $t('account.support.createdFromLiveChatValueTheOriginalTranscriptAndFilesRemainInLiveChat', { value0: (detail.sourceChat.reference_number) }) }}</p>
      <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 class="mb-5 text-xl font-bold text-gray-900">{{ $t('common.conversation') }}</h2><SupportConversation :messages="detail.messages" :attachments="detail.attachments" :current-user-id="user?.sub || user?.id || ''" @download="downloadFile" /></section>
      <section v-if="canReply" class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 class="text-lg font-bold text-gray-900">{{ $t('common.reply') }}</h2><form class="mt-4 space-y-4" @submit.prevent="sendReply"><label class="block"><span class="sr-only">{{ $t('common.yourReply') }}</span><textarea v-model="reply" required maxlength="10000" rows="5" :placeholder="$t('common.writeYourReply')" class="w-full rounded-xl border border-gray-300 p-3 outline-none focus:border-blue-600" /></label><label class="block text-sm font-semibold text-gray-700">{{ $t('common.attachAFile') }}<input ref="fileInput" type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" class="mt-2 block w-full text-sm" /><span class="mt-1 block text-xs font-normal text-gray-500">{{ $t('common.upTo5Mb') }}</span></label><button type="submit" :disabled="saving" class="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-50">{{ saving ? $t('common.sending') : $t('common.sendReply') }}</button></form></section>
      <div v-else-if="!canReopen" class="mt-6 rounded-xl bg-white p-5 text-sm text-gray-600">{{ $t('account.support.thisTicketIsClosedCreateANewTicketIfYouStillNeedHelp') }}</div>
    </template>
  </div>
</template>
