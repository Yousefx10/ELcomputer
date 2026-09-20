<script setup>
import { supportDate, supportReference, supportStatusLabel } from '~/utils/support'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
useHead({ title: 'My Support Tickets' })

const route = useRoute()
const { request, upload, errorText } = useSupportClient()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const tickets = ref([])
const total = ref(0)
const page = ref(1)
const categories = ref([])
const orders = ref([])
const showForm = ref(false)
const fileInput = ref(null)
const form = reactive({ subject: '', message: '', categoryId: '', orderId: '' })
let submissionKey = ''

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [ticketData, helpData, orderData] = await Promise.all([
      request('/api/support/tickets', { query: { page: page.value } }),
      $fetch('/api/help'),
      request('/api/support/orders', { query: { orderId: route.query.order || '' } })
    ])
    tickets.value = ticketData.items || []
    total.value = ticketData.total || 0
    categories.value = helpData.categories || []
    orders.value = orderData.items || []
    if (route.query.order && orders.value.some(order => order.id === route.query.order)) {
      form.orderId = route.query.order
      showForm.value = true
    }
  } catch (cause) { error.value = errorText(cause, 'Could not load support tickets.') }
  finally { loading.value = false }
}

const createTicket = async () => {
  if (saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  if (!submissionKey) submissionKey = crypto.randomUUID()
  try {
    const response = await request('/api/support/tickets', { method: 'POST', body: {
      subject: form.subject, message: form.message,
      categoryId: form.categoryId || null, orderId: form.orderId || null,
      idempotencyKey: submissionKey
    } })
    const file = fileInput.value?.files?.[0]
    if (file && response.messageId) {
      try {
        await upload(`/api/support/tickets/${response.item.id}/attachments`, response.messageId, file)
      } catch {
        notice.value = 'Ticket created, but the file could not be attached.'
      }
    }
    submissionKey = ''
    await navigateTo({ path: `/account/support/${response.item.id}`, query: notice.value ? { attachment: 'failed' } : {} })
  } catch (cause) { error.value = errorText(cause, 'Could not create ticket.') }
  finally { saving.value = false }
}

onMounted(load)
watch(page, load)
</script>

<template>
  <div class="space-y-5">
      <header class="flex flex-wrap items-end justify-between gap-3"><div><p class="text-sm font-semibold text-blue-700">Your account</p><h1 class="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Support</h1><p class="mt-1 text-sm text-slate-600">Ask a question or follow an existing ticket.</p></div><NuxtLink to="/help" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><Icon name="lucide:book-open" size="17" aria-hidden="true" /> Help Center</NuxtLink></header>
      <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
      <p v-if="notice" role="status" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ notice }}</p>
      <div class="space-y-5">
          <section class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-bold text-gray-900">My tickets</h2><p class="mt-1 text-sm text-gray-500">{{ total }} total</p></div><button type="button" class="min-h-11 rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-700" @click="showForm = !showForm">{{ showForm ? 'Cancel' : 'Create ticket' }}</button></div>
            <p v-if="loading" class="py-8 text-sm text-gray-500">Loading tickets...</p>
            <div v-else-if="tickets.length" class="mt-5 divide-y divide-gray-100">
              <NuxtLink v-for="ticket in tickets" :key="ticket.id" :to="`/account/support/${ticket.id}`" class="flex flex-wrap items-center justify-between gap-3 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 hover:text-blue-700"><div class="min-w-0"><p class="text-xs font-bold text-blue-700">{{ supportReference(ticket.reference_number) }}</p><p class="mt-1 font-semibold text-gray-900">{{ ticket.subject }}</p><p class="mt-1 text-xs text-gray-500">Created {{ supportDate(ticket.created_at) }} · Updated {{ supportDate(ticket.updated_at) }}<span v-if="ticket.order_id"> · Order {{ orders.find(order => order.id === ticket.order_id)?.order_number || ticket.order_id.slice(0, 8) }}</span></p></div><span v-if="ticket.unreadReplyCount" class="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">New reply</span><span class="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">{{ supportStatusLabel(ticket.status) }}</span></NuxtLink>
            </div>
            <p v-else class="mt-5 rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">No tickets yet. Start with the Help Center or create one below.</p>
            <div v-if="total > 20" class="mt-5 flex items-center justify-between"><button type="button" :disabled="page <= 1" class="text-sm font-semibold text-blue-700 disabled:opacity-40" @click="page--">Previous</button><span class="text-sm text-gray-500">Page {{ page }}</span><button type="button" :disabled="page * 20 >= total" class="text-sm font-semibold text-blue-700 disabled:opacity-40" @click="page++">Next</button></div>
          </section>
          <section v-if="showForm" class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 class="text-xl font-bold">Create a ticket</h2><p class="mt-1 text-sm text-gray-500">Tell us what happened. We will reply here.</p>
            <form class="mt-6 space-y-4" @submit.prevent="createTicket">
              <label class="block text-sm font-semibold text-gray-700">Subject<input v-model="form.subject" required maxlength="160" class="mt-2 min-h-11 w-full rounded-xl border border-gray-300 px-3 outline-none focus:border-blue-600" /></label>
              <div class="grid gap-4 sm:grid-cols-2"><label class="block text-sm font-semibold text-gray-700">Topic<select v-model="form.categoryId" class="mt-2 min-h-11 w-full rounded-xl border border-gray-300 px-3"><option value="">Choose a topic (optional)</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label class="block text-sm font-semibold text-gray-700">Related order<select v-model="form.orderId" class="mt-2 min-h-11 w-full rounded-xl border border-gray-300 px-3"><option value="">No order</option><option v-for="order in orders" :key="order.id" :value="order.id">{{ order.order_number || order.id.slice(0, 8) }}</option></select></label></div>
              <label class="block text-sm font-semibold text-gray-700">Message<textarea v-model="form.message" required maxlength="10000" rows="6" class="mt-2 w-full rounded-xl border border-gray-300 p-3 outline-none focus:border-blue-600" /></label>
              <label class="block text-sm font-semibold text-gray-700">Attachment (optional)<input ref="fileInput" type="file" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" class="mt-2 block w-full text-sm" /><span class="mt-1 block text-xs font-normal text-gray-500">PDF, TXT, JPG, PNG, or WebP. Up to 5 MB.</span></label>
              <button type="submit" :disabled="saving" class="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-50">{{ saving ? 'Sending...' : 'Send ticket' }}</button>
            </form>
          </section>
        </div>
  </div>
</template>
