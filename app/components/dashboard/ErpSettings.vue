<template>
  <section class="space-y-6 rounded-2xl bg-white p-6 shadow">
    <h3 class="text-2xl font-bold">{{ $t('erp.system') }}</h3>
    <p v-if="loading" class="text-sm text-gray-500">{{ $t('erp.loading') }}</p>
    <template v-else-if="loaded">
      <div class="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:grid-cols-2" aria-live="polite">
        <div><p class="text-xs font-bold text-blue-700">{{ $t('erp.activeMode') }}</p><p class="mt-1 text-lg font-bold text-gray-900">{{ $t(settings.mode === 'daftra' ? 'erp.daftra' : 'erp.builtIn') }}</p></div>
        <div><p class="text-xs font-bold text-gray-500">{{ $t('erp.credentials') }}</p><p class="mt-1 font-bold">{{ $t(settings.credentialState === 'saved' ? 'erp.credentialsSaved' : 'erp.notConfigured') }}</p></div>
        <div><p class="text-xs font-bold text-gray-500">{{ $t('erp.health') }}</p><p class="mt-1 font-bold">{{ $t(`erp.health_${settings.connectionHealth}`) }}</p></div>
        <div><p class="text-xs font-bold text-gray-500">{{ $t('erp.activation') }}</p><p class="mt-1 font-bold">{{ $t(`erp.activation_${settings.activationState}`) }}</p></div>
      </div>
      <p class="text-sm text-gray-600">{{ $t('erp.credentialsDoNotActivate') }}</p>

      <div class="space-y-4 rounded-2xl border border-gray-200 p-5">
        <h4 class="font-bold">{{ $t('common.daftraConnection') }}</h4>
        <p class="text-sm text-gray-500">{{ settings.accountHost || $t('erp.notConfigured') }}</p>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="md:col-span-2"><span class="mb-2 block text-sm font-semibold">{{ $t('common.accountUrl') }}</span>
            <input v-model="credentials.accountUrl" type="url" inputmode="url" placeholder="https://your-account.daftra.com" class="w-full rounded-xl border border-gray-200 p-3" :disabled="!canEdit || busy">
          </label>
          <label><span class="mb-2 block text-sm font-semibold">{{ $t('common.apiKey') }}</span>
            <input v-model="credentials.apiKey" type="password" autocomplete="new-password" :placeholder="settings.apiKeyConfigured ? $t('dashboard.ErpSettings.leaveBlankToKeepSavedKey') : $t('common.enterApiKey')" class="w-full rounded-xl border border-gray-200 p-3" :disabled="!canEdit || busy">
          </label>
          <label><span class="mb-2 block text-sm font-semibold">{{ $t('common.clientId') }}</span>
            <input v-model="credentials.clientId" type="password" autocomplete="new-password" :placeholder="settings.clientIdConfigured ? $t('dashboard.ErpSettings.leaveBlankToKeepSavedId') : $t('common.optionalVariant2')" class="w-full rounded-xl border border-gray-200 p-3" :disabled="!canEdit || busy">
          </label>
        </div>
        <p v-if="settings.credentialsSource === 'environment'" class="text-sm text-amber-700">{{ $t('dashboard.ErpSettings.enterTheApiKeyOnceToMoveThisConnectionIntoTheDatabase') }}</p>
        <p v-if="!settings.encryptionReady" class="text-sm text-amber-700">{{ $t('dashboard.ErpSettings.addTheCredentialEncryptionKeyBeforeSavingSecrets') }}</p>
        <p v-if="credentialsDirty" class="text-sm text-amber-700">{{ $t('erp.saveBeforeTest') }}</p>
        <div class="flex flex-wrap justify-end gap-3">
          <button type="button" class="rounded-xl border px-4 py-3 font-bold disabled:opacity-40" :disabled="!canEdit || busy || credentialsDirty || !settings.configured" @click="testConnection">{{ $t(testing ? 'common.testing' : 'common.testConnection') }}</button>
          <button type="button" class="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-40" :disabled="!canSaveCredentials" @click="saveCredentials">{{ $t(credentialsSaving ? 'common.saving' : 'erp.saveCredentials') }}</button>
        </div>
        <p class="text-sm text-gray-500">{{ $t('common.lastChecked') }}: {{ formatDate(settings.lastCheckedAt) }}</p>
      </div>

      <fieldset class="grid gap-3 md:grid-cols-2" :disabled="!canEdit || busy">
        <legend class="mb-3 font-bold">{{ $t('erp.chooseProvider') }}</legend>
        <label v-for="mode in ['built_in','daftra']" :key="mode" class="flex cursor-pointer items-start gap-3 rounded-2xl border p-5" :class="selectedMode === mode ? 'border-blue-600 bg-blue-50' : 'border-gray-200'">
          <input v-model="selectedMode" type="radio" name="erp-mode" :value="mode" class="mt-1">
          <span><span class="block font-bold">{{ $t(mode === 'daftra' ? 'erp.daftra' : 'erp.builtIn') }}</span><span class="mt-1 block text-sm text-gray-500">{{ $t(mode === 'daftra' ? 'erp.daftraDescription' : 'erp.builtInDescription') }}</span></span>
        </label>
      </fieldset>

      <div v-if="selectedMode !== settings.mode" class="space-y-4 rounded-2xl border border-gray-200 p-5">
        <template v-if="selectedMode === 'daftra'">
          <p v-if="!settings.canActivateDaftra" class="text-sm text-amber-700">{{ $t('erp.testBeforeActivate') }}</p>
          <label class="flex gap-3"><input v-model="choice" type="radio" value="switch_only" :disabled="busy"><span><strong>{{ $t('erp.switchOnly') }}</strong><span class="mt-1 block text-sm text-gray-500">{{ $t('erp.noHistoricalTransfer') }}</span></span></label>
          <label class="flex gap-3"><input v-model="choice" type="radio" value="synchronize" :disabled="busy"><span><strong>{{ $t('erp.switchAndSynchronize') }}</strong><span class="mt-1 block text-sm text-gray-500">{{ $t('erp.supportedRefreshOnly') }}</span></span></label>
          <button v-if="choice === 'synchronize'" type="button" class="rounded-xl border px-4 py-2 font-bold disabled:opacity-40" :disabled="busy || !settings.canActivateDaftra || credentialsDirty" @click="prepareReview">{{ $t('erp.reviewData') }}</button>
          <div v-if="choice === 'synchronize' && review" class="overflow-x-auto">
            <table class="w-full text-start text-sm">
              <thead><tr><th class="p-2 text-start">{{ $t('erp.entity') }}</th><th class="p-2 text-start">{{ $t('erp.supportStatus') }}</th><th class="p-2 text-start">{{ $t('erp.direction') }}</th><th class="p-2 text-start">{{ $t('erp.count') }}</th><th class="p-2 text-start">{{ $t('erp.action') }}</th></tr></thead>
              <tbody><tr v-for="domain in review.manifest.domains" :key="domain.key" class="border-t">
                <td class="p-2 font-semibold">{{ $t(`erp.domain_${domain.key}`) }}</td>
                <td class="p-2">{{ $t(domain.supported ? 'erp.supported' : 'erp.manual') }}</td>
                <td class="p-2">{{ $t(domain.supported ? 'erp.fromDaftra' : 'erp.manual') }}</td>
                <td class="p-2">{{ domain.count ?? '—' }}</td>
                <td class="p-2"><p>{{ $t(domain.supported ? 'erp.mappingRefresh' : 'erp.archived') }}</p><p class="mt-1 text-xs text-amber-700">{{ $t(domain.supported ? 'erp.physicalReconciliation' : 'erp.unsupported') }}</p></td>
              </tr></tbody>
            </table>
          </div>
        </template>
        <template v-else>
          <h4 class="font-bold">{{ $t('erp.switchBack') }}</h4>
          <p class="text-sm text-amber-700">{{ $t('erp.newerDaftraChanges') }}</p>
          <p class="text-sm text-gray-600">{{ $t('erp.retainedBalances') }}</p>
        </template>
        <label class="flex items-start gap-3 text-sm"><input v-model="confirmed" type="checkbox" :disabled="busy" class="mt-1"><span>{{ $t('erp.confirmOwnership') }}</span></label>
        <button type="button" class="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40" :disabled="!canActivate" @click="saveMode">{{ $t(saving ? 'common.saving' : selectedMode === 'daftra' ? 'erp.activateDaftra' : 'erp.switchBack') }}</button>
      </div>
      <div class="flex flex-wrap gap-5 text-sm text-gray-600"><p>{{ $t('common.pendingSyncs') }}: {{ settings.jobCounts?.pending || 0 }}</p><p>{{ $t('common.failedSyncs') }}: {{ settings.jobCounts?.failed || 0 }}</p></div>
      <p v-if="settings.connectionError" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ $uiMessage(settings.connectionError) }}</p>
    </template>
    <p v-if="message" class="text-sm text-green-700" role="status">{{ $t(message) }}</p>
    <p v-if="errorMessage" class="text-sm text-red-700" role="alert">{{ $uiMessage(errorMessage) }}</p>
  </section>
</template>
<script setup>
const props=defineProps({canEdit:{type:Boolean,default:false}})
const {intlLocale}=useUiLocale()
const supabase=useSupabaseClient()
const loading=ref(true),loaded=ref(false),testing=ref(false),saving=ref(false),credentialsSaving=ref(false),reviewing=ref(false)
const errorMessage=ref(''),message=ref(''),selectedMode=ref('built_in'),choice=ref('switch_only'),confirmed=ref(false),review=ref(null)
const credentials=reactive({accountUrl:'',apiKey:'',clientId:''})
const settings=reactive({mode:'built_in',credentialState:'not_configured',connectionHealth:'not_tested',activationState:'inactive',jobCounts:{}})
const busy=computed(()=>testing.value || saving.value || credentialsSaving.value || reviewing.value)
const credentialsDirty=computed(()=>credentials.accountUrl !== (settings.accountUrl || '') || Boolean(credentials.apiKey || credentials.clientId))
const canSaveCredentials=computed(()=>props.canEdit && !busy.value && settings.encryptionReady && credentials.accountUrl.trim() && (credentials.apiKey.trim() || settings.credentialsSource === 'database' && settings.apiKeyConfigured))
const canActivate=computed(()=>props.canEdit && !busy.value && confirmed.value && (selectedMode.value === 'built_in' || settings.canActivateDaftra && !credentialsDirty.value && (choice.value === 'switch_only' || review.value)))
async function headers() { const {data}=await supabase.auth.getSession();if(!data.session?.access_token) throw new Error('Your session expired. Sign in again.');return {authorization:`Bearer ${data.session.access_token}`} }
async function loadSettings() {
  loading.value=true
  try { const result=await $fetch('/api/admin-erp/settings',{headers:await headers()});Object.assign(settings,result.settings);selectedMode.value=settings.mode;credentials.accountUrl=settings.accountUrl || '';loaded.value=true }
  catch(error) { loaded.value=false;errorMessage.value=error?.data?.statusMessage || 'Could not load ERP settings.' }
  finally { loading.value=false }
}
async function refreshState() { await Promise.all([refreshNuxtData('active-erp'),refreshNuxtData('site-content')]) }
async function testConnection() {
  testing.value=true;message.value='';errorMessage.value=''
  try { await $fetch('/api/admin-erp/connection',{method:'POST',headers:await headers()});message.value='erp.testSuccessful' }
  catch(error) { errorMessage.value=error?.data?.statusMessage || 'Daftra connection test failed.' }
  finally { await loadSettings();await refreshState();testing.value=false }
}
async function saveCredentials() {
  credentialsSaving.value=true;message.value='';errorMessage.value=''
  try { await $fetch('/api/admin-erp/credentials',{method:'PATCH',headers:await headers(),body:{...credentials}});credentials.apiKey='';credentials.clientId='';message.value='erp.credentialsSavedTest';await loadSettings();await refreshState() }
  catch(error) { errorMessage.value=error?.data?.statusMessage || 'Could not save the Daftra connection.' }
  finally { credentialsSaving.value=false }
}
async function prepareReview() {
  reviewing.value=true;confirmed.value=false;errorMessage.value=''
  try { review.value=await $fetch('/api/admin-erp/review',{method:'POST',headers:await headers()}) }
  catch(error) { errorMessage.value=error?.data?.statusMessage || 'Could not prepare the synchronization review.' }
  finally { reviewing.value=false }
}
async function saveMode() {
  saving.value=true;message.value='';errorMessage.value=''
  try { await $fetch('/api/admin-erp/settings',{method:'PATCH',headers:await headers(),body:{mode:selectedMode.value,stateVersion:settings.stateVersion,choice:selectedMode.value === 'built_in' ? 'without_import' : choice.value,reviewId:review.value?.reviewId,confirmed:confirmed.value}});message.value=selectedMode.value === 'daftra' ? 'erp.activeDaftra' : 'erp.activeBuiltIn';await loadSettings();await refreshState() }
  catch(error) { errorMessage.value=error?.data?.statusMessage || 'Could not save the ERP mode.' }
  finally { saving.value=false;confirmed.value=false;review.value=null }
}
const formatDate=value=>value ? new Intl.DateTimeFormat(intlLocale.value,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—'
watch([selectedMode,choice],()=>{confirmed.value=false;review.value=null})
onMounted(loadSettings)
</script>
