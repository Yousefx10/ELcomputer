<script setup>
const props = defineProps({ canEdit: { type: Boolean, default: false } })
const { request, errorText } = useSupportClient()
const days = [
  ['0', 'Sunday'], ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'],
  ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday']
]
const mimeOptions = [
  ['image/jpeg', 'JPEG'], ['image/png', 'PNG'], ['image/webp', 'WebP'], ['application/pdf', 'PDF']
]
const timezones = ['Asia/Riyadh', 'Africa/Cairo', 'UTC', 'Europe/London', 'America/New_York']
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const settings = ref(null)
const snapshot = ref('')
const availability = ref(null)

const dirty = computed(() => settings.value && JSON.stringify(settings.value) !== snapshot.value)
const attachmentMegabytes = computed({
  get: () => settings.value ? Number((settings.value.max_attachment_bytes / 1048576).toFixed(2)) : 5,
  set: value => { if (settings.value) settings.value.max_attachment_bytes = Math.round(Number(value) * 1048576) }
})
const availabilityText = computed(() => ({
  disabled: 'Chat is disabled', forced_offline: 'Manually offline', no_agent: 'No agent is online',
  forced_online: 'Manually online', within_hours: 'Open during business hours', outside_hours: 'Outside business hours'
})[availability.value?.reason] || 'Availability unavailable')
const availabilityClass = computed(() => availability.value?.available
  ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800')

const applyResult = (result) => {
  settings.value = structuredClone(result.settings)
  snapshot.value = JSON.stringify(settings.value)
  availability.value = result.availability || null
}
const load = async () => {
  loading.value = true; error.value = ''; notice.value = ''
  try { applyResult(await request('/api/admin-chat/settings')) }
  catch (cause) { error.value = errorText(cause, 'Could not load Live Chat settings.') }
  finally { loading.value = false }
}
const save = async () => {
  if (!props.canEdit || !dirty.value || saving.value) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    const result = await request('/api/admin-chat/settings', { method: 'PUT', body: {
      expectedUpdatedAt: settings.value.updated_at,
      settings: Object.fromEntries(Object.entries(settings.value).filter(([key]) => key !== 'updated_at'))
    } })
    applyResult(result)
    notice.value = 'Live Chat settings saved.'
  } catch (cause) { error.value = errorText(cause, 'Could not save Live Chat settings.') }
  finally { saving.value = false }
}
const toggleMime = (mime) => {
  const selected = settings.value.allowed_attachment_mimes
  if (selected.includes(mime) && selected.length === 1) return
  settings.value.allowed_attachment_mimes = selected.includes(mime)
    ? selected.filter(item => item !== mime) : [...selected, mime]
}
const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const canAddInterval = day => settings.value.weekly_hours[day].length < 3
  && (!settings.value.weekly_hours[day].length || settings.value.weekly_hours[day].at(-1)[1] < '23:59')
const addInterval = (day) => {
  const slots = settings.value.weekly_hours[day]
  if (!canAddInterval(day)) return
  if (!slots.length) { slots.push(['09:00', '17:00']); return }
  const start = toMinutes(slots.at(-1)[1])
  slots.push([toTime(start), toTime(Math.min(1439, start + 60))])
}
const removeInterval = (day, index) => settings.value.weekly_hours[day].splice(index, 1)
onMounted(load)
</script>

<template>
  <section class="space-y-5" aria-labelledby="live-chat-settings-heading">
    <p v-if="loading" class="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow">{{ $t('dashboard.liveChatSettings.loadingLiveChatSettings') }}</p>
    <p v-if="error" class="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{{ $uiMessage(error) }}</p>
    <p v-if="notice" class="rounded-xl bg-green-50 p-4 text-sm text-green-700" role="status">{{ $uiLabel(notice) }}</p>
    <template v-if="settings">
      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div><h2 id="live-chat-settings-heading" class="text-2xl font-bold text-gray-900">{{ $t('common.liveChatAvailability') }}</h2><p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.liveChatSettings.controlWhenCustomersCanStartConversations') }}</p></div>
          <span class="rounded-full border px-3 py-1.5 text-xs font-bold" :class="availabilityClass">{{ $uiLabel(availabilityText) }}</span>
        </div>
        <p class="mt-3 text-xs text-gray-500">{{ $t('dashboard.liveChatSettings.valueEligibleAgentvalueOnlineValueValue', { value0: (availability?.eligibleAgentCount || 0), value1: (availability?.eligibleAgentCount === 1 ? '' : $uiPluralSuffix('s')), value2: (availability?.localTime || $t('dashboard.liveChatSettings.localTimeUnavailable')), value3: (availability?.timezone || '') }) }}</p>
        <fieldset :disabled="!canEdit || saving" class="mt-5 grid gap-4 md:grid-cols-2 disabled:opacity-60">
          <label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.is_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">{{ $t('common.enableLiveChat') }}</strong><small class="text-gray-500">{{ $t('dashboard.liveChatSettings.showTheCustomerLauncher') }}</small></span></label>
          <label class="block text-sm font-semibold">{{ $t('common.availabilityOverride') }}<select v-model="settings.availability_override" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><option value="auto">{{ $t('common.useBusinessHours') }}</option><option value="online">{{ $t('dashboard.liveChatSettings.onlineWhenAnAgentIsOnline') }}</option><option value="offline">{{ $t('common.alwaysOffline') }}</option></select></label>
        </fieldset>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-xl font-bold text-gray-900">{{ $t('common.businessHours') }}</h2><p class="mt-1 text-sm text-gray-500">{{ $t('dashboard.liveChatSettings.manualOverridesTakePriority') }}</p>
        <fieldset :disabled="!canEdit || saving" class="mt-5 space-y-4 disabled:opacity-60">
          <label class="block max-w-md text-sm font-semibold">{{ $t('common.timezone') }}<input v-model="settings.business_timezone" list="chat-timezones" maxlength="64" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><datalist id="chat-timezones"><option v-for="timezone in timezones" :key="timezone" :value="timezone" /></datalist></label>
          <div class="divide-y rounded-xl border border-gray-200">
            <div v-for="([day, label]) in days" :key="day" class="grid gap-3 p-4 md:grid-cols-[110px_1fr_auto] md:items-start">
              <strong class="text-sm">{{ $uiLabel(label) }}</strong>
              <div class="space-y-2"><p v-if="!settings.weekly_hours[day].length" class="text-sm text-gray-500">{{ $t('common.closed') }}</p><div v-for="(slot, index) in settings.weekly_hours[day]" :key="index" class="flex flex-wrap items-center gap-2"><input v-model="slot[0]" type="time" :aria-label="$t('common.openingTime')" class="rounded-lg border border-gray-200 p-2"><span class="text-gray-400">{{ $t('common.to') }}</span><input v-model="slot[1]" type="time" :aria-label="$t('common.closingTime')" class="rounded-lg border border-gray-200 p-2"><button type="button" class="text-xs font-semibold text-red-700" @click="removeInterval(day, index)">{{ $t('common.remove') }}</button></div></div>
              <button type="button" :disabled="!canAddInterval(day)" class="text-xs font-semibold text-blue-700 disabled:opacity-40" @click="addInterval(day)">{{ $t('common.addHours') }}</button>
            </div>
          </div>
        </fieldset>
      </section>

      <section class="grid gap-5 xl:grid-cols-2">
        <div class="rounded-2xl bg-white p-6 shadow"><h2 class="text-xl font-bold text-gray-900">{{ $t('common.customerMessages') }}</h2><fieldset :disabled="!canEdit || saving" class="mt-5 space-y-4 disabled:opacity-60"><label class="block text-sm font-semibold">{{ $t('common.welcomeMessage') }}<textarea v-model="settings.welcome_message" maxlength="500" rows="3" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label><label class="block text-sm font-semibold">{{ $t('common.offlineMessage') }}<textarea v-model="settings.offline_message" maxlength="500" rows="3" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label><label class="block text-sm font-semibold">{{ $t('common.guestContact') }}<select v-model="settings.guest_contact_rule" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><option value="either">{{ $t('common.emailOrMobile') }}</option><option value="email">{{ $t('common.emailRequired') }}</option><option value="mobile">{{ $t('common.mobileRequired') }}</option><option value="both">{{ $t('common.emailAndMobile') }}</option></select></label><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm font-semibold">{{ $t('common.sendDelay') }}<input v-model.number="settings.customer_send_cooldown_seconds" type="number" min="0" max="60" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><small class="text-gray-500">{{ $t('common.secondsBetweenSends') }}</small></label><label class="text-sm font-semibold">{{ $t('common.messageLimit') }}<input v-model.number="settings.max_message_length" type="number" min="100" max="10000" step="100" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><small class="text-gray-500">{{ $t('common.charactersPerMessage') }}</small></label></div></fieldset></div>

        <div class="rounded-2xl bg-white p-6 shadow"><h2 class="text-xl font-bold text-gray-900">{{ $t('common.attachments') }}</h2><fieldset :disabled="!canEdit || saving" class="mt-5 space-y-4 disabled:opacity-60"><label class="flex items-center gap-3 text-sm font-semibold"><input v-model="settings.attachments_enabled" type="checkbox">{{ $t('common.allowAttachments') }}</label><div><span class="text-sm font-semibold">{{ $t('common.fileTypes') }}</span><div class="mt-2 flex flex-wrap gap-3"><label v-for="([mime, label]) in mimeOptions" :key="mime" class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="settings.allowed_attachment_mimes.includes(mime)" @change="toggleMime(mime)">{{ $uiLabel(label) }}</label></div></div><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm font-semibold">{{ $t('common.maximumSize') }}<input v-model.number="attachmentMegabytes" type="number" min="0.01" max="5" step="0.25" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><small class="text-gray-500">{{ $t('common.megabytesPerFile') }}</small></label><label class="text-sm font-semibold">{{ $t('common.filesPerMessage') }}<input v-model.number="settings.max_attachments_per_message" type="number" min="0" max="5" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"></label></div></fieldset></div>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow"><h2 class="text-xl font-bold text-gray-900">{{ $t('common.workflow') }}</h2><fieldset :disabled="!canEdit || saving" class="mt-5 grid gap-4 md:grid-cols-2 disabled:opacity-60"><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.transfers_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">{{ $t('common.allowTransfers') }}</strong><small class="text-gray-500">{{ $t('dashboard.liveChatSettings.managersCanTransferActiveChats') }}</small></span></label><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.reopen_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">{{ $t('common.allowReopening') }}</strong><small class="text-gray-500">{{ $t('dashboard.liveChatSettings.managersCanReopenClosedChats') }}</small></span></label><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.ticket_conversion_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">{{ $t('common.allowTicketConversion') }}</strong><small class="text-gray-500">{{ $t('dashboard.liveChatSettings.agentsCanCreateLinkedTickets') }}</small></span></label><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.request_call_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">{{ $t('common.requestACall') }}</strong><small class="text-gray-500">{{ $t('dashboard.liveChatSettings.letCustomersAskForACallback') }}</small></span></label></fieldset><p class="mt-4 text-sm text-gray-500">{{ $t('dashboard.liveChatSettings.offlineMessagesStayInLiveChatUntilFollowUpIsNeeded') }}</p></section>

      <div class="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-lg"><p class="text-sm text-gray-600">{{ $t('dashboard.liveChatSettings.savedChangesApplyImmediately') }}</p><div class="flex gap-3"><button type="button" :disabled="saving" class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="load">{{ $t('common.reload') }}</button><button type="button" :disabled="!canEdit || !dirty || saving" class="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40" @click="save">{{ saving ? $t('common.saving') : $t('common.saveLiveChat') }}</button></div></div>
    </template>
  </section>
</template>
