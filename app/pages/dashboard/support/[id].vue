<script setup>
const { intlLocale } = useUiLocale()
const supportDate = value => baseSupportDate(value, intlLocale.value)

import { supportDate as baseSupportDate, supportPriorities, supportReference, supportStatusLabel, supportStatuses } from '~/utils/support'

definePageMeta({ layout: 'dashboard' })
const route = useUiRoute()
const { adminUser, hasPermission } = useAdminAccess()
const canReply = computed(() => hasPermission('support.reply'))
const canManage = computed(() => hasPermission('support.manage'))
const { request, upload, download, errorText } = useSupportClient()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const detail = ref(null)
const assignees = ref([])
const reply = ref('')
const internal = ref(false)
const fileInput = ref(null)
const statusInput = ref('')
const priorityInput = ref('')
const assigneeInput = ref('')
let replyKey = ''
const ticket = computed(() => detail.value?.ticket)
const load = async () => {
  loading.value = true; error.value = ''
  try {
    detail.value = await request(`/api/admin-support/tickets/${route.params.id}`)
    statusInput.value = detail.value.ticket.status
    priorityInput.value = detail.value.ticket.priority
    assigneeInput.value = detail.value.ticket.assigned_admin_id || ''
  } catch (cause) { error.value = errorText(cause, 'Could not load ticket.') }
  finally { loading.value = false }
}
const saveChanges = async () => {
  if (saving.value || !canManage.value) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    await request(`/api/admin-support/tickets/${ticket.value.id}`, { method: 'PATCH', body: {
      status: statusInput.value, priority: priorityInput.value, assignedAdminId: assigneeInput.value || null
    } })
    await load(); notice.value = 'Ticket updated.'
  } catch (cause) { error.value = errorText(cause, 'Could not update ticket.') }
  finally { saving.value = false }
}
const sendMessage = async () => {
  if (saving.value || !canReply.value) return
  saving.value = true; error.value = ''; notice.value = ''
  if (!replyKey) replyKey = crypto.randomUUID()
  try {
    const result = await request(`/api/admin-support/tickets/${ticket.value.id}/messages`, {
      method: 'POST', body: { message: reply.value, internal: internal.value, idempotencyKey: replyKey }
    })
    const file = fileInput.value?.files?.[0]
    if (file) {
      try { await upload(`/api/admin-support/tickets/${ticket.value.id}/attachments`, result.item.id, file) }
      catch { notice.value = 'Message sent, but the attachment failed.' }
    }
    reply.value = ''; replyKey = ''; internal.value = false
    if (fileInput.value) fileInput.value.value = ''
    await load()
    if (!notice.value) notice.value = 'Message sent.'
  } catch (cause) { error.value = errorText(cause, 'Could not send message.') }
  finally { saving.value = false }
}
const downloadFile = async file => {
  try { await download(file.id, file.original_name) }
  catch (cause) { error.value = errorText(cause, 'Could not download file.') }
}
onMounted(async () => { await load(); try { assignees.value = (await request('/api/admin-support/assignees')).items || [] } catch {} })
watch(() => route.params.id, load)
const eventLabel = (event) => {
  const action = ({ created: 'created the ticket', status: 'changed status', priority: 'changed priority', assignment: 'changed assignment', source_chat: 'linked the source chat' })[event.event_type] || 'updated the ticket'
  return `${event.actor_name || 'System'} ${action}`
}
</script>

<template>
  <div class="mx-auto max-w-[1500px] space-y-5 pb-8 text-gray-900"><NuxtLinkLocale to="/dashboard/support" class="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Icon name="lucide:arrow-left" size="16" class="directional-icon" /> {{ $t('common.allTickets') }}</NuxtLinkLocale><p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ $uiMessage(error) }}</p><p v-if="notice" role="status" class="rounded-xl bg-green-50 p-4 text-sm text-green-700">{{ $uiLabel(notice) }}</p><p v-if="loading && !detail" class="text-sm text-gray-500">{{ $t('common.loadingTicket') }}</p>
    <template v-else-if="ticket"><header class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div class="flex flex-wrap justify-between gap-4"><div><p class="text-sm font-bold text-blue-700">{{ supportReference(ticket.reference_number) }}</p><h1 class="mt-2 text-xl font-bold sm:text-2xl">{{ ticket.subject }}</h1><p class="mt-2 text-sm text-gray-500">{{ $t('dashboard.support.valueOpenedValue', { value0: (detail.category?.name || $t('common.other')), value1: (supportDate(ticket.created_at)) }) }}</p></div><span class="h-fit rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">{{ $uiLabel(supportStatusLabel(ticket.status, 'staff')) }}</span></div></header>
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div class="min-w-0 space-y-5"><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="mb-5 text-lg font-bold">{{ $t('common.conversation') }}</h2><SupportConversation :messages="detail.messages" :attachments="detail.attachments" :current-user-id="adminUser?.id || ''" @download="downloadFile" /></section><section v-if="canReply" class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">{{ $t('common.replyOrAddANote') }}</h2><form class="mt-4 space-y-4" @submit.prevent="sendMessage"><label class="block"><span class="sr-only">{{ $t('common.message') }}</span><textarea v-model="reply" required maxlength="10000" rows="5" :placeholder="$t('common.writeAMessage')" class="w-full rounded-xl border border-gray-200 p-3" /></label><label class="inline-flex items-center gap-2 text-sm font-semibold"><input v-model="internal" type="checkbox" /> {{ $t('dashboard.support.internalNoteHiddenFromCustomer') }}</label><label class="block text-sm font-semibold">{{ $t('common.attachment') }}<input ref="fileInput" type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" class="mt-2 block w-full text-sm" /><span class="mt-1 block text-xs font-normal text-gray-500">{{ $t('common.upTo5Mb') }}</span></label><button type="submit" :disabled="saving || (ticket.status === 'closed' && !internal)" class="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-50">{{ saving ? $t('common.sending') : internal ? $t('common.saveNote') : $t('common.sendReply') }}</button><p v-if="ticket.status === 'closed' && !internal" class="text-xs text-amber-700">{{ $t('dashboard.support.reopenThisTicketBeforeReplying') }}</p></form></section><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">{{ $t('common.history') }}</h2><ol class="mt-4 space-y-3"><li v-for="event in detail.events" :key="event.id" class="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-3 text-sm"><span>{{ eventLabel(event) }}<span v-if="['status', 'priority', 'assignment'].includes(event.event_type)" class="text-gray-500"> · {{ event.old_value || $t('common.unassigned') }} → {{ event.new_value || $t('common.unassigned') }}</span></span><time class="text-xs text-gray-500">{{ supportDate(event.created_at) }}</time></li></ol></section></div>
        <aside class="space-y-5"><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">{{ $t('common.ticketDetails') }}</h2><dl class="mt-4 space-y-3 text-sm"><div><dt class="text-gray-500">{{ $t('common.customer') }}</dt><dd class="font-semibold">{{ ticket.customer_name || $t('common.customer') }}</dd><dd class="break-all text-gray-600">{{ ticket.customer_email || ticket.customer_mobile || $t('common.noContactSaved') }}</dd></div><div><dt class="text-gray-500">{{ $t('common.relatedOrder') }}</dt><dd v-if="detail.order" class="font-semibold">{{ detail.order.order_number || detail.order.id }}</dd><dd v-else class="text-gray-600">{{ $t('dashboard.support.noneOrNoLongerAvailable') }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">{{ $t('common.orderStatus') }}</dt><dd class="font-semibold">{{ $uiLabel(detail.order.status) }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">{{ $t('common.paymentStatus') }}</dt><dd class="font-semibold capitalize">{{ $uiLabel(detail.order.payment_status || $t('common.unavailable')) }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">{{ $t('common.paymentMethod') }}</dt><dd>{{ $uiLabel(detail.order.payment_method || '—') }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">{{ $t('common.shippingMethod') }}</dt><dd>{{ $uiLabel(detail.order.shipping_method || '—') }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">{{ $t('common.shipmentStatus') }}</dt><dd>{{ detail.shippingJob?.provider_status_name || $t('common.notAvailable') }}</dd></div><div v-if="detail.shippingJob"><dt class="text-gray-500">{{ $t('common.shippingPreparation') }}</dt><dd class="capitalize">{{ $uiLabel(detail.shippingJob.state) }}</dd></div></dl><ul v-if="detail.orderItems?.length" class="mt-4 space-y-2 border-t pt-4 text-xs"><li v-for="(item, index) in detail.orderItems" :key="index">{{ item.quantity }} × {{ item.product_title }}</li></ul></section><section v-if="detail.sourceChat" class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">{{ $t('common.sourceChat') }}</h2><p class="mt-3 text-sm text-gray-600">{{ $t('dashboard.support.liveChatValueValue', { value0: (detail.sourceChat.reference_number), value1: ($uiLabel(detail.sourceChat.status)) }) }}</p><p class="mt-1 text-xs text-gray-500">{{ $t('dashboard.support.valueLinkedFilevalue', { value0: (detail.sourceChat.attachmentCount), value1: (detail.sourceChat.attachmentCount === 1 ? '' : $uiPluralSuffix('s')) }) }}</p><NuxtLinkLocale :to="`/dashboard/live-chat?conversation=${detail.sourceChat.id}`" class="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline">{{ $t('dashboard.support.openTranscriptAndFiles') }}</NuxtLinkLocale></section><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">{{ $t('common.manageTicket') }}</h2><form class="mt-4 space-y-3" @submit.prevent="saveChanges"><fieldset :disabled="!canManage || saving" class="space-y-3 disabled:opacity-60"><label class="block text-xs font-semibold">{{ $t('common.status') }}<select v-model="statusInput" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option v-for="status in supportStatuses" :key="status.value" :value="status.value">{{ $uiLabel(supportStatusLabel(status.value, 'staff')) }}</option></select></label><label class="block text-xs font-semibold">{{ $t('common.priority') }}<select v-model="priorityInput" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option v-for="priority in supportPriorities" :key="priority" :value="priority" class="capitalize">{{ $uiLabel(priority) }}</option></select></label><label class="block text-xs font-semibold">{{ $t('common.assignedTo') }}<select v-model="assigneeInput" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">{{ $t('common.unassigned') }}</option><option v-for="admin in assignees" :key="admin.id" :value="admin.id">{{ admin.name }}</option></select></label><button v-if="canManage" type="submit" class="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">{{ $t('common.saveChanges') }}</button></fieldset><p v-if="!canManage" class="text-xs text-gray-500">{{ $t('dashboard.support.youCanViewThisTicketButCannotChangeIt') }}</p></form></section></aside>
      </div>
    </template>
  </div>
</template>
