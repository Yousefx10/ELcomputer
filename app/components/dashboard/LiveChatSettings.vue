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
watch(() => settings.value?.ticket_conversion_enabled, (enabled) => {
  if (settings.value && enabled === false && settings.value.offline_behavior === 'ticket') {
    settings.value.offline_behavior = 'conversation'
  }
})
onMounted(load)
</script>

<template>
  <section class="space-y-5" aria-labelledby="live-chat-settings-heading">
    <p v-if="loading" class="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow">Loading Live Chat settings…</p>
    <p v-if="error" class="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="notice" class="rounded-xl bg-green-50 p-4 text-sm text-green-700" role="status">{{ notice }}</p>
    <template v-if="settings">
      <section class="rounded-2xl bg-white p-6 shadow">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div><h2 id="live-chat-settings-heading" class="text-2xl font-bold text-gray-900">Live Chat availability</h2><p class="mt-1 text-sm text-gray-500">Control when customers can start conversations.</p></div>
          <span class="rounded-full border px-3 py-1.5 text-xs font-bold" :class="availabilityClass">{{ availabilityText }}</span>
        </div>
        <p class="mt-3 text-xs text-gray-500">{{ availability?.eligibleAgentCount || 0 }} eligible agent{{ availability?.eligibleAgentCount === 1 ? '' : 's' }} online · {{ availability?.localTime || 'Local time unavailable' }} {{ availability?.timezone || '' }}</p>
        <fieldset :disabled="!canEdit || saving" class="mt-5 grid gap-4 md:grid-cols-2 disabled:opacity-60">
          <label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.is_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">Enable Live Chat</strong><small class="text-gray-500">Show the customer launcher.</small></span></label>
          <label class="block text-sm font-semibold">Availability override<select v-model="settings.availability_override" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><option value="auto">Use business hours</option><option value="online">Online when an agent is online</option><option value="offline">Always offline</option></select></label>
        </fieldset>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow">
        <h2 class="text-xl font-bold text-gray-900">Business hours</h2><p class="mt-1 text-sm text-gray-500">Manual overrides take priority.</p>
        <fieldset :disabled="!canEdit || saving" class="mt-5 space-y-4 disabled:opacity-60">
          <label class="block max-w-md text-sm font-semibold">Timezone<input v-model="settings.business_timezone" list="chat-timezones" maxlength="64" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><datalist id="chat-timezones"><option v-for="timezone in timezones" :key="timezone" :value="timezone" /></datalist></label>
          <div class="divide-y rounded-xl border border-gray-200">
            <div v-for="([day, label]) in days" :key="day" class="grid gap-3 p-4 md:grid-cols-[110px_1fr_auto] md:items-start">
              <strong class="text-sm">{{ label }}</strong>
              <div class="space-y-2"><p v-if="!settings.weekly_hours[day].length" class="text-sm text-gray-500">Closed</p><div v-for="(slot, index) in settings.weekly_hours[day]" :key="index" class="flex flex-wrap items-center gap-2"><input v-model="slot[0]" type="time" aria-label="Opening time" class="rounded-lg border border-gray-200 p-2"><span class="text-gray-400">to</span><input v-model="slot[1]" type="time" aria-label="Closing time" class="rounded-lg border border-gray-200 p-2"><button type="button" class="text-xs font-semibold text-red-700" @click="removeInterval(day, index)">Remove</button></div></div>
              <button type="button" :disabled="!canAddInterval(day)" class="text-xs font-semibold text-blue-700 disabled:opacity-40" @click="addInterval(day)">Add hours</button>
            </div>
          </div>
        </fieldset>
      </section>

      <section class="grid gap-5 xl:grid-cols-2">
        <div class="rounded-2xl bg-white p-6 shadow"><h2 class="text-xl font-bold text-gray-900">Customer messages</h2><fieldset :disabled="!canEdit || saving" class="mt-5 space-y-4 disabled:opacity-60"><label class="block text-sm font-semibold">Welcome message<textarea v-model="settings.welcome_message" maxlength="500" rows="3" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label><label class="block text-sm font-semibold">Offline message<textarea v-model="settings.offline_message" maxlength="500" rows="3" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label><label class="block text-sm font-semibold">Guest contact<select v-model="settings.guest_contact_rule" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><option value="either">Email or mobile</option><option value="email">Email required</option><option value="mobile">Mobile required</option><option value="both">Email and mobile</option></select></label><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm font-semibold">Send delay<input v-model.number="settings.customer_send_cooldown_seconds" type="number" min="0" max="60" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><small class="text-gray-500">Seconds between sends.</small></label><label class="text-sm font-semibold">Message limit<input v-model.number="settings.max_message_length" type="number" min="100" max="10000" step="100" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><small class="text-gray-500">Characters per message.</small></label></div></fieldset></div>

        <div class="rounded-2xl bg-white p-6 shadow"><h2 class="text-xl font-bold text-gray-900">Attachments</h2><fieldset :disabled="!canEdit || saving" class="mt-5 space-y-4 disabled:opacity-60"><label class="flex items-center gap-3 text-sm font-semibold"><input v-model="settings.attachments_enabled" type="checkbox">Allow attachments</label><div><span class="text-sm font-semibold">File types</span><div class="mt-2 flex flex-wrap gap-3"><label v-for="([mime, label]) in mimeOptions" :key="mime" class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="settings.allowed_attachment_mimes.includes(mime)" @change="toggleMime(mime)">{{ label }}</label></div></div><div class="grid gap-3 sm:grid-cols-2"><label class="text-sm font-semibold">Maximum size<input v-model.number="attachmentMegabytes" type="number" min="0.01" max="5" step="0.25" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><small class="text-gray-500">Megabytes per file.</small></label><label class="text-sm font-semibold">Files per message<input v-model.number="settings.max_attachments_per_message" type="number" min="0" max="5" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"></label></div></fieldset></div>
      </section>

      <section class="rounded-2xl bg-white p-6 shadow"><h2 class="text-xl font-bold text-gray-900">Workflow</h2><fieldset :disabled="!canEdit || saving" class="mt-5 grid gap-4 md:grid-cols-2 disabled:opacity-60"><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.transfers_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">Allow transfers</strong><small class="text-gray-500">Managers can transfer active chats.</small></span></label><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.reopen_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">Allow reopening</strong><small class="text-gray-500">Managers can reopen closed chats.</small></span></label><label class="flex items-start gap-3 rounded-xl border p-4"><input v-model="settings.ticket_conversion_enabled" type="checkbox" class="mt-1"><span><strong class="block text-sm">Allow ticket conversion</strong><small class="text-gray-500">Agents can create linked tickets.</small></span></label><label class="block text-sm font-semibold">Offline intake<select v-model="settings.offline_behavior" class="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal"><option value="conversation">Save an offline conversation</option><option value="ticket" :disabled="!settings.ticket_conversion_enabled">Save and create a linked ticket</option></select></label></fieldset></section>

      <div class="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-lg"><p class="text-sm text-gray-600">Saved changes apply immediately.</p><div class="flex gap-3"><button type="button" :disabled="saving" class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-50" @click="load">Reload</button><button type="button" :disabled="!canEdit || !dirty || saving" class="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40" @click="save">{{ saving ? 'Saving…' : 'Save Live Chat' }}</button></div></div>
    </template>
  </section>
</template>
