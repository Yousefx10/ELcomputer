<script setup>
import { supportDate, supportPriorities, supportReference, supportStatusLabel, supportStatuses } from '~/utils/support'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
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
const eventLabel = event => ({ created: 'Ticket created', status: 'Status changed', priority: 'Priority changed', assignment: 'Assignment changed' })[event.event_type] || 'Updated'
</script>

<template>
  <div class="mx-auto max-w-[1500px] space-y-5 pb-8 text-gray-900"><NuxtLink to="/dashboard/support" class="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Icon name="lucide:arrow-left" size="16" /> All tickets</NuxtLink><p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p><p v-if="notice" role="status" class="rounded-xl bg-green-50 p-4 text-sm text-green-700">{{ notice }}</p><p v-if="loading && !detail" class="text-sm text-gray-500">Loading ticket...</p>
    <template v-else-if="ticket"><header class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div class="flex flex-wrap justify-between gap-4"><div><p class="text-sm font-bold text-blue-700">{{ supportReference(ticket.reference_number) }}</p><h1 class="mt-2 text-xl font-bold sm:text-2xl">{{ ticket.subject }}</h1><p class="mt-2 text-sm text-gray-500">{{ detail.category?.name || 'Other' }} · Opened {{ supportDate(ticket.created_at) }}</p></div><span class="h-fit rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">{{ supportStatusLabel(ticket.status, 'staff') }}</span></div></header>
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div class="min-w-0 space-y-5"><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="mb-5 text-lg font-bold">Conversation</h2><SupportConversation :messages="detail.messages" :attachments="detail.attachments" :current-user-id="adminUser?.id || ''" @download="downloadFile" /></section><section v-if="canReply" class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">Reply or add a note</h2><form class="mt-4 space-y-4" @submit.prevent="sendMessage"><label class="block"><span class="sr-only">Message</span><textarea v-model="reply" required maxlength="10000" rows="5" placeholder="Write a message" class="w-full rounded-xl border border-gray-200 p-3" /></label><label class="inline-flex items-center gap-2 text-sm font-semibold"><input v-model="internal" type="checkbox" /> Internal note — hidden from customer</label><label class="block text-sm font-semibold">Attachment<input ref="fileInput" type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" class="mt-2 block w-full text-sm" /><span class="mt-1 block text-xs font-normal text-gray-500">Up to 5 MB.</span></label><button type="submit" :disabled="saving || (ticket.status === 'closed' && !internal)" class="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-50">{{ saving ? 'Sending...' : internal ? 'Save note' : 'Send reply' }}</button><p v-if="ticket.status === 'closed' && !internal" class="text-xs text-amber-700">Reopen this ticket before replying.</p></form></section><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">History</h2><ol class="mt-4 space-y-3"><li v-for="event in detail.events" :key="event.id" class="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-3 text-sm"><span>{{ eventLabel(event) }}<span v-if="event.event_type !== 'created'" class="text-gray-500"> · {{ event.old_value || 'Unassigned' }} → {{ event.new_value || 'Unassigned' }}</span></span><time class="text-xs text-gray-500">{{ supportDate(event.created_at) }}</time></li></ol></section></div>
        <aside class="space-y-5"><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">Ticket details</h2><dl class="mt-4 space-y-3 text-sm"><div><dt class="text-gray-500">Customer</dt><dd class="font-semibold">{{ ticket.customer_name || 'Customer' }}</dd><dd class="break-all text-gray-600">{{ ticket.customer_email }}</dd></div><div><dt class="text-gray-500">Related order</dt><dd v-if="detail.order" class="font-semibold">{{ detail.order.order_number || detail.order.id }}</dd><dd v-else class="text-gray-600">None or no longer available</dd></div><div v-if="detail.order"><dt class="text-gray-500">Order status</dt><dd class="font-semibold">{{ detail.order.status }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">Payment status</dt><dd class="font-semibold capitalize">{{ detail.order.payment_status || 'Unavailable' }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">Payment method</dt><dd>{{ detail.order.payment_method || '—' }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">Shipping method</dt><dd>{{ detail.order.shipping_method || '—' }}</dd></div><div v-if="detail.order"><dt class="text-gray-500">Shipment status</dt><dd>{{ detail.shippingJob?.provider_status_name || 'Not available' }}</dd></div><div v-if="detail.shippingJob"><dt class="text-gray-500">Shipping preparation</dt><dd class="capitalize">{{ detail.shippingJob.state }}</dd></div></dl><ul v-if="detail.orderItems?.length" class="mt-4 space-y-2 border-t pt-4 text-xs"><li v-for="(item, index) in detail.orderItems" :key="index">{{ item.quantity }} × {{ item.product_title }}</li></ul></section><section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 class="font-bold">Manage ticket</h2><form class="mt-4 space-y-3" @submit.prevent="saveChanges"><fieldset :disabled="!canManage || saving" class="space-y-3 disabled:opacity-60"><label class="block text-xs font-semibold">Status<select v-model="statusInput" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option v-for="status in supportStatuses" :key="status.value" :value="status.value">{{ supportStatusLabel(status.value, 'staff') }}</option></select></label><label class="block text-xs font-semibold">Priority<select v-model="priorityInput" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option v-for="priority in supportPriorities" :key="priority" :value="priority" class="capitalize">{{ priority }}</option></select></label><label class="block text-xs font-semibold">Assigned to<select v-model="assigneeInput" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">Unassigned</option><option v-for="admin in assignees" :key="admin.id" :value="admin.id">{{ admin.name }}</option></select></label><button v-if="canManage" type="submit" class="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Save changes</button></fieldset><p v-if="!canManage" class="text-xs text-gray-500">You can view this ticket but cannot change it.</p></form></section></aside>
      </div>
    </template>
  </div>
</template>
