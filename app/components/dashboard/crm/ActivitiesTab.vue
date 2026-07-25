<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-5 shadow sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-2xl font-bold text-gray-900">Store CRM Activity</h3>
          <p class="mt-1 text-sm text-gray-500">
            Calls and ticket events use the store reporting timezone (Asia/Riyadh).
          </p>
          <p v-if="statsRangeLabel" class="mt-2 text-xs font-medium text-gray-400">
            {{ statsRangeLabel }}
          </p>
        </div>

        <fieldset>
          <legend class="sr-only">CRM statistics period</legend>
          <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <label
              v-for="option in statsPeriodOptions"
              :key="option.value"
              class="cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
              :class="statsPeriod === option.value
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'"
            >
              <input
                v-model="statsPeriod"
                type="radio"
                name="crm-stats-period"
                :value="option.value"
                class="sr-only"
              >
              {{ option.label }}
            </label>
          </div>
        </fieldset>
      </div>

      <p
        v-if="statsError"
        class="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
        role="alert"
      >
        {{ statsError }}
      </p>

      <div class="mt-5 grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl border bg-gray-50 p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Completed Calls</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">
                {{ statsLoading ? '—' : stats.calls }}
              </p>
            </div>
            <span class="rounded-2xl bg-blue-100 p-3 text-blue-600">
              <Icon name="lucide:phone-call" size="24" />
            </span>
          </div>
        </div>

        <div class="rounded-2xl border bg-gray-50 p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Tickets Created</p>
              <p class="mt-2 text-3xl font-bold text-amber-700">
                {{ statsLoading ? '—' : stats.raisedTickets }}
              </p>
            </div>
            <span class="rounded-2xl bg-amber-100 p-3 text-amber-600">
              <Icon name="lucide:ticket-plus" size="24" />
            </span>
          </div>
        </div>

        <div class="rounded-2xl border bg-gray-50 p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Tickets Closed</p>
              <p class="mt-2 text-3xl font-bold text-emerald-700">
                {{ statsLoading ? '—' : stats.closedTickets }}
              </p>
            </div>
            <span class="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
              <Icon name="lucide:ticket-check" size="24" />
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl bg-white shadow">
      <div class="border-b p-5 sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">Tickets & Activity</h3>
            <p class="mt-1 text-sm text-gray-500">
              Search by contact, review tickets, or open a complete activity record.
            </p>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
              @click="openCreateDialog('call')"
            >
              <Icon name="lucide:phone-call" size="18" />
              Record Call
            </button>
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              @click="openCreateDialog('ticket')"
            >
              <Icon name="lucide:ticket-plus" size="18" />
              Create Ticket
            </button>
          </div>
        </div>

        <div class="mt-6 max-w-2xl">
          <DashboardCrmContactPicker
            v-model="selectedContactId"
            input-id="crm-page-contact"
            label="Find CRM Contact"
            placeholder="Type a company or person name, then choose the result"
          />
          <p class="mt-2 text-xs text-gray-400">
            Choosing a contact filters the current panel. Leave it clear to view everyone.
          </p>
        </div>
      </div>

      <nav class="flex gap-2 border-b px-5 pt-4 sm:px-6" aria-label="CRM activity panels">
        <button
          v-for="panel in panels"
          :key="panel.value"
          type="button"
          class="inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition"
          :class="activePanel === panel.value
            ? 'border-blue-600 text-blue-700'
            : 'border-transparent text-gray-500 hover:text-gray-900'"
          :aria-current="activePanel === panel.value ? 'page' : undefined"
          @click="setActivePanel(panel.value)"
        >
          <Icon :name="panel.icon" size="17" />
          {{ panel.label }}
        </button>
      </nav>

      <p
        v-if="successMessage"
        class="mx-5 mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 sm:mx-6"
        role="status"
      >
        {{ successMessage }}
      </p>

      <div v-if="activePanel === 'tickets'" class="p-5 sm:p-6">
        <div class="rounded-2xl bg-gray-50 p-4">
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <div>
              <label for="crm-ticket-search" class="mb-2 block text-sm font-semibold text-gray-700">
                Search Ticket Subject
              </label>
              <div class="relative">
                <input
                  id="crm-ticket-search"
                  v-model="ticketFilters.search"
                  type="search"
                  maxlength="100"
                  placeholder="Search by ticket subject"
                  class="w-full rounded-xl border bg-white p-3 pe-11 outline-none focus:border-blue-500"
                >
                <Icon name="lucide:search" size="18" class="absolute end-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label for="crm-ticket-status" class="mb-2 block text-sm font-semibold text-gray-700">
                Status
              </label>
              <select
                id="crm-ticket-status"
                v-model="ticketFilters.status"
                class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
              >
                <option value="">Open and Closed</option>
                <option value="raised">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label for="crm-ticket-priority" class="mb-2 block text-sm font-semibold text-gray-700">
                Priority
              </label>
              <select
                id="crm-ticket-priority"
                v-model="ticketFilters.priority"
                class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div class="flex items-end">
              <button
                type="button"
                :disabled="!hasTicketFilters || ticketsLoading"
                class="min-h-11 w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                @click="clearTicketFilters"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-500">
            <template v-if="ticketTotal">
              Showing {{ ticketPageStart }}–{{ ticketPageEnd }} of {{ ticketTotal }} tickets
            </template>
            <template v-else>No tickets found</template>
          </p>
          <p class="text-sm font-medium text-gray-500">20 results per page</p>
        </div>

        <p
          v-if="ticketsError"
          class="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
          role="alert"
        >
          {{ ticketsError }}
        </p>

        <div v-else-if="ticketsLoading" class="py-12 text-center text-gray-500">
          <Icon name="lucide:loader-circle" size="24" class="mx-auto animate-spin" />
          <p class="mt-3">Loading tickets...</p>
        </div>

        <div v-else-if="!tickets.length" class="py-12 text-center text-gray-500">
          <Icon name="lucide:ticket" size="30" class="mx-auto text-gray-300" />
          <p class="mt-3">No open or closed tickets match these filters.</p>
        </div>

        <div v-else class="mt-4 space-y-3">
          <button
            v-for="ticket in tickets"
            :key="ticket.id"
            type="button"
            class="grid w-full gap-4 rounded-2xl border p-4 text-start transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:p-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(160px,0.9fr)_140px_170px_28px] lg:items-center"
            @click="openActivityDetails(ticket.id)"
          >
            <span class="min-w-0">
              <span class="flex flex-wrap items-center gap-2">
                <span class="truncate font-bold text-gray-900" dir="auto">{{ ticket.subject }}</span>
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase"
                  :class="getStatusClass(ticket.status)"
                >
                  {{ getStatusLabel(ticket.status) }}
                </span>
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase"
                  :class="getPriorityClass(ticket.priority)"
                >
                  {{ ticket.priority || 'normal' }}
                </span>
              </span>
              <span class="mt-2 block truncate text-sm font-medium text-gray-600">
                {{ ticket.contact?.name || 'Deleted CRM contact' }}
              </span>
              <span class="mt-1 block text-xs text-gray-400">
                Ticket #{{ getTicketNumber(ticket.id) }}
              </span>
            </span>

            <span class="text-sm text-gray-500">
              <span class="block text-xs font-semibold uppercase text-gray-400">Contact</span>
              <span class="mt-1 block">{{ getContactMeta(ticket.contact) }}</span>
            </span>

            <span class="text-sm text-gray-500">
              <span class="block text-xs font-semibold uppercase text-gray-400">Raised</span>
              <time :datetime="ticket.occurredAt" class="mt-1 block">
                {{ formatCrmDate(ticket.occurredAt) }}
              </time>
            </span>

            <span class="text-sm text-gray-500">
              <span class="block text-xs font-semibold uppercase text-gray-400">
                {{ ticket.closedAt ? 'Closed' : 'Current Status' }}
              </span>
              <time v-if="ticket.closedAt" :datetime="ticket.closedAt" class="mt-1 block">
                {{ formatCrmDate(ticket.closedAt) }}
              </time>
              <span v-else class="mt-1 block font-semibold text-amber-700">Waiting for resolution</span>
            </span>

            <Icon name="lucide:chevron-right" size="20" class="hidden text-gray-400 lg:block" />
          </button>
        </div>

        <DashboardCrmPagination
          :page="ticketPage"
          :total-pages="ticketTotalPages"
          :loading="ticketsLoading"
          label="Ticket pages"
          @change="loadTickets"
        />
      </div>

      <div v-else class="p-5 sm:p-6">
        <div class="rounded-2xl bg-gray-50 p-4">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_150px_150px_auto]">
            <div>
              <label for="crm-history-search" class="mb-2 block text-sm font-semibold text-gray-700">
                Search Subject
              </label>
              <div class="relative">
                <input
                  id="crm-history-search"
                  v-model="historyFilters.search"
                  type="search"
                  maxlength="100"
                  placeholder="Search call or ticket subject"
                  class="w-full rounded-xl border bg-white p-3 pe-11 outline-none focus:border-blue-500"
                >
                <Icon name="lucide:search" size="18" class="absolute end-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <div>
              <label for="crm-history-type" class="mb-2 block text-sm font-semibold text-gray-700">
                Activity
              </label>
              <select
                id="crm-history-type"
                v-model="historyFilters.activityType"
                class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
              >
                <option value="">Calls and Tickets</option>
                <option value="call">Calls</option>
                <option value="case">Tickets</option>
              </select>
            </div>

            <div>
              <label for="crm-history-status" class="mb-2 block text-sm font-semibold text-gray-700">
                Status
              </label>
              <select
                id="crm-history-status"
                v-model="historyFilters.status"
                class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
              >
                <option
                  v-for="option in historyStatusOptions"
                  :key="option.value || 'all'"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div>
              <label for="crm-history-from" class="mb-2 block text-sm font-semibold text-gray-700">
                From
              </label>
              <input
                id="crm-history-from"
                v-model="historyFilters.fromDate"
                type="date"
                class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label for="crm-history-to" class="mb-2 block text-sm font-semibold text-gray-700">
                To
              </label>
              <input
                id="crm-history-to"
                v-model="historyFilters.toDate"
                type="date"
                class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div class="flex items-end">
              <button
                type="button"
                :disabled="!hasHistoryFilters || historyLoading"
                class="min-h-11 w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                @click="clearHistoryFilters"
              >
                Clear
              </button>
            </div>
          </div>
          <p class="mt-3 text-xs text-gray-400">
            Date filters use the call/raised date, and the closing date once a ticket is closed.
          </p>
        </div>

        <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-500">
            <template v-if="historyTotal">
              Showing {{ historyPageStart }}–{{ historyPageEnd }} of {{ historyTotal }} activities
            </template>
            <template v-else>No activities found</template>
          </p>
          <p class="text-sm font-medium text-gray-500">20 results per page</p>
        </div>

        <p
          v-if="historyError"
          class="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
          role="alert"
        >
          {{ historyError }}
        </p>

        <div v-else-if="historyLoading" class="py-12 text-center text-gray-500">
          <Icon name="lucide:loader-circle" size="24" class="mx-auto animate-spin" />
          <p class="mt-3">Loading activity history...</p>
        </div>

        <div v-else-if="!history.length" class="py-12 text-center text-gray-500">
          <Icon name="lucide:history" size="30" class="mx-auto text-gray-300" />
          <p class="mt-3">No activities match these filters.</p>
        </div>

        <div v-else class="mt-4 space-y-3">
          <button
            v-for="activityItem in history"
            :key="activityItem.id"
            type="button"
            class="flex w-full items-start gap-4 rounded-2xl border p-4 text-start transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:p-5"
            @click="openActivityDetails(activityItem.id)"
          >
            <span
              class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              :class="activityItem.activityType === 'call'
                ? 'bg-blue-100 text-blue-600'
                : activityItem.status === 'closed'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-amber-100 text-amber-600'"
            >
              <Icon
                :name="activityItem.activityType === 'call'
                  ? 'lucide:phone-call'
                  : activityItem.status === 'closed'
                    ? 'lucide:ticket-check'
                    : 'lucide:ticket'"
                size="20"
              />
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="truncate font-bold text-gray-900" dir="auto">{{ activityItem.subject }}</span>
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase"
                  :class="getStatusClass(activityItem.status)"
                >
                  {{ getStatusLabel(activityItem.status) }}
                </span>
              </span>

              <span class="mt-2 block text-sm font-medium text-gray-600">
                {{ activityItem.contact?.name || 'Deleted CRM contact' }}
                <span class="font-normal text-gray-400"> · {{ getContactMeta(activityItem.contact) }}</span>
              </span>

              <span
                v-if="activityItem.preview"
                dir="auto"
                class="mt-3 line-clamp-3 break-words text-sm leading-6 text-gray-500"
              >
                {{ activityItem.preview }}
              </span>

              <span class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>
                  {{ activityItem.activityType === 'call' ? 'Call' : 'Raised' }}
                  {{ formatCrmDate(activityItem.occurredAt) }}
                </span>
                <span v-if="activityItem.closedAt">
                  Closed {{ formatCrmDate(activityItem.closedAt) }}
                </span>
                <span class="font-semibold text-blue-600">View full details</span>
              </span>
            </span>

            <Icon name="lucide:chevron-right" size="20" class="mt-2 shrink-0 text-gray-400" />
          </button>
        </div>

        <DashboardCrmPagination
          :page="historyPage"
          :total-pages="historyTotalPages"
          :loading="historyLoading"
          label="Activity history pages"
          @change="loadHistory"
        />
      </div>
    </section>

    <DashboardCrmActivityDialog
      :open="dialog.open"
      :mode="dialog.mode"
      :activity-id="dialog.activityId"
      :initial-contact-id="selectedContactId"
      @close="closeDialog"
      @saved="handleActivitySaved"
    />
  </div>
</template>

<script setup>
import {
  CRM_TIME_ZONE,
  formatCrmDate,
  toCrmDateBoundary
} from '~/utils/crmDateTime'

const route = useRoute()
const router = useRouter()
const { getAdminAuthHeaders } = useAdminLogs()
const PAGE_SIZE = 20

const panels = [
  {
    value: 'tickets',
    label: 'Tickets',
    icon: 'lucide:ticket'
  },
  {
    value: 'history',
    label: 'Activity History',
    icon: 'lucide:history'
  }
]

const statsPeriodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' }
]

const getRouteQueryValue = (value) => {
  return String(Array.isArray(value) ? value[0] : value || '').trim()
}

const requestedPanel = getRouteQueryValue(route.query.panel).toLowerCase()
const selectedContactId = ref(getRouteQueryValue(route.query.contact))
const activePanel = ref(
  requestedPanel === 'history' || (!requestedPanel && selectedContactId.value)
    ? 'history'
    : 'tickets'
)
const successMessage = ref('')
const statsPeriod = ref('today')
const statsLoading = ref(false)
const statsError = ref('')
const statsFrom = ref('')
const statsToExclusive = ref('')
const stats = reactive({
  calls: 0,
  raisedTickets: 0,
  closedTickets: 0
})

const tickets = ref([])
const ticketPage = ref(1)
const ticketTotal = ref(0)
const ticketsLoading = ref(false)
const ticketsError = ref('')
const ticketFilters = reactive({
  search: '',
  status: '',
  priority: ''
})

const history = ref([])
const historyPage = ref(1)
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyError = ref('')
const historyFilters = reactive({
  search: '',
  activityType: '',
  status: '',
  fromDate: '',
  toDate: ''
})

const dialog = reactive({
  open: false,
  mode: 'ticket',
  activityId: ''
})

let mounted = false
let statsRequestGeneration = 0
let ticketRequestGeneration = 0
let historyRequestGeneration = 0
let ticketReloadTimeoutId
let historyReloadTimeoutId
let successTimeoutId

const ticketTotalPages = computed(() => {
  return Math.max(1, Math.ceil(ticketTotal.value / PAGE_SIZE))
})
const historyTotalPages = computed(() => {
  return Math.max(1, Math.ceil(historyTotal.value / PAGE_SIZE))
})
const ticketPageStart = computed(() => {
  return ticketTotal.value ? ((ticketPage.value - 1) * PAGE_SIZE) + 1 : 0
})
const ticketPageEnd = computed(() => {
  return Math.min(ticketPage.value * PAGE_SIZE, ticketTotal.value)
})
const historyPageStart = computed(() => {
  return historyTotal.value ? ((historyPage.value - 1) * PAGE_SIZE) + 1 : 0
})
const historyPageEnd = computed(() => {
  return Math.min(historyPage.value * PAGE_SIZE, historyTotal.value)
})
const hasTicketFilters = computed(() => {
  return Boolean(
    ticketFilters.search.trim()
    || ticketFilters.status
    || ticketFilters.priority
  )
})
const hasHistoryFilters = computed(() => {
  return Boolean(
    historyFilters.search.trim()
    || historyFilters.activityType
    || historyFilters.status
    || historyFilters.fromDate
    || historyFilters.toDate
  )
})
const historyStatusOptions = computed(() => {
  if (historyFilters.activityType === 'call') {
    return [
      { value: '', label: 'All Calls' },
      { value: 'completed', label: 'Completed' }
    ]
  }

  if (historyFilters.activityType === 'case') {
    return [
      { value: '', label: 'All Tickets' },
      { value: 'raised', label: 'Open' },
      { value: 'closed', label: 'Closed' }
    ]
  }

  return [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: 'Completed Calls' },
    { value: 'raised', label: 'Open Tickets' },
    { value: 'closed', label: 'Closed Tickets' }
  ]
})
const statsRangeLabel = computed(() => {
  if (!statsFrom.value || !statsToExclusive.value) return ''

  const formatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: CRM_TIME_ZONE
  })
  const start = formatter.format(new Date(statsFrom.value))
  const inclusiveEnd = new Date(Date.parse(statsToExclusive.value) - 1)
  const end = formatter.format(inclusiveEnd)

  return start === end ? start : `${start} – ${end}`
})

const getErrorMessage = (error, fallbackMessage) => {
  return error?.data?.statusMessage
    || error?.statusMessage
    || error?.message
    || fallbackMessage
}

const getTicketNumber = (id) => String(id || '').slice(0, 8).toUpperCase()

const getContactMeta = (contact) => {
  if (!contact) return 'Contact unavailable'
  const entity = contact.entityType === 'person' ? 'Person' : 'Company'
  const account = contact.accountType === 'supplier' ? 'Supplier' : 'Customer'
  return `${entity} · ${account}`
}

const getStatusLabel = (status) => {
  if (status === 'raised') return 'Open'
  if (status === 'closed') return 'Closed'
  return 'Completed'
}

const getStatusClass = (status) => {
  if (status === 'raised') return 'bg-amber-100 text-amber-800'
  if (status === 'closed') return 'bg-emerald-100 text-emerald-800'
  return 'bg-blue-100 text-blue-800'
}

const getPriorityClass = (priority) => {
  if (priority === 'urgent') return 'bg-red-100 text-red-800'
  if (priority === 'high') return 'bg-orange-100 text-orange-800'
  if (priority === 'low') return 'bg-gray-100 text-gray-600'
  return 'bg-indigo-100 text-indigo-700'
}

const showSuccess = (message) => {
  successMessage.value = message

  if (successTimeoutId) {
    window.clearTimeout(successTimeoutId)
  }

  successTimeoutId = window.setTimeout(() => {
    successMessage.value = ''
  }, 5000)
}

const loadStats = async () => {
  const period = statsPeriod.value
  const generation = ++statsRequestGeneration
  statsLoading.value = true
  statsError.value = ''
  statsFrom.value = ''
  statsToExclusive.value = ''
  Object.assign(stats, {
    calls: 0,
    raisedTickets: 0,
    closedTickets: 0
  })

  try {
    const response = await $fetch('/api/admin-crm/activities/stats', {
      headers: await getAdminAuthHeaders(),
      query: {
        period
      }
    })

    if (generation !== statsRequestGeneration || period !== statsPeriod.value) return

    const snapshot = {
      from: response.from,
      toExclusive: response.toExclusive,
      stats: {
        calls: Number(response.stats?.calls || 0),
        raisedTickets: Number(response.stats?.raisedTickets || 0),
        closedTickets: Number(response.stats?.closedTickets || 0)
      }
    }
    Object.assign(stats, snapshot.stats)
    statsFrom.value = snapshot.from
    statsToExclusive.value = snapshot.toExclusive
  } catch (error) {
    if (generation === statsRequestGeneration) {
      statsError.value = getErrorMessage(error, 'Could not load CRM statistics.')
    }
  } finally {
    if (generation === statsRequestGeneration) {
      statsLoading.value = false
    }
  }
}

const loadTickets = async (page = ticketPage.value) => {
  const requestedPage = Math.max(1, Number(page) || 1)
  const generation = ++ticketRequestGeneration
  ticketsLoading.value = true
  ticketsError.value = ''

  try {
    const response = await $fetch('/api/admin-crm/activities', {
      headers: await getAdminAuthHeaders(),
      query: {
        page: requestedPage,
        pageSize: PAGE_SIZE,
        includeDetails: 'false',
        includeStats: 'false',
        accountId: selectedContactId.value || undefined,
        activityType: 'case',
        status: ticketFilters.status || undefined,
        priority: ticketFilters.priority || undefined,
        search: ticketFilters.search.trim() || undefined
      }
    })

    if (generation !== ticketRequestGeneration) return

    const total = Number(response.total || 0)
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

    if (requestedPage > lastPage) {
      await loadTickets(lastPage)
      return
    }

    tickets.value = response.items || []
    ticketTotal.value = total
    ticketPage.value = Number(response.page || requestedPage)
  } catch (error) {
    if (generation === ticketRequestGeneration) {
      tickets.value = []
      ticketTotal.value = 0
      ticketsError.value = getErrorMessage(error, 'Could not load CRM tickets.')
    }
  } finally {
    if (generation === ticketRequestGeneration) {
      ticketsLoading.value = false
    }
  }
}

const loadHistory = async (page = historyPage.value) => {
  const requestedPage = Math.max(1, Number(page) || 1)
  const generation = ++historyRequestGeneration
  historyLoading.value = true
  historyError.value = ''

  try {
    const response = await $fetch('/api/admin-crm/activities', {
      headers: await getAdminAuthHeaders(),
      query: {
        page: requestedPage,
        pageSize: PAGE_SIZE,
        includeDetails: 'false',
        includeStats: 'false',
        accountId: selectedContactId.value || undefined,
        activityType: historyFilters.activityType || undefined,
        status: historyFilters.status || undefined,
        search: historyFilters.search.trim() || undefined,
        from: toCrmDateBoundary(historyFilters.fromDate),
        toExclusive: toCrmDateBoundary(historyFilters.toDate, 1)
      }
    })

    if (generation !== historyRequestGeneration) return

    const total = Number(response.total || 0)
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

    if (requestedPage > lastPage) {
      await loadHistory(lastPage)
      return
    }

    history.value = response.items || []
    historyTotal.value = total
    historyPage.value = Number(response.page || requestedPage)
  } catch (error) {
    if (generation === historyRequestGeneration) {
      history.value = []
      historyTotal.value = 0
      historyError.value = getErrorMessage(error, 'Could not load CRM activity history.')
    }
  } finally {
    if (generation === historyRequestGeneration) {
      historyLoading.value = false
    }
  }
}

const scheduleTicketReload = () => {
  if (!mounted) return
  if (ticketReloadTimeoutId) window.clearTimeout(ticketReloadTimeoutId)
  ticketReloadTimeoutId = window.setTimeout(() => {
    void loadTickets(1)
  }, 300)
}

const scheduleHistoryReload = () => {
  if (!mounted) return
  if (historyReloadTimeoutId) window.clearTimeout(historyReloadTimeoutId)
  historyReloadTimeoutId = window.setTimeout(() => {
    void loadHistory(1)
  }, 300)
}

const setActivePanel = async (panel) => {
  if (!['tickets', 'history'].includes(panel)) return
  activePanel.value = panel

  await router.replace({
    query: {
      ...route.query,
      tab: 'activities',
      panel,
      contact: selectedContactId.value || undefined
    }
  })

  if (panel === 'tickets') {
    await loadTickets(ticketPage.value)
  } else {
    await loadHistory(historyPage.value)
  }
}

const clearTicketFilters = () => {
  Object.assign(ticketFilters, {
    search: '',
    status: '',
    priority: ''
  })
  scheduleTicketReload()
}

const clearHistoryFilters = () => {
  Object.assign(historyFilters, {
    search: '',
    activityType: '',
    status: '',
    fromDate: '',
    toDate: ''
  })
  scheduleHistoryReload()
}

const openCreateDialog = (mode) => {
  dialog.mode = mode
  dialog.activityId = ''
  dialog.open = true
}

const openActivityDetails = (activityId) => {
  dialog.mode = 'detail'
  dialog.activityId = activityId
  dialog.open = true
}

const closeDialog = () => {
  dialog.open = false
}

const handleActivitySaved = async ({ type }) => {
  await loadStats()

  if (type === 'call') {
    showSuccess('Call recorded successfully.')
    if (activePanel.value === 'history') await loadHistory(1)
    return
  }

  if (type === 'ticket') {
    showSuccess('Ticket created successfully.')
    if (activePanel.value !== 'tickets') {
      ticketPage.value = 1
      await setActivePanel('tickets')
    } else {
      await loadTickets(1)
    }
    return
  }

  showSuccess('Ticket closed successfully.')
  await loadTickets(ticketPage.value)
  if (activePanel.value === 'history') await loadHistory(historyPage.value)
}

watch(statsPeriod, () => {
  if (mounted) void loadStats()
})

watch(selectedContactId, async () => {
  if (!mounted) return

  if (getRouteQueryValue(route.query.contact) !== selectedContactId.value) {
    await router.replace({
      query: {
        ...route.query,
        tab: 'activities',
        panel: activePanel.value,
        contact: selectedContactId.value || undefined
      }
    })
  }

  if (activePanel.value === 'tickets') {
    scheduleTicketReload()
  } else {
    scheduleHistoryReload()
  }
})

watch(
  [
    () => route.query.panel,
    () => route.query.contact
  ],
  ([panelValue, contactValue]) => {
    const requestedContact = getRouteQueryValue(contactValue)
    const requestedRoutePanel = getRouteQueryValue(panelValue).toLowerCase()
    const nextPanel = requestedRoutePanel === 'history'
      || (!requestedRoutePanel && requestedContact)
      ? 'history'
      : 'tickets'
    const panelChanged = activePanel.value !== nextPanel
    const contactChanged = selectedContactId.value !== requestedContact

    if (!panelChanged && !contactChanged) {
      return
    }

    activePanel.value = nextPanel
    selectedContactId.value = requestedContact

    if (!mounted) {
      return
    }

    if (nextPanel === 'tickets') {
      scheduleTicketReload()
    } else {
      scheduleHistoryReload()
    }
  }
)

watch(
  [
    () => ticketFilters.search,
    () => ticketFilters.status,
    () => ticketFilters.priority
  ],
  scheduleTicketReload
)

watch(
  [
    () => historyFilters.search,
    () => historyFilters.activityType,
    () => historyFilters.status,
    () => historyFilters.fromDate,
    () => historyFilters.toDate
  ],
  scheduleHistoryReload
)

watch(() => historyFilters.activityType, (activityType) => {
  if (activityType === 'call' && ['raised', 'closed'].includes(historyFilters.status)) {
    historyFilters.status = ''
  }

  if (activityType === 'case' && historyFilters.status === 'completed') {
    historyFilters.status = ''
  }
})

onMounted(async () => {
  mounted = true
  await Promise.all([
    loadStats(),
    activePanel.value === 'tickets' ? loadTickets(1) : loadHistory(1)
  ])
})

onBeforeUnmount(() => {
  mounted = false
  statsRequestGeneration += 1
  ticketRequestGeneration += 1
  historyRequestGeneration += 1

  if (ticketReloadTimeoutId) window.clearTimeout(ticketReloadTimeoutId)
  if (historyReloadTimeoutId) window.clearTimeout(historyReloadTimeoutId)
  if (successTimeoutId) window.clearTimeout(successTimeoutId)
})
</script>
