<script setup>
import { supportDate, supportPriorities, supportReference, supportStatusLabel, supportStatuses } from '~/utils/support'

definePageMeta({ layout: 'dashboard' })
const { request, errorText } = useSupportClient()
const filters = reactive({ status: '', priority: '', category: '', assignee: '', reference: '', customer: '', subject: '', order: '', from: '', to: '' })
const applied = ref({})
const page = ref(1)
const loading = ref(true)
const error = ref('')
const tickets = ref([])
const total = ref(0)
const needsAttentionCount = ref(0)
const categories = ref([])
const assignees = ref([])
const load = async () => {
  loading.value = true; error.value = ''
  try {
    const result = await request('/api/admin-support/tickets', { query: { ...applied.value, page: page.value } })
    tickets.value = result.items || []; total.value = result.total || 0
    needsAttentionCount.value = result.needsAttentionCount || 0
  } catch (cause) { error.value = errorText(cause, 'Could not load tickets.') }
  finally { loading.value = false }
}
const applyFilters = () => { page.value = 1; applied.value = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)); load() }
const clearFilters = () => { Object.keys(filters).forEach(key => { filters[key] = '' }); applied.value = {}; page.value = 1; load() }
onMounted(async () => {
  await load()
  try {
    const [categoryResult, assigneeResult] = await Promise.all([
      request('/api/admin-help/categories'), request('/api/admin-support/assignees')
    ])
    categories.value = categoryResult.items || []
    assignees.value = assigneeResult.items || []
  } catch { /* Ticket list remains usable if filters cannot load. */ }
})
watch(page, load)
</script>

<template>
  <div class="mx-auto max-w-[1500px] space-y-5 pb-8">
    <DashboardPageIntro title="Customer Support" description="Reply to customer tickets and track open work." />
    <NuxtLink to="/dashboard/live-chat" class="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Open Live Chat inbox →</NuxtLink>
    <section class="rounded-2xl border border-blue-100 bg-blue-50 p-5" aria-live="polite">
      <p class="text-sm font-semibold text-blue-800">Needs attention</p>
      <p class="mt-1 text-3xl font-bold text-blue-900">{{ needsAttentionCount }}</p>
      <p class="mt-1 text-xs text-blue-700">New tickets and customer replies.</p>
    </section>
    <form class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" @submit.prevent="applyFilters"><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label class="text-xs font-semibold text-gray-600">Status<select v-model="filters.status" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">All statuses</option><option v-for="status in supportStatuses" :key="status.value" :value="status.value">{{ supportStatusLabel(status.value, 'staff') }}</option></select></label><label class="text-xs font-semibold text-gray-600">Priority<select v-model="filters.priority" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">All priorities</option><option v-for="priority in supportPriorities" :key="priority" :value="priority" class="capitalize">{{ priority }}</option></select></label><label class="text-xs font-semibold text-gray-600">Category<select v-model="filters.category" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">All categories</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label class="text-xs font-semibold text-gray-600">Assigned to<select v-model="filters.assignee" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"><option value="">Anyone</option><option value="unassigned">Unassigned</option><option v-for="admin in assignees" :key="admin.id" :value="admin.id">{{ admin.name }}</option></select></label><label class="text-xs font-semibold text-gray-600">Reference<input v-model="filters.reference" placeholder="SUP-000001" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label class="text-xs font-semibold text-gray-600">Customer email<input v-model="filters.customer" type="search" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label class="text-xs font-semibold text-gray-600">Subject<input v-model="filters.subject" type="search" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label class="text-xs font-semibold text-gray-600">Order ID<input v-model="filters.order" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label class="text-xs font-semibold text-gray-600">Created after<input v-model="filters.from" type="date" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label><label class="text-xs font-semibold text-gray-600">Created before<input v-model="filters.to" type="date" class="mt-1 min-h-10 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label></div><div class="mt-4 flex gap-2"><button type="submit" class="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Filter</button><button type="button" class="min-h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold" @click="clearFilters">Clear</button></div></form>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div class="flex items-center justify-between border-b border-gray-100 p-5"><h2 class="font-bold text-gray-900">Tickets</h2><span class="text-sm text-gray-500">{{ total }} total</span></div><p v-if="loading" class="p-6 text-sm text-gray-500">Loading tickets...</p><div v-else-if="tickets.length" class="divide-y divide-gray-100"><NuxtLink v-for="ticket in tickets" :key="ticket.id" :to="`/dashboard/support/${ticket.id}`" class="grid gap-2 p-5 hover:bg-blue-50 sm:grid-cols-[1fr_auto] sm:items-center"><div class="min-w-0"><p class="text-xs font-bold text-blue-700">{{ supportReference(ticket.reference_number) }}</p><h3 class="mt-1 truncate font-bold text-gray-900">{{ ticket.subject }}</h3><p class="mt-1 truncate text-xs text-gray-500">{{ ticket.customer_name || ticket.customer_email }} · {{ ticket.customer_email }} · {{ supportDate(ticket.updated_at) }}</p></div><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{{ supportStatusLabel(ticket.status, 'staff') }}</span><span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700">{{ ticket.priority }}</span></div></NuxtLink></div><p v-else class="p-8 text-center text-sm text-gray-500">No tickets match these filters.</p><div v-if="total > 30" class="flex items-center justify-between border-t border-gray-100 p-4"><button type="button" :disabled="page <= 1" class="text-sm font-semibold text-blue-700 disabled:opacity-40" @click="page--">Previous</button><span class="text-xs text-gray-500">Page {{ page }}</span><button type="button" :disabled="page * 30 >= total" class="text-sm font-semibold text-blue-700 disabled:opacity-40" @click="page++">Next</button></div></section>
  </div>
</template>
