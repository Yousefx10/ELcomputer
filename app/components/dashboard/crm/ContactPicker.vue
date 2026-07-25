<template>
  <div>
    <label
      :for="resolvedInputId"
      class="mb-2 block text-sm font-semibold text-gray-700"
    >
      {{ label }}<span v-if="required" class="text-red-600"> *</span>
    </label>

    <div
      v-if="selectedContact"
      class="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"
    >
      <div class="min-w-0">
        <p class="truncate font-semibold text-gray-900">{{ selectedContact.name }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ getContactMeta(selectedContact) }}</p>
      </div>

      <button
        type="button"
        :disabled="disabled"
        class="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        @click="clearSelection"
      >
        Change
      </button>
    </div>

    <div class="relative">
      <input
        :id="resolvedInputId"
        ref="searchInput"
        v-model="searchQuery"
        type="search"
        maxlength="100"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="resultsOpen"
        :aria-controls="resultsId"
        :aria-activedescendant="activeOptionId"
        :disabled="disabled"
        :placeholder="selectedContact ? 'Search to choose another contact' : placeholder"
        class="w-full rounded-xl border bg-white p-3 pe-11 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
        @focus="openResults"
        @blur="scheduleCloseResults"
        @keydown.down.prevent="moveActiveOption(1)"
        @keydown.up.prevent="moveActiveOption(-1)"
        @keydown.enter.prevent="chooseActiveOption"
        @keydown.esc="handleEscape"
      >

      <Icon
        :name="loading ? 'lucide:loader-circle' : 'lucide:search'"
        size="18"
        class="absolute end-3 top-3.5 text-gray-400"
        :class="loading ? 'animate-spin' : ''"
      />

      <div
        v-if="resultsOpen"
        class="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border bg-white p-2 shadow-xl"
      >
        <div
          :id="resultsId"
          role="listbox"
          :aria-label="label"
        >
          <div
            v-if="normalizedSearch.length < 2"
            role="option"
            aria-disabled="true"
            class="px-3 py-4 text-sm text-gray-500"
          >
            Type at least 2 characters, then choose a company or person.
          </div>

          <div
            v-else-if="loading"
            role="option"
            aria-disabled="true"
            class="px-3 py-4 text-sm text-gray-500"
          >
            Searching CRM contacts...
          </div>

          <div
            v-else-if="searchError"
            role="option"
            aria-disabled="true"
            class="px-3 py-4 text-sm text-red-600"
          >
            {{ searchError }}
          </div>

          <div
            v-else-if="!visibleContacts.length"
            role="option"
            aria-disabled="true"
            class="px-3 py-4 text-sm text-gray-500"
          >
            No CRM contacts match “{{ normalizedSearch }}”.
          </div>

          <div
            v-for="(contact, index) in visibleContacts"
            v-else
            :id="getOptionId(index)"
            :key="contact.id"
            role="option"
            :aria-selected="contact.id === modelValue"
            class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-3 text-start transition"
            :class="index === activeOptionIndex
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'"
            @mouseenter="activeOptionIndex = index"
            @mousedown.prevent="selectContact(contact)"
            @click="selectContact(contact)"
          >
            <span class="min-w-0">
              <span class="block truncate font-semibold">{{ contact.name }}</span>
              <span
                class="mt-1 block text-xs"
                :class="index === activeOptionIndex ? 'text-blue-100' : 'text-gray-400'"
              >
                {{ getContactMeta(contact) }}
              </span>
            </span>

            <Icon
              :name="contact.entityType === 'person' ? 'lucide:user-round' : 'lucide:building-2'"
              size="18"
              class="shrink-0"
            />
          </div>
        </div>

        <p
          v-if="resultsLimited && visibleContacts.length"
          class="border-t px-3 pt-3 text-xs text-gray-400"
        >
          Refine the search to see more matches.
        </p>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">
      {{ resultAnnouncement }}
    </p>
  </div>
</template>

<script setup>
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  inputId: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: 'CRM Contact'
  },
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Search company or person name'
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'select'])
const { getAdminAuthHeaders } = useAdminLogs()
const generatedId = useId()
const searchInput = ref(null)
const searchQuery = ref('')
const contacts = ref([])
const selectedContact = ref(null)
const loading = ref(false)
const limited = ref(false)
const searchError = ref('')
const resultsOpen = ref(false)
const activeOptionIndex = ref(-1)

let searchTimeoutId
let closeTimeoutId
let searchRequestGeneration = 0
let selectionRequestGeneration = 0

const resolvedInputId = computed(() => props.inputId || `crm-contact-${generatedId}`)
const resultsId = computed(() => `${resolvedInputId.value}-results`)
const normalizedSearch = computed(() => searchQuery.value.trim())
const visibleContacts = computed(() => {
  const resultLimit = 50
  const companies = contacts.value.filter((contact) => contact.entityType !== 'person')
  const people = contacts.value.filter((contact) => contact.entityType === 'person')
  const resultGroups = contacts.value[0]?.entityType === 'person'
    ? [people, companies]
    : [companies, people]
  const groupIndexes = [0, 0]
  const balancedResults = []

  while (
    balancedResults.length < resultLimit
    && resultGroups.some((group, index) => groupIndexes[index] < group.length)
  ) {
    resultGroups.forEach((group, index) => {
      if (
        balancedResults.length < resultLimit
        && groupIndexes[index] < group.length
      ) {
        balancedResults.push(group[groupIndexes[index]])
        groupIndexes[index] += 1
      }
    })
  }

  return balancedResults
})
const resultsLimited = computed(() => {
  return limited.value || contacts.value.length > visibleContacts.value.length
})
const activeOptionId = computed(() => {
  return activeOptionIndex.value >= 0
    ? getOptionId(activeOptionIndex.value)
    : undefined
})
const resultAnnouncement = computed(() => {
  if (loading.value) {
    return 'Searching CRM contacts.'
  }

  if (normalizedSearch.value.length < 2) {
    return ''
  }

  const count = visibleContacts.value.length
  return `${count} CRM contact${count === 1 ? '' : 's'} found.`
})

const getOptionId = (index) => `${resultsId.value}-option-${index}`

const getContactMeta = (contact) => {
  const entity = contact.entityType === 'person' ? 'Person' : 'Company'
  const account = contact.accountType === 'supplier' ? 'Supplier' : 'Customer'
  const inactive = contact.isActive ? '' : ' · Inactive'
  return `${entity} · ${account}${inactive}`
}

const getErrorMessage = (error, fallbackMessage) => {
  return error?.data?.statusMessage
    || error?.statusMessage
    || error?.message
    || fallbackMessage
}

const resolveSelectedContact = async (contactId) => {
  if (!import.meta.client) {
    return
  }

  const normalizedId = String(contactId || '').trim()

  if (!normalizedId) {
    selectedContact.value = null
    return
  }

  if (selectedContact.value?.id === normalizedId) {
    return
  }

  const generation = ++selectionRequestGeneration

  try {
    const response = await $fetch('/api/admin-crm/contacts', {
      headers: await getAdminAuthHeaders(),
      query: {
        selectedIds: normalizedId,
        selectedOnly: 'true'
      }
    })

    if (generation !== selectionRequestGeneration) {
      return
    }

    selectedContact.value = (response.items || []).find((contact) => {
      return contact.id === normalizedId
    }) || null

    if (selectedContact.value) {
      emit('select', selectedContact.value)
    }
  } catch {
    if (generation === selectionRequestGeneration) {
      selectedContact.value = null
    }
  }
}

const searchContacts = async () => {
  if (!import.meta.client) {
    return
  }

  const search = normalizedSearch.value

  if (search.length < 2) {
    searchRequestGeneration += 1
    contacts.value = []
    loading.value = false
    limited.value = false
    searchError.value = ''
    activeOptionIndex.value = -1
    return
  }

  const generation = ++searchRequestGeneration
  loading.value = true
  searchError.value = ''

  try {
    const response = await $fetch('/api/admin-crm/contacts', {
      headers: await getAdminAuthHeaders(),
      query: {
        search
      }
    })

    if (generation !== searchRequestGeneration) {
      return
    }

    contacts.value = response.items || []
    limited.value = Boolean(response.limited)
    activeOptionIndex.value = contacts.value.length ? 0 : -1
  } catch (error) {
    if (generation === searchRequestGeneration) {
      contacts.value = []
      limited.value = false
      activeOptionIndex.value = -1
      searchError.value = getErrorMessage(error, 'Could not search CRM contacts.')
    }
  } finally {
    if (generation === searchRequestGeneration) {
      loading.value = false
    }
  }
}

const selectContact = (contact) => {
  selectionRequestGeneration += 1
  selectedContact.value = contact
  emit('update:modelValue', contact.id)
  emit('select', contact)
  searchQuery.value = ''
  contacts.value = []
  closeResults()
}

const clearSelection = async () => {
  selectionRequestGeneration += 1
  selectedContact.value = null
  emit('update:modelValue', '')
  emit('select', null)
  searchQuery.value = ''
  await nextTick()
  searchInput.value?.focus()
  openResults()
}

const openResults = () => {
  if (closeTimeoutId) {
    window.clearTimeout(closeTimeoutId)
  }

  resultsOpen.value = true
}

const closeResults = () => {
  resultsOpen.value = false
  activeOptionIndex.value = -1
}

const handleEscape = (event) => {
  if (!resultsOpen.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  closeResults()
}

const scheduleCloseResults = () => {
  if (closeTimeoutId) {
    window.clearTimeout(closeTimeoutId)
  }

  closeTimeoutId = window.setTimeout(closeResults, 150)
}

const moveActiveOption = (direction) => {
  openResults()

  const count = visibleContacts.value.length
  if (!count) {
    return
  }

  activeOptionIndex.value = (
    activeOptionIndex.value + direction + count
  ) % count

  nextTick(() => {
    document.getElementById(getOptionId(activeOptionIndex.value))?.scrollIntoView({
      block: 'nearest'
    })
  })
}

const chooseActiveOption = () => {
  const contact = visibleContacts.value[activeOptionIndex.value]
  if (contact) {
    selectContact(contact)
  }
}

watch(searchQuery, () => {
  if (searchTimeoutId) {
    window.clearTimeout(searchTimeoutId)
  }

  searchRequestGeneration += 1
  loading.value = false
  contacts.value = []
  limited.value = false
  searchError.value = ''
  activeOptionIndex.value = -1

  if (!resultsOpen.value && !normalizedSearch.value) {
    return
  }

  openResults()
  searchTimeoutId = window.setTimeout(searchContacts, 300)
})

watch(
  () => props.modelValue,
  (contactId) => {
    if (!contactId) {
      selectionRequestGeneration += 1
      selectedContact.value = null
      return
    }

    void resolveSelectedContact(contactId)
  },
  {
    immediate: true
  }
)

onBeforeUnmount(() => {
  searchRequestGeneration += 1
  selectionRequestGeneration += 1

  if (searchTimeoutId) {
    window.clearTimeout(searchTimeoutId)
  }

  if (closeTimeoutId) {
    window.clearTimeout(closeTimeoutId)
  }
})
</script>
