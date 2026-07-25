<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      @mousedown.self="closeDialog"
    >
      <section
        ref="dialogElement"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        @keydown="handleDialogKeydown"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b bg-white p-5">
          <div class="flex min-w-0 items-start gap-3">
            <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon :name="dialogIcon" size="21" />
            </span>

            <div class="min-w-0">
              <h3
                :id="titleId"
                dir="auto"
                class="break-words text-xl font-bold text-gray-900"
              >
                {{ dialogTitle }}
              </h3>
              <p class="mt-1 text-sm text-gray-500">{{ dialogDescription }}</p>
            </div>
          </div>

          <button
            ref="closeButton"
            type="button"
            :disabled="saving"
            aria-label="Close dialog"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            @click="closeDialog"
          >
            <Icon name="lucide:x" size="21" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div v-if="mode === 'detail'">
            <div v-if="detailLoading" class="py-12 text-center text-gray-500">
              <Icon name="lucide:loader-circle" size="25" class="mx-auto animate-spin" />
              <p class="mt-3">Loading full activity details...</p>
            </div>

            <p
              v-else-if="detailError"
              class="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
              role="alert"
            >
              {{ detailError }}
            </p>

            <template v-else-if="activity">
              <div class="flex flex-wrap items-center gap-2">
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
                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                  {{ activity.activityType === 'case' ? 'Ticket' : 'Call' }}
                </span>
              </div>

              <dl class="mt-6 grid gap-4 rounded-2xl bg-gray-50 p-5 sm:grid-cols-2">
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-400">CRM Contact</dt>
                  <dd class="mt-1 font-semibold text-gray-900">
                    {{ activity.contact?.name || 'Deleted CRM contact' }}
                  </dd>
                  <dd class="mt-1 text-xs text-gray-500">{{ getContactMeta(activity.contact) }}</dd>
                </div>

                <div v-if="activity.activityType === 'case'">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-400">Ticket Number</dt>
                  <dd class="mt-1 font-mono text-sm font-semibold text-gray-900">
                    #{{ getTicketNumber(activity.id) }}
                  </dd>
                </div>

                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {{ activity.activityType === 'call' ? 'Call Date' : 'Raised Date' }}
                  </dt>
                  <dd class="mt-1 text-sm text-gray-700">
                    <time :datetime="activity.occurredAt">{{ formatCrmDate(activity.occurredAt) }}</time>
                  </dd>
                </div>

                <div v-if="activity.closedAt">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-gray-400">Closed Date</dt>
                  <dd class="mt-1 text-sm text-gray-700">
                    <time :datetime="activity.closedAt">{{ formatCrmDate(activity.closedAt) }}</time>
                  </dd>
                </div>
              </dl>

              <div v-if="activity.notes" class="mt-6">
                <h4 class="font-bold text-gray-900">
                  {{ activity.activityType === 'call' ? 'Call Outcome / Notes' : 'Ticket Details' }}
                </h4>
                <p
                  dir="auto"
                  class="mt-2 whitespace-pre-wrap break-words rounded-2xl border p-5 text-sm leading-7 text-gray-600"
                >
                  {{ activity.notes }}
                </p>
              </div>

              <div v-if="activity.resolution" class="mt-6">
                <h4 class="font-bold text-gray-900">Resolution</h4>
                <p
                  dir="auto"
                  class="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-emerald-50 p-5 text-sm leading-7 text-emerald-800"
                >
                  {{ activity.resolution }}
                </p>
              </div>

              <p
                v-if="detailSuccess"
                class="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
                role="status"
              >
                {{ detailSuccess }}
              </p>

              <div
                v-if="activity.activityType === 'case' && activity.status === 'raised'"
                class="mt-6 border-t pt-6"
              >
                <button
                  v-if="!showCloseForm"
                  ref="closeTicketButton"
                  type="button"
                  class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
                  @click="showCloseTicketForm"
                >
                  <Icon name="lucide:ticket-check" size="18" />
                  Close Ticket
                </button>

                <form v-else class="rounded-2xl border border-blue-200 bg-blue-50 p-5" @submit.prevent="closeTicket">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h4 class="font-bold text-gray-900">Close this ticket</h4>
                      <p class="mt-1 text-sm text-gray-500">
                        Record when it was closed and how it was resolved.
                      </p>
                    </div>

                    <button
                      type="button"
                      :disabled="saving"
                      class="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-white"
                      @click="cancelCloseTicket"
                    >
                      Cancel
                    </button>
                  </div>

                  <div class="mt-5">
                    <label for="crm-ticket-closed-at" class="mb-2 block text-sm font-semibold text-gray-700">
                      Closing Date and Time *
                    </label>
                    <input
                      id="crm-ticket-closed-at"
                      ref="closedAtInput"
                      v-model="closeForm.closedAt"
                      type="datetime-local"
                      :max="maximumDateTime"
                      required
                      class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
                      @focus="refreshMaximumDateTime"
                    >
                  </div>

                  <div class="mt-4">
                    <label for="crm-ticket-resolution" class="mb-2 block text-sm font-semibold text-gray-700">
                      Resolution
                    </label>
                    <textarea
                      id="crm-ticket-resolution"
                      v-model="closeForm.resolution"
                      dir="auto"
                      rows="5"
                      maxlength="5000"
                      placeholder="Explain how the ticket was resolved."
                      class="w-full resize-y rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
                    />
                    <p class="mt-1 text-end text-xs text-gray-400">
                      {{ closeForm.resolution.length }}/5000
                    </p>
                  </div>

                  <p
                    v-if="formError"
                    class="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
                    role="alert"
                  >
                    {{ formError }}
                  </p>

                  <button
                    type="submit"
                    :disabled="saving"
                    class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon
                      :name="saving ? 'lucide:loader-circle' : 'lucide:circle-check-big'"
                      size="18"
                      :class="saving ? 'animate-spin' : ''"
                    />
                    {{ saving ? 'Closing Ticket...' : 'Confirm Close Ticket' }}
                  </button>
                </form>
              </div>
            </template>
          </div>

          <form v-else @submit.prevent="saveNewActivity">
            <DashboardCrmContactPicker
              v-model="createForm.accountId"
              :disabled="saving"
              :label="mode === 'call' ? 'Who was called?' : 'Who is this ticket for?'"
              :required="true"
              input-id="crm-dialog-contact"
            />

            <div class="mt-5">
              <label for="crm-dialog-subject" class="mb-2 block text-sm font-semibold text-gray-700">
                {{ mode === 'call' ? 'Call Subject' : 'Ticket Subject' }} *
              </label>
              <input
                id="crm-dialog-subject"
                v-model="createForm.subject"
                type="text"
                maxlength="200"
                required
                :placeholder="mode === 'call' ? 'What was the call about?' : 'What is the issue or request?'"
                class="w-full rounded-xl border p-3 outline-none focus:border-blue-500"
              >
              <p class="mt-1 text-end text-xs text-gray-400">{{ createForm.subject.length }}/200</p>
            </div>

            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label for="crm-dialog-occurred-at" class="mb-2 block text-sm font-semibold text-gray-700">
                  {{ mode === 'call' ? 'Call Date and Time' : 'Raised Date and Time' }} *
                </label>
                <input
                  id="crm-dialog-occurred-at"
                  v-model="createForm.occurredAt"
                  type="datetime-local"
                  :max="maximumDateTime"
                  required
                  class="w-full rounded-xl border p-3 outline-none focus:border-blue-500"
                  @focus="refreshMaximumDateTime"
                >
              </div>

              <div v-if="mode === 'ticket'">
                <label for="crm-dialog-priority" class="mb-2 block text-sm font-semibold text-gray-700">
                  Priority
                </label>
                <select
                  id="crm-dialog-priority"
                  v-model="createForm.priority"
                  class="w-full rounded-xl border bg-white p-3 outline-none focus:border-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div class="mt-5">
              <label for="crm-dialog-notes" class="mb-2 block text-sm font-semibold text-gray-700">
                {{ mode === 'call' ? 'Call Outcome / Notes' : 'Ticket Details' }}
              </label>
              <textarea
                id="crm-dialog-notes"
                v-model="createForm.notes"
                dir="auto"
                rows="7"
                maxlength="5000"
                :placeholder="mode === 'call'
                  ? 'Record the discussion and outcome.'
                  : 'Describe the issue, request, or important context.'"
                class="w-full resize-y rounded-xl border p-3 outline-none focus:border-blue-500"
              />
              <p class="mt-1 text-end text-xs text-gray-400">{{ createForm.notes.length }}/5000</p>
            </div>

            <p
              v-if="formError"
              class="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
              role="alert"
            >
              {{ formError }}
            </p>

            <div class="mt-6 flex flex-wrap justify-end gap-3 border-t pt-5">
              <button
                type="button"
                :disabled="saving"
                class="min-h-11 rounded-xl border px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="closeDialog"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon
                  :name="saving ? 'lucide:loader-circle' : mode === 'call' ? 'lucide:phone-call' : 'lucide:ticket-plus'"
                  size="18"
                  :class="saving ? 'animate-spin' : ''"
                />
                {{ submitLabel }}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import {
  formatCrmDate,
  parseCrmDateTimeInput,
  toCrmDateTimeInputValue
} from '~/utils/crmDateTime'

const props = defineProps({
  activityId: {
    type: String,
    default: ''
  },
  initialContactId: {
    type: String,
    default: ''
  },
  mode: {
    type: String,
    default: 'ticket',
    validator: (value) => ['call', 'ticket', 'detail'].includes(value)
  },
  open: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'saved'])
const { getAdminAuthHeaders } = useAdminLogs()
const generatedId = useId()
const dialogElement = ref(null)
const closeButton = ref(null)
const closeTicketButton = ref(null)
const closedAtInput = ref(null)
const activity = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailSuccess = ref('')
const saving = ref(false)
const formError = ref('')
const showCloseForm = ref(false)
const maximumDateTime = ref('')
let previousFocusedElement = null
let detailRequestGeneration = 0

const titleId = `crm-activity-dialog-${generatedId}`

const createForm = reactive({
  accountId: '',
  subject: '',
  notes: '',
  priority: 'normal',
  occurredAt: ''
})

const closeForm = reactive({
  closedAt: '',
  resolution: ''
})

const dialogTitle = computed(() => {
  if (props.mode === 'call') return 'Record Completed Call'
  if (props.mode === 'ticket') return 'Create Ticket'
  return activity.value?.subject || 'Activity Details'
})

const dialogDescription = computed(() => {
  if (props.mode === 'call') return 'Choose the CRM contact, then record the completed call.'
  if (props.mode === 'ticket') return 'Open one ticket for a company or person.'
  return activity.value?.activityType === 'case'
    ? 'Review the complete ticket and close it here when resolved.'
    : 'Review the complete call record.'
})

const dialogIcon = computed(() => {
  if (props.mode === 'call') return 'lucide:phone-call'
  if (props.mode === 'ticket') return 'lucide:ticket-plus'
  return activity.value?.activityType === 'call' ? 'lucide:phone-call' : 'lucide:ticket'
})

const submitLabel = computed(() => {
  if (saving.value) {
    return props.mode === 'call' ? 'Recording Call...' : 'Creating Ticket...'
  }

  return props.mode === 'call' ? 'Record Call' : 'Create Ticket'
})

const refreshMaximumDateTime = () => {
  maximumDateTime.value = toCrmDateTimeInputValue()
}

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

const resetCreateForm = () => {
  Object.assign(createForm, {
    accountId: props.initialContactId || '',
    subject: '',
    notes: '',
    priority: 'normal',
    occurredAt: toCrmDateTimeInputValue()
  })
}

const loadActivity = async () => {
  const activityId = String(props.activityId || '').trim()
  const generation = ++detailRequestGeneration
  activity.value = null
  detailError.value = ''
  detailSuccess.value = ''
  showCloseForm.value = false

  if (!activityId) {
    detailError.value = 'No CRM activity was selected.'
    return
  }

  detailLoading.value = true

  try {
    const response = await $fetch(`/api/admin-crm/activities/${activityId}`, {
      headers: await getAdminAuthHeaders()
    })

    if (generation === detailRequestGeneration) {
      activity.value = response.item || null
    }
  } catch (error) {
    if (generation === detailRequestGeneration) {
      detailError.value = getErrorMessage(error, 'Could not load the activity details.')
    }
  } finally {
    if (generation === detailRequestGeneration) {
      detailLoading.value = false
    }
  }
}

const saveNewActivity = async () => {
  if (saving.value) return

  formError.value = ''

  if (!createForm.accountId) {
    formError.value = 'Search for and choose a CRM company or person.'
    return
  }

  if (!createForm.subject.trim()) {
    formError.value = 'Subject is required.'
    return
  }

  try {
    refreshMaximumDateTime()
    saving.value = true
    const isCall = props.mode === 'call'

    const response = await $fetch('/api/admin-crm/activities', {
      method: 'POST',
      headers: await getAdminAuthHeaders(),
      body: {
        accountId: createForm.accountId,
        activityType: isCall ? 'call' : 'case',
        subject: createForm.subject,
        notes: createForm.notes,
        priority: isCall ? null : createForm.priority,
        occurredAt: parseCrmDateTimeInput(
          createForm.occurredAt,
          isCall ? 'Call date' : 'Raised date'
        )
      }
    })

    emit('saved', {
      id: response.id,
      type: isCall ? 'call' : 'ticket'
    })
    emit('close')
  } catch (error) {
    formError.value = getErrorMessage(error, 'Could not save the CRM activity.')
  } finally {
    saving.value = false
  }
}

const showCloseTicketForm = async () => {
  formError.value = ''
  detailSuccess.value = ''
  closeForm.closedAt = toCrmDateTimeInputValue()
  closeForm.resolution = ''
  refreshMaximumDateTime()
  showCloseForm.value = true
  await nextTick()
  closedAtInput.value?.focus()
}

const cancelCloseTicket = async () => {
  showCloseForm.value = false
  await nextTick()
  closeTicketButton.value?.focus()
}

const closeTicket = async () => {
  if (saving.value || !activity.value) return

  formError.value = ''

  try {
    const closedAt = parseCrmDateTimeInput(closeForm.closedAt, 'Closing date')

    if (Date.parse(closedAt) < Date.parse(activity.value.occurredAt)) {
      throw new Error('The closing date cannot be before the raised date.')
    }

    saving.value = true

    await $fetch(`/api/admin-crm/activities/${activity.value.id}/close`, {
      method: 'PATCH',
      headers: await getAdminAuthHeaders(),
      body: {
        closedAt,
        resolution: closeForm.resolution
      }
    })

    emit('saved', {
      id: activity.value.id,
      type: 'ticket_closed'
    })
    await loadActivity()
    detailSuccess.value = 'Ticket closed successfully.'
    await nextTick()
    closeButton.value?.focus()
  } catch (error) {
    formError.value = getErrorMessage(error, 'Could not close this ticket.')
  } finally {
    saving.value = false
  }
}

const closeDialog = () => {
  if (!saving.value) {
    emit('close')
  }
}

const handleDialogKeydown = (event) => {
  if (event.defaultPrevented) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeDialog()
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const focusableElements = [...dialogElement.value.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  )]

  if (!focusableElements.length) {
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

watch(
  [
    () => props.open,
    () => props.mode,
    () => props.activityId
  ],
  async ([isOpen]) => {
    if (!import.meta.client) return

    if (!isOpen) {
      detailRequestGeneration += 1
      document.body.style.overflow = ''
      previousFocusedElement?.focus?.()
      previousFocusedElement = null
      return
    }

    previousFocusedElement = document.activeElement
    document.body.style.overflow = 'hidden'
    formError.value = ''
    detailSuccess.value = ''
    refreshMaximumDateTime()

    if (props.mode !== 'detail') {
      resetCreateForm()
    }

    await nextTick()
    closeButton.value?.focus()

    if (props.mode === 'detail') {
      void loadActivity()
    }
  }
)

onBeforeUnmount(() => {
  detailRequestGeneration += 1

  if (import.meta.client && props.open) {
    document.body.style.overflow = ''
  }
})
</script>
