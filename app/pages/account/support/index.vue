<script setup>
import { supportDate, supportReference, supportStatusLabel } from '~/utils/support'

definePageMeta({ middleware: 'customer-auth' })
useHead({ title: 'My Support Tickets' })

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
      request('/api/support/orders')
    ])
    tickets.value = ticketData.items || []
    total.value = ticketData.total || 0
    categories.value = helpData.categories || []
    orders.value = orderData.items || []
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
  <div class="min-h-screen bg-gray-100 py-8">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow"><div><p class="text-sm font-semibold text-blue-600">Customer Account</p><h1 class="mt-1 text-3xl font-bold text-gray-900">Support</h1><p class="mt-2 text-sm text-gray-500">View your tickets or ask us a question.</p></div><NuxtLink to="/help" class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 font-semibold text-gray-700 hover:bg-gray-50"><Icon name="lucide:book-open" size="18" /> Help Center</NuxtLink></div>
      <p v-if="error" role="alert" class="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
      <p v-if="notice" role="status" class="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{{ notice }}</p>
      <div class="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside class="h-fit rounded-3xl bg-white p-5 shadow"><p class="px-3 text-xs font-bold uppercase tracking-widest text-gray-400">Account</p><AccountNavigation /></aside>
        <div class="min-w-0 space-y-6">
          <section class="rounded-3xl bg-white p-6 shadow">
            <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-bold text-gray-900">My tickets</h2><p class="mt-1 text-sm text-gray-500">{{ total }} total</p></div><button type="button" class="min-h-11 rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-700" @click="showForm = !showForm">{{ showForm ? 'Cancel' : 'Create ticket' }}</button></div>
            <p v-if="loading" class="py-8 text-sm text-gray-500">Loading tickets...</p>
            <div v-else-if="tickets.length" class="mt-5 divide-y divide-gray-100">
              <NuxtLink v-for="ticket in tickets" :key="ticket.id" :to="`/account/support/${ticket.id}`" class="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-blue-700"><div class="min-w-0"><p class="text-xs font-bold text-blue-700">{{ supportReference(ticket.reference_number) }}</p><p class="mt-1 font-semibold text-gray-900">{{ ticket.subject }}</p><p class="mt-1 text-xs text-gray-500">Updated {{ supportDate(ticket.updated_at) }}</p></div><span v-if="ticket.unreadReplyCount" class="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">New reply</span><span class="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">{{ supportStatusLabel(ticket.status) }}</span></NuxtLink>
            </div>
            <p v-else class="mt-5 rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">No tickets yet. Start with the Help Center or create one below.</p>
            <div v-if="total > 20" class="mt-5 flex items-center justify-between"><button type="button" :disabled="page <= 1" class="text-sm font-semibold text-blue-700 disabled:opacity-40" @click="page--">Previous</button><span class="text-sm text-gray-500">Page {{ page }}</span><button type="button" :disabled="page * 20 >= total" class="text-sm font-semibold text-blue-700 disabled:opacity-40" @click="page++">Next</button></div>
          </section>
          <section v-if="showForm" class="rounded-3xl bg-white p-6 shadow"><h2 class="text-xl font-bold">Create a ticket</h2><p class="mt-1 text-sm text-gray-500">Tell us what happened. We will reply here.</p>
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
    </div>
  </div>
</template>
