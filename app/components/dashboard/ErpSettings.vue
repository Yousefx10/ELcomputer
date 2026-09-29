<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white p-6 shadow">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="text-2xl font-bold">{{ $t('common.erpMode') }}</h3>
          <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.ErpSettings.theWebsiteAlwaysOwnsEcommerceOrders') }}</p>
        </div>

        <span
          class="rounded-full px-3 py-1 text-sm font-bold"
          :class="connectionClass"
        >
          {{ $uiLabel(connectionLabel) }}
        </span>
      </div>

      <div v-if="loading" class="mt-6 text-sm text-gray-500">{{ $t('common.loadingErpSettings') }}</div>

      <div v-else class="mt-6 space-y-5">
        <div class="space-y-4 rounded-2xl border border-gray-200 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="font-bold text-gray-900">{{ $t('common.daftraConnection') }}</h4>
              <p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.ErpSettings.saveThisSiteSCredentialsFromTheDashboard') }}</p>
            </div>
            <span
              v-if="settings.credentialsSource"
              class="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600"
            >
              {{ settings.credentialsSource === 'database' ? $t('common.savedInDatabase') : $t('common.legacyServerSettings') }}
            </span>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="md:col-span-2">
              <span class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.accountUrl') }}</span>
              <input
                v-model="credentials.accountUrl"
                type="url"
                inputmode="url"
                placeholder="https://your-account.daftra.com"
                class="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-blue-500"
                :disabled="!canEdit"
              >
            </label>

            <label>
              <span class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.apiKey') }}</span>
              <input
                v-model="credentials.apiKey"
                type="password"
                autocomplete="new-password"
                :placeholder="settings.apiKeyConfigured ? $t('dashboard.ErpSettings.leaveBlankToKeepSavedKey') : $t('common.enterApiKey')"
                class="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-blue-500"
                :disabled="!canEdit"
              >
            </label>

            <label>
              <span class="mb-2 block text-sm font-semibold text-gray-700">{{ $t('common.clientId') }}</span>
              <input
                v-model="credentials.clientId"
                type="password"
                autocomplete="new-password"
                :placeholder="settings.clientIdConfigured ? $t('dashboard.ErpSettings.leaveBlankToKeepSavedId') : $t('common.optionalVariant2')"
                class="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-blue-500"
                :disabled="!canEdit"
              >
            </label>
          </div>

          <p v-if="settings.credentialsSource === 'environment'" class="text-sm text-amber-700">
            {{ $t('dashboard.ErpSettings.enterTheApiKeyOnceToMoveThisConnectionIntoTheDatabase') }}
          </p>

          <p v-if="!settings.encryptionReady" class="text-sm text-amber-700">
            {{ $t('dashboard.ErpSettings.addTheCredentialEncryptionKeyBeforeSavingSecrets') }}
          </p>

          <div class="flex justify-end">
            <button
              type="button"
              class="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              :disabled="!canSaveCredentials"
              @click="saveCredentials"
            >
              {{ credentialsSaving ? $t('common.saving') : $t('common.saveConnection') }}
            </button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label
            v-for="option in modeOptions"
            :key="option.value"
            class="cursor-pointer rounded-2xl border p-5"
            :class="selectedMode === option.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'"
          >
            <input v-model="selectedMode" class="sr-only" type="radio" :value="option.value" :disabled="!canEdit">
            <span class="flex items-start gap-3">
              <span
                class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                :class="selectedMode === option.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'"
              >
                <Icon v-if="selectedMode === option.value" name="lucide:check" size="14" />
              </span>
              <span>
                <span class="block font-bold text-gray-900">{{ $uiLabel(option.label) }}</span>
                <span class="mt-1 block text-sm text-gray-500">{{ option.description }}</span>
              </span>
            </span>
          </label>
        </div>

        <div class="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:grid-cols-2">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400">{{ $t('common.daftraAccount') }}</p>
            <p class="mt-1 font-semibold text-gray-900">{{ settings.accountHost || $t('common.notConfigured') }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400">{{ $t('common.lastChecked') }}</p>
            <p class="mt-1 font-semibold text-gray-900">{{ formatDate(settings.lastCheckedAt) }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400">{{ $t('common.pendingSyncs') }}</p>
            <p class="mt-1 font-semibold text-gray-900">{{ settings.jobCounts?.pending || 0 }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400">{{ $t('common.failedSyncs') }}</p>
            <p class="mt-1 font-semibold text-gray-900">{{ settings.jobCounts?.failed || 0 }}</p>
          </div>
        </div>

        <p v-if="settings.connectionError" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {{ settings.connectionError }}
        </p>

        <p v-if="settings.migrationRequired" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
          {{ $t('dashboard.ErpSettings.runTheLatestDatabaseMigrationFirst') }}
        </p>

        <p v-if="selectedMode === 'daftra'" class="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
          {{ $t('dashboard.ErpSettings.newOrdersWillSyncAfterLocalStorageSucceeds') }}
        </p>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-xl border border-gray-300 px-5 py-3 font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canEdit || testing || saving || credentialsSaving || settings.migrationRequired || !settings.configured"
            @click="testConnection"
          >
            {{ testing ? $t('common.testing') : $t('common.testConnection') }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            :disabled="!canEdit || saving || testing || credentialsSaving || selectedMode === settings.mode || settings.migrationRequired"
            @click="saveMode"
          >
            {{ saving ? $t('common.saving') : $t('common.saveErpMode') }}
          </button>
        </div>

        <p v-if="message" class="text-sm text-green-700">{{ $uiLabel(message) }}</p>
        <p v-if="errorMessage" class="text-sm text-red-700">{{ $uiMessage(errorMessage) }}</p>
      </div>
    </section>

    <!-- Dashboard visibility rules are documented in docs/daftra-erp.md. -->
  </div>
</template>

<script setup>
const { intlLocale } = useUiLocale()

const props = defineProps({
  canEdit: {
    type: Boolean,
    default: false
  }
})

const supabase = useSupabaseClient()
const loading = ref(true)
const testing = ref(false)
const saving = ref(false)
const credentialsSaving = ref(false)
const errorMessage = ref('')
const message = ref('')
const selectedMode = ref('built_in')
const credentials = reactive({
  accountUrl: '',
  apiKey: '',
  clientId: ''
})
const settings = reactive({
  mode: 'built_in',
  connectionStatus: 'disconnected',
  lastCheckedAt: null,
  accountHost: '',
  accountUrl: '',
  apiKeyConfigured: false,
  clientIdConfigured: false,
  credentialsSource: '',
  encryptionReady: false,
  configured: false,
  connectionError: '',
  migrationRequired: false,
  jobCounts: {}
})

const modeOptions = [
  { value: 'built_in', label: 'Built-in ERP', description: 'Use the current purchasing and finance tools.' },
  { value: 'daftra', label: 'Daftra ERP', description: 'Use Daftra for inventory, invoices and accounting.' }
]

const connectionLabel = computed(() => ({
  connected: 'Connected',
  error: 'Connection error',
  disconnected: 'Not connected'
})[settings.connectionStatus] || 'Not connected')

const connectionClass = computed(() => ({
  connected: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  disconnected: 'bg-gray-100 text-gray-600'
})[settings.connectionStatus] || 'bg-gray-100 text-gray-600')

const canSaveCredentials = computed(() => {
  const hasStoredApiKey = settings.credentialsSource === 'database' && settings.apiKeyConfigured

  return props.canEdit
    && !credentialsSaving.value
    && !testing.value
    && !saving.value
    && !settings.migrationRequired
    && settings.encryptionReady
    && Boolean(credentials.accountUrl.trim())
    && Boolean(credentials.apiKey.trim() || hasStoredApiKey)
})

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Sign in again.')
  }

  return { authorization: `Bearer ${data.session.access_token}` }
}

const applySettings = (value = {}) => {
  Object.assign(settings, value)
  selectedMode.value = settings.mode || 'built_in'
  credentials.accountUrl = settings.accountUrl || ''
}

const loadSettings = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch('/api/admin-erp/settings', {
      headers: await getAuthHeaders()
    })
    applySettings(response.settings)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not load ERP settings.'
  } finally {
    loading.value = false
  }
}

const testConnection = async () => {
  testing.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    const response = await $fetch('/api/admin-erp/connection', {
      method: 'POST',
      headers: await getAuthHeaders()
    })
    settings.connectionStatus = response.connection?.connected ? 'connected' : 'error'
    settings.lastCheckedAt = response.connection?.checkedAt || new Date().toISOString()
    settings.connectionError = ''
    message.value = 'Daftra is connected.'
    await loadSettings()
    await refreshNuxtData('site-content')
  } catch (error) {
    settings.connectionStatus = 'error'
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not connect to Daftra.'
  } finally {
    testing.value = false
  }
}

const saveCredentials = async () => {
  credentialsSaving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    await $fetch('/api/admin-erp/credentials', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: {
        accountUrl: credentials.accountUrl,
        apiKey: credentials.apiKey,
        clientId: credentials.clientId
      }
    })
    credentials.apiKey = ''
    credentials.clientId = ''
    message.value = 'Daftra connection saved. Test it before activation.'
    await loadSettings()
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not save the Daftra connection.'
  } finally {
    credentialsSaving.value = false
  }
}

const saveMode = async () => {
  saving.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    await $fetch('/api/admin-erp/settings', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: { mode: selectedMode.value }
    })
    settings.mode = selectedMode.value
    settings.connectionStatus = selectedMode.value === 'daftra' ? 'connected' : settings.connectionStatus
    message.value = selectedMode.value === 'daftra' ? 'Daftra ERP is active.' : 'Built-in ERP is active.'
    await refreshNuxtData('site-content')
    await loadSettings()
  } catch (error) {
    selectedMode.value = settings.mode
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not save the ERP mode.'
  } finally {
    saving.value = false
  }
}

const formatDate = (value) => {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(intlLocale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

onMounted(loadSettings)
</script>
