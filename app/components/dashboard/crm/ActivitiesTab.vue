<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-3">
      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-500">Completed Calls</p>
            <p class="mt-2 text-3xl font-bold text-gray-900">{{ stats.calls }}</p>
          </div>
          <div class="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <Icon name="lucide:phone-call" size="24" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-500">Raised Cases</p>
            <p class="mt-2 text-3xl font-bold text-amber-700">{{ stats.raisedCases }}</p>
          </div>
          <div class="rounded-2xl bg-amber-50 p-3 text-amber-600">
            <Icon name="lucide:ticket" size="24" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-5 shadow">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-500">Closed Cases</p>
            <p class="mt-2 text-3xl font-bold text-emerald-700">{{ stats.closedCases }}</p>
          </div>
          <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
            <Icon name="lucide:circle-check-big" size="24" />
          </div>
        </div>
      </div>
    </section>

    <section ref="formSection" class="rounded-2xl bg-white p-6 shadow">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 text-left"
        @click="isFormOpen = !isFormOpen"
      >
        <div>
          <h3 class="text-2xl font-bold">Record CRM Activity</h3>
          <p class="mt-1 text-sm text-gray-500">
            Record a completed call, raise a case, or close an existing case.
          </p>
        </div>

        <div class="flex items-center gap-2 pt-1 text-sm font-medium text-gray-500">
          <span>{{ isFormOpen ? 'Collapse' : 'Expand' }}</span>
          <Icon
            name="lucide:chevron-down"
            size="18"
            class="transition-transform"
            :class="isFormOpen ? 'rotate-180' : ''"
          />
        </div>
      </button>

      <form v-if="isFormOpen" class="mt-6" @submit.prevent="saveActivity">
        <fieldset :disabled="saving">
          <legend class="text-sm font-semibold text-gray-700">What happened?</legend>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <button
              v-for="action in formActions"
              :key="action.key"
              type="button"
              class="flex items-start gap-3 rounded-2xl border p-4 text-left transition"
              :class="form.action === action.key
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'"
              @click="setFormAction(action.key)"
            >
              <Icon :name="action.icon" size="21" class="mt-0.5 shrink-0" />
              <span>
                <span class="block font-bold">{{ action.label }}</span>
                <span
                  class="mt-1 block text-xs"
                  :class="form.action === action.key ? 'text-gray-300' : 'text-gray-500'"
                >
                  {{ action.description }}
                </span>
              </span>
            </button>
          </div>
        <div class="mt-6 max-w-xl">
          <label for="crm-contact-search" class="mb-2 block text-sm font-semibold text-gray-700">
            Search CRM Contacts
          </label>
          <div class="relative">
            <input
              id="crm-contact-search"
              v-model="contactSearch"
              type="search"
              maxlength="100"
              placeholder="Search company or person name"
              class="w-full rounded-lg border p-3 pr-11 outline-none focus:border-blue-500"
            >
            <Icon
              v-if="contactsLoading"
              name="lucide:loader-circle"
              size="18"
              class="absolute right-3 top-3.5 animate-spin text-gray-400"
            />
          </div>
          <p v-if="contactsError" class="mt-2 text-sm text-red-600">
            {{ contactsError }}
          </p>
          <p v-else-if="contactsLimited" class="mt-2 text-xs text-gray-400">
            Showing the first 200 matches. Search by name to narrow the list.
          </p>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label for="crm-entity-type" class="mb-2 block text-sm font-semibold text-gray-700">
              Contact Type
            </label>
            <select
              id="crm-entity-type"
              v-model="formEntityType"
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
            >
              <option value="all">Companies and People</option>
              <option value="company">Companies</option>
              <option value="person">People</option>
            </select>
          </div>

          <div>
            <label for="crm-contact" class="mb-2 block text-sm font-semibold text-gray-700">
              CRM Contact *
            </label>
            <select
              id="crm-contact"
              v-model="form.accountId"
              required
              class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
            >
              <option value="">Select a company or person</option>
              <optgroup v-if="formCompanyContacts.length" label="Companies">
                <option
                  v-for="contact in formCompanyContacts"
                  :key="contact.id"
                  :value="contact.id"
                >
                  {{ getContactOptionLabel(contact) }}
                </option>
              </optgroup>
              <optgroup v-if="formPersonContacts.length" label="People">
                <option
                  v-for="contact in formPersonContacts"
                  :key="contact.id"
                  :value="contact.id"
                >
                  {{ getContactOptionLabel(contact) }}
                </option>
              </optgroup>
            </select>
          </div>

          <template v-if="form.action === 'close_case'">
            <div>
              <label for="crm-open-case" class="mb-2 block text-sm font-semibold text-gray-700">
                Raised Case *
              </label>
              <select
                id="crm-open-case"
                v-model="form.caseId"
                required
                :disabled="!form.accountId || openCasesLoading"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">
                  {{ openCasesLoading ? 'Loading cases...' : 'Select a raised case' }}
                </option>
                <option
                  v-for="caseRecord in openCases"
                  :key="caseRecord.id"
                  :value="caseRecord.id"
                >
                  {{ caseRecord.subject }} · {{ formatCommerceDate(caseRecord.occurredAt) }}
                </option>
              </select>
              <p
                v-if="form.accountId && !openCasesLoading && !openCases.length"
                class="mt-2 text-xs text-amber-700"
              >
                This contact has no raised cases to close.
              </p>
            </div>

            <div>
              <label for="crm-closed-at" class="mb-2 block text-sm font-semibold text-gray-700">
                Closed Date and Time *
              </label>
              <input
                id="crm-closed-at"
                v-model="form.closedAt"
                type="datetime-local"
                :max="maximumRecordDateTime"
                required
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                @focus="refreshMaximumRecordDateTime"
              >
            </div>

            <div class="md:col-span-2">
              <label for="crm-resolution" class="mb-2 block text-sm font-semibold text-gray-700">
                Resolution
              </label>
              <textarea
                id="crm-resolution"
                v-model="form.resolution"
                dir="auto"
                rows="5"
                maxlength="5000"
                placeholder="How was the case resolved?"
                class="w-full resize-y rounded-lg border p-3 outline-none focus:border-blue-500"
              />
              <p class="mt-1 text-right text-xs text-gray-400">
                {{ form.resolution.length }}/5000
              </p>
            </div>
          </template>

          <template v-else>
            <div>
              <label for="crm-subject" class="mb-2 block text-sm font-semibold text-gray-700">
                {{ form.action === 'call' ? 'Call Subject' : 'Case Subject' }} *
              </label>
              <input
                id="crm-subject"
                v-model="form.subject"
                type="text"
                maxlength="200"
                required
                :placeholder="form.action === 'call'
                  ? 'What was the call about?'
                  : 'What is the case about?'"
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              >
            </div>

            <div>
              <label for="crm-occurred-at" class="mb-2 block text-sm font-semibold text-gray-700">
                {{ form.action === 'call' ? 'Call Date and Time' : 'Raised Date and Time' }} *
              </label>
              <input
                id="crm-occurred-at"
                v-model="form.occurredAt"
                type="datetime-local"
                :max="maximumRecordDateTime"
                required
                class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
                @focus="refreshMaximumRecordDateTime"
              >
            </div>

            <div v-if="form.action === 'raise_case'">
              <label for="crm-priority" class="mb-2 block text-sm font-semibold text-gray-700">
                Priority
              </label>
              <select
                id="crm-priority"
                v-model="form.priority"
                class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div :class="form.action === 'raise_case' ? '' : 'md:col-span-2'">
              <label for="crm-notes" class="mb-2 block text-sm font-semibold text-gray-700">
                {{ form.action === 'call' ? 'Call Outcome / Notes' : 'Case Details' }}
              </label>
              <textarea
                id="crm-notes"
                v-model="form.notes"
                dir="auto"
                rows="5"
                maxlength="5000"
                :placeholder="form.action === 'call'
                  ? 'Record the discussion and outcome.'
                  : 'Describe the issue or request.'"
                class="w-full resize-y rounded-lg border p-3 outline-none focus:border-blue-500"
              />
              <p class="mt-1 text-right text-xs text-gray-400">
                {{ form.notes.length }}/5000
              </p>
            </div>
          </template>
        </div>
        </fieldset>

        <p
          v-if="formError"
          class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {{ formError }}
        </p>

        <p
          v-if="successMessage"
          class="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
          role="status"
        >
          {{ successMessage }}
        </p>

        <button
          type="submit"
          :disabled="saving || (form.action === 'close_case' && !form.caseId)"
          class="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon
            v-if="saving"
            name="lucide:loader-circle"
            size="18"
            class="mr-2 animate-spin"
          />
          {{ submitLabel }}
        </button>
      </form>
    </section>

    <section class="rounded-2xl bg-white p-6 shadow">
      <div>
        <h3 class="text-2xl font-bold">Activity History</h3>
        <p class="mt-1 text-sm text-gray-500">
          Review calls and case history for every CRM company or person.
        </p>
      </div>

      <div class="mt-6 max-w-xl">
        <label for="crm-history-contact-search" class="mb-2 block text-sm font-semibold text-gray-700">
          Search CRM Contacts
        </label>
        <div class="relative">
          <input
            id="crm-history-contact-search"
            v-model="contactSearch"
            type="search"
            maxlength="100"
            placeholder="Search company or person name"
            class="w-full rounded-lg border p-3 pr-11 outline-none focus:border-blue-500"
          >
          <Icon
            v-if="contactsLoading"
            name="lucide:loader-circle"
            size="18"
            class="absolute right-3 top-3.5 animate-spin text-gray-400"
          />
        </div>
        <p v-if="contactsError" class="mt-2 text-sm text-red-600">
          {{ contactsError }}
        </p>
        <p v-else-if="contactsLimited" class="mt-2 text-xs text-gray-400">
          Showing the first 200 matches. Search by name to narrow the list.
        </p>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div class="xl:col-span-2">
          <label for="crm-filter-contact" class="mb-2 block text-sm font-semibold text-gray-700">
            Contact
          </label>
          <select
            id="crm-filter-contact"
            v-model="filters.accountId"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">All companies and people</option>
            <optgroup v-if="companyContacts.length" label="Companies">
              <option
                v-for="contact in companyContacts"
                :key="contact.id"
                :value="contact.id"
              >
                {{ getContactOptionLabel(contact) }}
              </option>
            </optgroup>
            <optgroup v-if="personContacts.length" label="People">
              <option
                v-for="contact in personContacts"
                :key="contact.id"
                :value="contact.id"
              >
                {{ getContactOptionLabel(contact) }}
              </option>
            </optgroup>
          </select>
        </div>

        <div>
          <label for="crm-filter-type" class="mb-2 block text-sm font-semibold text-gray-700">
            Activity
          </label>
          <select
            id="crm-filter-type"
            v-model="filters.activityType"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option value="">Calls and Cases</option>
            <option value="call">Calls</option>
            <option value="case">Cases</option>
          </select>
        </div>

        <div>
          <label for="crm-filter-status" class="mb-2 block text-sm font-semibold text-gray-700">
            Status
          </label>
          <select
            id="crm-filter-status"
            v-model="filters.status"
            class="w-full rounded-lg border bg-white p-3 outline-none focus:border-blue-500"
          >
            <option
              v-for="option in filterStatusOptions"
              :key="option.value || 'all'"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex items-end gap-2">
          <button
            type="button"
            :disabled="loading || saving"
            class="flex-1 rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            @click="loadActivities(1)"
          >
            Apply
          </button>
          <button
            type="button"
            :disabled="loading || saving"
            class="rounded-lg border px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            @click="clearFilters"
          >
            Clear
          </button>
        </div>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label for="crm-filter-from" class="mb-2 block text-sm font-semibold text-gray-700">
            From Date
          </label>
          <input
            id="crm-filter-from"
            v-model="filters.fromDate"
            type="date"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>
        <div>
          <label for="crm-filter-to" class="mb-2 block text-sm font-semibold text-gray-700">
            To Date
          </label>
          <input
            id="crm-filter-to"
            v-model="filters.toDate"
            type="date"
            class="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          >
        </div>
      </div>
      <p class="mt-2 text-xs text-gray-400">
        Date filters use the call or raised date, and the closing date for closed cases.
      </p>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <p class="text-sm text-gray-500">
          <template v-if="totalActivities">
            Showing {{ pageStart }}-{{ pageEnd }} of {{ totalActivities }} activities
          </template>
          <template v-else>
            No activities found
          </template>
        </p>
        <p class="text-sm font-medium text-gray-600">
          Page {{ currentPage }} of {{ totalPages }}
        </p>
      </div>

      <p
        v-if="pageError"
        class="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        role="alert"
      >
        {{ pageError }}
      </p>

      <div v-else-if="loading" class="py-10 text-center text-gray-500">
        Loading CRM activities...
      </div>

      <div v-else-if="!activities.length" class="py-10 text-center text-gray-500">
        No calls or cases match the selected filters.
      </div>

      <div v-else class="mt-5 space-y-4">
        <article
          v-for="activity in activities"
          :key="activity.id"
          class="rounded-2xl border p-5"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex min-w-0 gap-4">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                :class="activity.activityType === 'call'
                  ? 'bg-blue-50 text-blue-600'
                  : activity.status === 'closed'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'"
              >
                <Icon
                  :name="activity.activityType === 'call'
                    ? 'lucide:phone-call'
                    : activity.status === 'closed'
                      ? 'lucide:ticket-check'
                      : 'lucide:ticket'"
                  size="22"
                />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="font-bold text-gray-900">{{ activity.subject }}</h4>
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                    :class="getStatusClass(activity.status)"
                  >
                    {{ getStatusLabel(activity.status) }}
                  </span>
                  <span
                    v-if="activity.priority"
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                    :class="getPriorityClass(activity.priority)"
                  >
                    {{ activity.priority }}
                  </span>
                </div>

                <p class="mt-2 text-sm font-medium text-gray-700">
                  {{ activity.contact?.name || 'Deleted CRM contact' }}
                </p>
                <p class="mt-1 text-xs text-gray-400">
                  {{ getContactMeta(activity.contact) }}
                  <span v-if="activity.activityType === 'case'">
                    · Case #{{ String(activity.id).slice(0, 8).toUpperCase() }}
                  </span>
                </p>

                <p class="mt-3 text-sm text-gray-500">
                  {{ activity.activityType === 'call' ? 'Called' : 'Raised' }}
                  {{ formatCommerceDate(activity.occurredAt) }}
                </p>
                <p v-if="activity.closedAt" class="mt-1 text-sm text-emerald-700">
                  Closed {{ formatCommerceDate(activity.closedAt) }}
                </p>

                <p
                  v-if="activity.notes"
                  class="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600"
                >
                  {{ activity.notes }}
                </p>

                <div
                  v-if="activity.resolution"
                  class="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
                >
                  <p class="font-semibold">Resolution</p>
                  <p class="mt-1 whitespace-pre-wrap leading-6">{{ activity.resolution }}</p>
                </div>
              </div>
            </div>

            <button
              v-if="activity.activityType === 'case' && activity.status === 'raised'"
              type="button"
              :disabled="saving"
              class="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              @click="beginCloseCase(activity)"
            >
              Close Case
            </button>
          </div>
        </article>
      </div>

      <div class="mt-5 flex items-center justify-between rounded-xl border px-4 py-3">
        <button
          type="button"
          :disabled="currentPage <= 1 || loading"
          class="rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          @click="loadActivities(currentPage - 1)"
        >
          Previous
        </button>
        <p class="text-sm text-gray-500">Page {{ currentPage }} of {{ totalPages }}</p>
        <button
          type="button"
          :disabled="currentPage >= totalPages || loading"
          class="rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          @click="loadActivities(currentPage + 1)"
        >
          Next
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { formatCommerceDate } from '~/utils/commerce'

const route = useRoute()
const { getAdminAuthHeaders } = useAdminLogs()

const PAGE_SIZE = 10

const formActions = [
  {
    key: 'call',
    label: 'Completed Call',
    description: 'Record a call that has taken place.',
    icon: 'lucide:phone-call'
  },
  {
    key: 'raise_case',
    label: 'Raise Case / Ticket',
    description: 'Open a new case for this contact.',
    icon: 'lucide:ticket-plus'
  },
  {
    key: 'close_case',
    label: 'Close Case / Ticket',
    description: 'Resolve an existing raised case.',
    icon: 'lucide:ticket-check'
  }
]

const contacts = ref([])
const activities = ref([])
const openCases = ref([])
const contactsLoading = ref(false)
const contactsError = ref('')
const contactsLimited = ref(false)
const loading = ref(false)
const openCasesLoading = ref(false)
const saving = ref(false)
const isFormOpen = ref(false)
const pageError = ref('')
const formError = ref('')
const successMessage = ref('')
const formEntityType = ref('all')
const contactSearch = ref('')
const currentPage = ref(1)
const totalActivities = ref(0)
const formSection = ref(null)
const maximumRecordDateTime = ref('')
const stats = reactive({
  calls: 0,
  raisedCases: 0,
  closedCases: 0
})

const createEmptyForm = () => ({
  action: 'call',
  accountId: '',
  subject: '',
  notes: '',
  priority: 'normal',
  occurredAt: '',
  caseId: '',
  closedAt: '',
  resolution: ''
})

const form = reactive(createEmptyForm())
const filters = reactive({
  accountId: '',
  activityType: '',
  status: '',
  fromDate: '',
  toDate: ''
})

let openCaseRequestGeneration = 0
let contactRequestGeneration = 0
let activityRequestGeneration = 0
let contactSearchTimeoutId
let preferredOpenCaseId = ''
const closeCaseSelectionToken = ref(0)

const companyContacts = computed(() => {
  return contacts.value.filter((contact) => contact.entityType === 'company')
})

const personContacts = computed(() => {
  return contacts.value.filter((contact) => contact.entityType === 'person')
})

const formCompanyContacts = computed(() => {
  return formEntityType.value === 'person' ? [] : companyContacts.value
})

const formPersonContacts = computed(() => {
  return formEntityType.value === 'company' ? [] : personContacts.value
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalActivities.value / PAGE_SIZE))
})

const filterStatusOptions = computed(() => {
  if (filters.activityType === 'call') {
    return [
      {
        value: '',
        label: 'All Calls'
      }
    ]
  }

  if (filters.activityType === 'case') {
    return [
      {
        value: '',
        label: 'All Cases'
      },
      {
        value: 'raised',
        label: 'Raised Cases'
      },
      {
        value: 'closed',
        label: 'Closed Cases'
      }
    ]
  }

  return [
    {
      value: '',
      label: 'All Statuses'
    },
    {
      value: 'completed',
      label: 'Completed Calls'
    },
    {
      value: 'raised',
      label: 'Raised Cases'
    },
    {
      value: 'closed',
      label: 'Closed Cases'
    }
  ]
})

const pageStart = computed(() => {
  return totalActivities.value
    ? ((currentPage.value - 1) * PAGE_SIZE) + 1
    : 0
})

const pageEnd = computed(() => {
  return Math.min(currentPage.value * PAGE_SIZE, totalActivities.value)
})

const submitLabel = computed(() => {
  if (saving.value) {
    return form.action === 'close_case' ? 'Closing Case...' : 'Saving...'
  }

  if (form.action === 'raise_case') {
    return 'Raise Case'
  }

  if (form.action === 'close_case') {
    return 'Close Case'
  }

  return 'Record Call'
})

const toLocalDateTimeValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  const adjustedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
  return adjustedDate.toISOString().slice(0, 16)
}

const refreshMaximumRecordDateTime = () => {
  maximumRecordDateTime.value = toLocalDateTimeValue()
}

const toIsoDateTime = (value, label) => {
  const timestamp = Date.parse(String(value || ''))

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} is required.`)
  }

  return new Date(timestamp).toISOString()
}

const toDateBoundary = (value, endOfDay = false) => {
  if (!value) {
    return undefined
  }

  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'
  return new Date(`${value}${suffix}`).toISOString()
}

const getErrorMessage = (error, fallbackMessage) => {
  return error?.data?.statusMessage
    || error?.statusMessage
    || error?.message
    || fallbackMessage
}

const getContactOptionLabel = (contact) => {
  const accountType = contact.accountType === 'supplier' ? 'Supplier' : 'Customer'
  const inactiveLabel = contact.isActive ? '' : ' · Inactive'
  return `${contact.name} · ${accountType}${inactiveLabel}`
}

const compareCrmContacts = (left, right) => {
  const entityOrder = {
    company: 0,
    person: 1
  }
  const entityDifference = (entityOrder[left.entityType] ?? 2)
    - (entityOrder[right.entityType] ?? 2)

  if (entityDifference) {
    return entityDifference
  }

  return String(left.name || '').localeCompare(String(right.name || ''))
}

const ensureContactOption = (contact) => {
  if (!contact?.id || contacts.value.some((item) => item.id === contact.id)) {
    return
  }

  contacts.value = [...contacts.value, contact].sort(compareCrmContacts)
}

const getContactMeta = (contact) => {
  if (!contact) {
    return 'Contact unavailable'
  }

  const entityType = contact.entityType === 'person' ? 'Person' : 'Company'
  const accountType = contact.accountType === 'supplier' ? 'Supplier' : 'Customer'
  return `${entityType} · ${accountType}`
}

const getStatusLabel = (status) => {
  if (status === 'raised') return 'Raised'
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

const loadContacts = async ({ applyRouteContact = false } = {}) => {
  const requestGeneration = ++contactRequestGeneration
  contactsLoading.value = true
  contactsError.value = ''

  try {
    const selectedIds = [
      form.accountId,
      filters.accountId,
      applyRouteContact ? String(route.query.contact || '').trim() : ''
    ].filter(Boolean)

    const response = await $fetch('/api/admin-crm/contacts', {
      headers: await getAdminAuthHeaders(),
      query: {
        search: contactSearch.value.trim() || undefined,
        selectedIds: selectedIds.length
          ? [...new Set(selectedIds)].join(',')
          : undefined
      }
    })

    if (requestGeneration !== contactRequestGeneration) {
      return
    }

    const selectedContactIds = new Set([
      form.accountId,
      filters.accountId
    ].filter(Boolean))
    const nextContactsById = new Map(
      (response.items || []).map((contact) => [contact.id, contact])
    )

    for (const contact of contacts.value) {
      if (selectedContactIds.has(contact.id) && !nextContactsById.has(contact.id)) {
        nextContactsById.set(contact.id, contact)
      }
    }

    contacts.value = [...nextContactsById.values()].sort(compareCrmContacts)
    contactsLimited.value = Boolean(response.limited)

    const requestedContactId = applyRouteContact
      ? String(route.query.contact || '').trim()
      : ''
    const requestedContact = contacts.value.find((contact) => {
      return contact.id === requestedContactId
    })

    if (requestedContact) {
      formEntityType.value = requestedContact.entityType
      form.accountId = requestedContact.id
      filters.accountId = requestedContact.id
      isFormOpen.value = true
    }
  } catch (error) {
    if (requestGeneration === contactRequestGeneration) {
      contactsError.value = getErrorMessage(error, 'Could not load CRM contacts.')
    }
  } finally {
    if (requestGeneration === contactRequestGeneration) {
      contactsLoading.value = false
    }
  }
}

const loadActivities = async (
  page = currentPage.value,
  { refreshStats = false } = {}
) => {
  const requestGeneration = ++activityRequestGeneration
  const requestedPage = page
  const requestQuery = {
    page: requestedPage,
    pageSize: PAGE_SIZE,
    includeStats: refreshStats ? 'true' : 'false',
    accountId: filters.accountId || undefined,
    activityType: filters.activityType || undefined,
    status: filters.status || undefined,
    from: toDateBoundary(filters.fromDate),
    to: toDateBoundary(filters.toDate, true)
  }

  loading.value = true
  pageError.value = ''

  try {
    const response = await $fetch('/api/admin-crm/activities', {
      headers: await getAdminAuthHeaders(),
      query: requestQuery
    })

    if (requestGeneration !== activityRequestGeneration) {
      return
    }

    activities.value = response.items || []
    totalActivities.value = Number(response.total || 0)
    currentPage.value = Number(response.page || requestedPage)
    if (response.stats) {
      Object.assign(stats, {
        calls: Number(response.stats.calls || 0),
        raisedCases: Number(response.stats.raisedCases || 0),
        closedCases: Number(response.stats.closedCases || 0)
      })
    }
  } catch (error) {
    if (requestGeneration === activityRequestGeneration) {
      activities.value = []
      totalActivities.value = 0
      pageError.value = getErrorMessage(error, 'Could not load CRM activities.')
    }
  } finally {
    if (requestGeneration === activityRequestGeneration) {
      loading.value = false
    }
  }
}

const loadOpenCases = async (preferredCaseId = '') => {
  const requestGeneration = ++openCaseRequestGeneration
  openCases.value = []

  if (form.action !== 'close_case' || !form.accountId) {
    form.caseId = ''
    return
  }

  openCasesLoading.value = true

  try {
    const response = await $fetch('/api/admin-crm/activities/open-cases', {
      headers: await getAdminAuthHeaders(),
      query: {
        accountId: form.accountId,
        caseId: preferredCaseId || undefined
      }
    })

    if (requestGeneration !== openCaseRequestGeneration) {
      return
    }

    openCases.value = response.items || []
    const nextCaseId = preferredCaseId || form.caseId
    form.caseId = openCases.value.some((record) => record.id === nextCaseId)
      ? nextCaseId
      : ''
  } catch (error) {
    if (requestGeneration === openCaseRequestGeneration) {
      form.caseId = ''
      formError.value = getErrorMessage(error, 'Could not load raised cases.')
    }
  } finally {
    if (requestGeneration === openCaseRequestGeneration) {
      openCasesLoading.value = false
    }
  }
}

const setFormAction = (action) => {
  if (form.action === action) {
    return
  }

  form.action = action
  formError.value = ''
  successMessage.value = ''
  form.subject = ''
  form.notes = ''
  form.priority = 'normal'
  form.occurredAt = toLocalDateTimeValue()
  form.caseId = ''
  form.closedAt = toLocalDateTimeValue()
  form.resolution = ''
  refreshMaximumRecordDateTime()
}

const resetForm = ({ preserveContact = false } = {}) => {
  const accountId = preserveContact ? form.accountId : ''
  const entityType = preserveContact ? formEntityType.value : 'all'
  const action = form.action

  Object.assign(form, createEmptyForm(), {
    action,
    accountId,
    occurredAt: toLocalDateTimeValue(),
    closedAt: toLocalDateTimeValue()
  })
  formEntityType.value = entityType
  openCases.value = []
  refreshMaximumRecordDateTime()
}

const saveActivity = async () => {
  if (saving.value) {
    return
  }

  formError.value = ''
  successMessage.value = ''

  const submittedAction = form.action
  const submittedAccountId = form.accountId

  if (!submittedAccountId) {
    formError.value = 'Select a CRM company or person.'
    return
  }

  refreshMaximumRecordDateTime()

  try {
    let requestUrl = '/api/admin-crm/activities'
    let requestMethod = 'POST'
    let requestPayload

    if (submittedAction === 'close_case') {
      const selectedCase = openCases.value.find((record) => record.id === form.caseId)

      if (!selectedCase) {
        throw new Error('Select a raised case to close.')
      }

      const closedAt = toIsoDateTime(form.closedAt, 'Closed date')

      if (Date.parse(closedAt) < Date.parse(selectedCase.occurredAt)) {
        throw new Error('The closed date cannot be before the raised date.')
      }

      requestUrl = `/api/admin-crm/activities/${selectedCase.id}/close`
      requestMethod = 'PATCH'
      requestPayload = {
        closedAt,
        resolution: form.resolution
      }
    } else {
      const isCall = submittedAction === 'call'
      requestPayload = {
        accountId: submittedAccountId,
        activityType: isCall ? 'call' : 'case',
        subject: form.subject,
        notes: form.notes,
        priority: isCall ? null : form.priority,
        occurredAt: toIsoDateTime(
          form.occurredAt,
          isCall ? 'Call date' : 'Raised date'
        )
      }
    }

    saving.value = true
    const authHeaders = await getAdminAuthHeaders()
    await $fetch(requestUrl, {
      method: requestMethod,
      headers: authHeaders,
      body: requestPayload
    })

    if (submittedAction === 'close_case') {
      successMessage.value = 'Case closed successfully.'
      form.caseId = ''
      form.resolution = ''
      form.closedAt = toLocalDateTimeValue()
      await loadOpenCases()
    } else {
      successMessage.value = submittedAction === 'call'
        ? 'Call recorded successfully.'
        : 'Case raised successfully.'
      resetForm({ preserveContact: true })
    }

    await loadActivities(1, { refreshStats: true })
  } catch (error) {
    formError.value = getErrorMessage(error, 'Could not save this CRM activity.')
  } finally {
    saving.value = false
  }
}

const beginCloseCase = async (activity) => {
  if (saving.value) {
    return
  }

  ensureContactOption(activity.contact)
  isFormOpen.value = true
  form.action = 'close_case'
  formEntityType.value = activity.contact?.entityType || 'all'
  form.accountId = activity.accountId
  form.closedAt = toLocalDateTimeValue()
  refreshMaximumRecordDateTime()
  form.resolution = ''
  formError.value = ''
  successMessage.value = ''
  preferredOpenCaseId = activity.id
  closeCaseSelectionToken.value += 1

  await nextTick()
  formSection.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}

const clearFilters = async () => {
  Object.assign(filters, {
    accountId: '',
    activityType: '',
    status: '',
    fromDate: '',
    toDate: ''
  })
  await loadActivities(1)
}

watch(formEntityType, (entityType) => {
  if (!form.accountId || entityType === 'all') {
    return
  }

  const selectedContact = contacts.value.find((contact) => {
    return contact.id === form.accountId
  })

  if (selectedContact && selectedContact.entityType !== entityType) {
    form.accountId = ''
  }
})

watch(
  [
    () => form.action,
    () => form.accountId,
    closeCaseSelectionToken
  ],
  () => {
    formError.value = ''

    if (form.action === 'close_case') {
      const nextPreferredCaseId = preferredOpenCaseId
      preferredOpenCaseId = ''
      void loadOpenCases(nextPreferredCaseId)
      return
    }

    openCaseRequestGeneration += 1
    openCases.value = []
    form.caseId = ''
    openCasesLoading.value = false
  }
)

watch(contactSearch, () => {
  if (contactSearchTimeoutId) {
    window.clearTimeout(contactSearchTimeoutId)
  }

  contactSearchTimeoutId = window.setTimeout(() => {
    void loadContacts()
  }, 300)
})

watch(() => filters.activityType, (activityType) => {
  if (activityType === 'call' && filters.status) {
    filters.status = ''
  }

  if (activityType === 'case' && filters.status === 'completed') {
    filters.status = ''
  }
})

onMounted(async () => {
  form.occurredAt = toLocalDateTimeValue()
  form.closedAt = toLocalDateTimeValue()
  refreshMaximumRecordDateTime()
  await loadContacts({ applyRouteContact: true })
  await loadActivities(1, { refreshStats: true })
})

onBeforeUnmount(() => {
  if (contactSearchTimeoutId) {
    window.clearTimeout(contactSearchTimeoutId)
  }
})
</script>
