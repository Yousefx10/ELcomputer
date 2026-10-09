<template>
  <div class="sms-page space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold">{{ $t('sms.title') }}</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ $t('sms.subtitle') }}</p>
      </div>
      <span class="rounded-lg border px-3 py-2 text-sm">{{ $t(capabilities.enabled ? 'sms.enabled' : 'sms.disabled') }}</span>
    </div>
    <nav class="flex flex-wrap gap-2" :aria-label="$t('sms.title')">
      <NuxtLinkLocale v-for="item in tabs" :key="item.key" :to="`/dashboard/sms?tab=${item.key}`" class="rounded-lg border px-4 py-2 text-sm" :class="tab === item.key ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-white dark:bg-gray-900'" :aria-current="tab === item.key ? 'page' : undefined">{{ $t(`sms.${item.key}`) }}</NuxtLinkLocale>
    </nav>
    <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{{ notice }}</p>
    <p v-if="loading" role="status">{{ $t('sms.loading') }}</p>

    <section v-else-if="tab === 'settings' && can('sms.settings.view')" class="sms-panel">
      <h3 class="text-lg font-semibold">Vodafone Egypt / E’len</h3>
      <p class="mt-2 text-sm">{{ $t(settings.readiness?.ready ? 'sms.ready' : 'sms.incomplete') }}</p>
      <p v-if="!settings.encryption_ready" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ $t('sms.encryptionMissing') }}</p>
      <form class="mt-5 space-y-5" @submit.prevent="saveSettings()">
        <fieldset :disabled="!can('sms.settings.manage') || busy" class="grid gap-4 md:grid-cols-2">
          <label class="sms-field">{{ $t('sms.api_mode') }}<select v-model="settings.api_mode"><option value="production">{{ $t('sms.production') }}</option></select></label>
          <label class="sms-field">{{ $t('sms.port') }}<input v-model.number="settings.port" inputmode="numeric" type="number" min="1" max="65535" /></label>
          <label v-for="field in settingTextFields" :key="field" class="sms-field">{{ $t(`sms.${field}`) }}<input v-model="settings[field]" :dir="field === 'activation_notes' ? undefined : 'ltr'" :maxlength="field === 'activation_notes' ? 1000 : 300" /></label>
          <label class="sms-field">{{ $t('sms.sender_names') }}<textarea v-model="senderNames" rows="3" dir="ltr" maxlength="1000" /><span class="text-xs text-gray-500">{{ $t('sms.onePerLine') }}</span></label>
          <label class="sms-field">{{ $t('sms.default_sender') }}<select v-model="settings.default_sender"><option value="">{{ $t('sms.choose') }}</option><option v-for="sender in approvedSenders" :key="sender">{{ sender }}</option></select></label>
          <label v-for="field in secretFields" :key="field.key" class="sms-field">{{ $t(`sms.${field.key}`) }}<span class="text-xs text-gray-500">{{ $t(settings[field.presence] ? 'sms.configuredMasked' : 'sms.unconfigured') }}</span><input v-model="secrets[field.key]" type="password" autocomplete="new-password" dir="ltr" :maxlength="field.key === 'hash_secret' ? 512 : 1024" :pattern="field.key === 'hash_secret' ? '[0-9A-F]{1,512}' : undefined" :disabled="!settings.encryption_ready" :placeholder="$t('sms.replaceSecret')" /></label>
          <label v-for="field in numericFields" :key="field.key" class="sms-field">{{ $t(`sms.${field.key}`) }}<input v-model.number="settings[field.key]" type="number" :min="field.min" :max="field.max" /></label>
          <label class="sms-field">{{ $t('sms.default_country') }}<select v-model="settings.default_country"><option value="EG">{{ $t('sms.egypt') }}</option><option value="explicit">{{ $t('sms.explicitCountry') }}</option></select></label>
          <label class="sms-check"><input v-model="settings.allow_international" type="checkbox" />{{ $t('sms.allow_international') }}</label>
          <label v-for="field in confirmationFields" :key="field" class="sms-check"><input v-model="settings[field]" type="checkbox" />{{ $t(`sms.${field}`) }}</label>
        </fieldset>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('sms.hashConflict') }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('sms.externalActivation') }}</p>
        <div v-if="can('sms.settings.manage')" class="flex flex-wrap gap-3">
          <button class="sms-primary" :disabled="busy" type="submit">{{ $t('sms.save') }}</button>
          <button class="sms-secondary" type="button" :disabled="busy || !settings.readiness?.ready && !settings.is_enabled" @click="saveSettings({ is_enabled: !settings.is_enabled })">{{ $t(settings.is_enabled ? 'sms.disableProvider' : 'sms.enableProvider') }}</button>
          <span class="self-center text-xs text-gray-500">{{ $t('sms.localValidation') }}</span>
        </div>
      </form>
      <div v-for="group in notificationGroups" :key="group.title" class="mt-8 border-t pt-5" :aria-label="$t(group.title)">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-semibold">{{ $t(group.title) }}</h3>
          <NuxtLinkLocale v-if="can('sms.templates.view')" class="sms-secondary" to="/dashboard/sms?tab=templates">{{ $t('sms.editOrderTemplates') }}</NuxtLinkLocale>
        </div>
        <p class="my-3 text-sm text-gray-500 dark:text-gray-400">{{ $t('sms.orderNoBacklog') }}</p>
        <form v-for="item in group.events" :key="item.event_type" :data-order-event="item.event_type" class="mb-4 rounded-lg border p-4" @submit.prevent="saveOrderEvent(item)">
          <h4 class="mb-3 font-semibold">{{ $t(`sms.orderEventNames.${item.event_type}`) }}</h4>
          <fieldset :disabled="!can('sms.settings.manage') || busy" class="grid gap-3 md:grid-cols-3">
            <label class="sms-check"><input v-model="item.is_enabled" type="checkbox" />{{ $t(item.is_enabled ? 'sms.enabled' : 'sms.disabled') }}</label>
            <label class="sms-field">{{ $t('sms.orderEnglishTemplate') }}<select v-model="item.template_en_id"><option :value="null">{{ $t('sms.choose') }}</option><option v-for="option in orderTemplates" :key="option.id" :value="option.id">{{ option.name }} · {{ $t(option.is_enabled ? 'sms.enabled' : 'sms.disabled') }}</option></select></label>
            <label class="sms-field">{{ $t('sms.orderArabicTemplate') }}<select v-model="item.template_ar_id"><option :value="null">{{ $t('sms.choose') }}</option><option v-for="option in orderTemplates" :key="option.id" :value="option.id">{{ option.name }} · {{ $t(option.is_enabled ? 'sms.enabled' : 'sms.disabled') }}</option></select></label>
          </fieldset>
          <button v-if="can('sms.settings.manage')" class="sms-secondary mt-3" type="submit" :disabled="busy">{{ $t('sms.saveOrderEvent') }}</button>
        </form>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('sms.orderVariables') }}: <span dir="ltr">{{ group.variables.join(', ') }}</span></p>
      </div>
    </section>

    <section v-else-if="tab === 'templates' && can('sms.templates.view')" class="sms-panel">
      <div class="flex flex-wrap items-center justify-between gap-3"><h3 class="text-lg font-semibold">{{ $t('sms.templates') }}</h3><button v-if="can('sms.templates.manage')" class="sms-secondary" @click="newTemplate">{{ $t('sms.newTemplate') }}</button></div>
      <p v-if="!templates.length" class="my-4 text-sm text-gray-500">{{ $t('sms.noTemplates') }}</p>
      <div class="my-4 flex flex-wrap gap-2"><button v-for="item in templates" :key="item.id" class="sms-secondary" @click="editTemplate(item)">{{ item.name }} · {{ $t(`sms.${item.traffic_type}`) }}</button></div>
      <form class="space-y-4" @submit.prevent="saveTemplate">
        <fieldset :disabled="!can('sms.templates.manage') || busy" class="grid gap-4 md:grid-cols-2">
          <label v-for="field in ['code', 'name', 'category']" :key="field" class="sms-field">{{ $t(`sms.${field}`) }}<input v-model="template[field]" required :maxlength="field === 'code' ? 80 : 100" :dir="field === 'code' ? 'ltr' : undefined" /></label>
          <label class="sms-field">{{ $t('sms.trafficType') }}<select v-model="template.traffic_type"><option value="notification">{{ $t('sms.notification') }}</option><option value="campaign">{{ $t('sms.campaign') }}</option></select></label>
          <label class="sms-field">{{ $t('sms.text_en') }}<textarea v-model="template.text_en" dir="ltr" rows="4" maxlength="4000" /></label>
          <label class="sms-field">{{ $t('sms.text_ar') }}<textarea v-model="template.text_ar" dir="rtl" rows="4" maxlength="4000" /></label>
          <label class="sms-field">{{ $t('sms.sender') }}<select v-model="template.sender"><option value="">{{ $t('sms.useDefault') }}</option><option v-for="sender in capabilities.sender_names" :key="sender">{{ sender }}</option></select></label>
          <label class="sms-check"><input v-model="template.is_enabled" type="checkbox" />{{ $t('sms.templateEnabled') }}</label>
        </fieldset>
        <p class="text-sm text-gray-500">{{ $t('sms.variableHelp') }}</p>
        <p v-if="template.variables?.length" class="text-sm" dir="ltr">{{ template.variables.join(', ') }}</p>
        <button v-if="can('sms.templates.manage')" class="sms-primary" :disabled="busy">{{ $t('sms.saveTemplate') }}</button>
      </form>
    </section>

    <section v-else-if="tab === 'send' && canSend" class="sms-panel">
      <h3 class="text-lg font-semibold">{{ $t('sms.send') }}</h3>
      <p v-if="!capabilities.enabled || !capabilities.ready" class="my-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{{ $t('sms.sendingDisabled') }}</p>
      <form class="mt-4 space-y-4" @submit.prevent="sendSms">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="sms-field">{{ $t('sms.trafficType') }}<select v-model="send.trafficType"><option v-if="can('sms.notification.send')" value="notification">{{ $t('sms.notification') }}</option><option v-if="can('sms.campaign.send')" value="campaign">{{ $t('sms.campaign') }}</option></select></label>
          <label class="sms-field">{{ $t('sms.sender') }}<select v-model="send.sender"><option v-for="sender in capabilities.sender_names" :key="sender">{{ sender }}</option></select></label>
          <label class="sms-field md:col-span-2">{{ $t(send.trafficType === 'campaign' ? 'sms.recipientList' : 'sms.recipient') }}<textarea v-model="send.recipients" rows="3" maxlength="8000" dir="ltr" required /><span class="text-xs text-gray-500">{{ $t(send.trafficType === 'campaign' ? 'sms.campaignHint' : 'sms.notificationHint', { count: capabilities.batch_size }) }}</span></label>
          <label v-if="usableTemplates.length" class="sms-field">{{ $t('sms.template') }}<select v-model="send.templateCode"><option value="">{{ $t('sms.freeText') }}</option><option v-for="item in usableTemplates" :key="item.id" :value="item.code">{{ item.name }}</option></select></label>
          <label v-if="send.templateCode" class="sms-field">{{ $t('sms.language') }}<select v-model="send.locale"><option value="en">English</option><option value="ar">العربية</option></select></label>
          <label v-if="send.templateCode" class="sms-field md:col-span-2">{{ $t('sms.variables') }}<textarea v-model="send.variablesJson" rows="3" dir="ltr" maxlength="8000" /></label>
          <label v-else class="sms-field md:col-span-2">{{ $t('sms.message') }}<textarea v-model="send.text" rows="5" maxlength="4000" required /></label>
        </div>
        <div class="rounded-lg border p-4" aria-live="polite">
          <p v-if="preview.error" class="text-sm text-red-700 dark:text-red-300">{{ $t('sms.invalidPreview') }}</p>
          <template v-else>
            <p class="break-words text-sm" dir="ltr">{{ preview.phones.join(', ') }}</p>
            <p v-if="send.templateCode" class="mt-2 whitespace-pre-wrap break-words">{{ preview.text }}</p>
            <div class="mt-3 flex flex-wrap gap-4 text-sm"><span>{{ $t('sms.characters', { count: preview.estimate.characters }) }}</span><span>{{ $t('sms.encoding') }}: {{ $t(`sms.${preview.estimate.encoding}`) }}</span><span>{{ $t('sms.segments', { count: preview.estimate.segments }) }}</span><span>{{ $t('sms.recipientCount', { count: preview.phones.length }) }}</span></div>
          </template>
          <p class="mt-2 text-xs text-gray-500">{{ $t('sms.estimateOnly') }}</p>
        </div>
        <label v-if="send.trafficType === 'campaign'" class="sms-check"><input v-model="send.campaignConfirmed" type="checkbox" />{{ $t('sms.confirmCampaign', { count: recipientList.length }) }}</label>
        <div class="flex flex-wrap gap-3"><button class="sms-primary" :disabled="busy || !capabilities.enabled || !capabilities.ready || preview.error || !preview.text?.trim() || !recipientList.length || send.trafficType === 'campaign' && !send.campaignConfirmed || Boolean(sent)">{{ $t('sms.queueSms') }}</button><button v-if="sent" type="button" class="sms-secondary" @click="resetSend">{{ $t('sms.newMessage') }}</button></div>
        <p v-if="sent" class="break-all text-sm" dir="ltr">{{ sent.external_trx_id }}</p>
      </form>
    </section>

    <section v-else-if="tab === 'history' && can('sms.history.view')" class="sms-panel">
      <div class="mb-4 flex items-center justify-between"><h3 class="text-lg font-semibold">{{ $t('sms.history') }}</h3><button class="sms-secondary" @click="loadTab">{{ $t('sms.refresh') }}</button></div>
      <p class="mb-4 text-sm text-gray-500">{{ $t('sms.submissionOnly') }}</p>
      <h4 v-if="history.orderEvents.length" class="mb-3 font-semibold">{{ $t('sms.automatedNotifications') }}</h4>
      <details v-for="item in history.orderEvents" :key="item.id" class="mb-3 rounded-lg border p-3" data-order-history>
        <summary class="cursor-pointer text-sm">{{ item.order_number || '—' }} · {{ $t(`sms.orderEventNames.${item.event_type}`) }} · {{ $t(`sms.statuses.${item.sms_batches?.status || item.status}`) }}</summary>
        <p v-if="item.reason" class="mt-3 text-sm">{{ $t(`sms.orderReasons.${item.reason}`) }}</p>
        <dl class="my-3 grid gap-3 text-sm md:grid-cols-2">
          <div><dt class="text-gray-500">{{ $t('sms.recipient') }}</dt><dd dir="ltr">{{ item.recipient_masked || '—' }}</dd></div>
          <div><dt class="text-gray-500">{{ $t('sms.language') }}</dt><dd>{{ item.locale === 'ar' ? 'العربية' : 'English' }}</dd></div>
          <div><dt class="text-gray-500">{{ $t('sms.template') }}</dt><dd>{{ templates.find(template => template.id === item.template_id)?.name || item.template_id || '—' }}</dd></div>
          <div><dt class="text-gray-500">{{ $t('sms.sender') }}</dt><dd>{{ item.sender || '—' }} · {{ $t('sms.notification') }}</dd></div>
          <div v-if="item.shipment_awb"><dt class="text-gray-500">{{ $t('sms.pdcAwb') }}</dt><dd class="break-all" dir="ltr">{{ item.shipment_awb }}</dd></div>
          <div v-if="item.provider_event_at"><dt class="text-gray-500">{{ $t('sms.pdcEventTime') }}</dt><dd>{{ date(item.provider_event_at) }}</dd></div>
          <div><dt class="text-gray-500">ExternalTrxId</dt><dd class="break-all" dir="ltr">{{ item.sms_batches?.external_trx_id || '—' }}</dd></div>
          <div><dt class="text-gray-500">{{ $t('sms.createdAt') }}</dt><dd>{{ date(item.created_at) }}</dd></div>
        </dl>
        <p v-if="item.sms_batches?.failure_category || item.sms_batches?.error_code" class="text-sm">{{ diagnostic(item.sms_batches) }}</p>
        <p v-for="(message, index) in item.sms_batches?.sms_messages || []" :key="index" class="mt-2 text-sm">{{ $t(`sms.${message.encoding}`) }} · {{ $t('sms.units', { count: message.units }) }} · {{ $t('sms.segments', { count: message.segments }) }} · {{ message.provider_status || '—' }} · {{ message.error_code || '—' }}</p>
      </details>
      <p v-if="!history.batches.length && !history.orderEvents.length" class="text-sm">{{ $t('sms.noHistory') }}</p>
      <details v-for="batch in history.batches" :key="batch.id" class="mb-3 rounded-lg border p-3">
        <summary class="cursor-pointer text-sm"><span>{{ $t(`sms.${batch.traffic_type}`) }} · {{ $t(`sms.statuses.${batch.status}`) }}</span><span class="ms-3">{{ date(batch.created_at) }}</span><span class="ms-3">{{ $t('sms.attempts', { count: batch.attempts }) }}</span></summary>
        <dl class="my-3 grid gap-3 text-sm md:grid-cols-2"><div><dt class="text-gray-500">{{ $t('sms.trigger') }}</dt><dd class="break-all">{{ batch.trigger_source }} · {{ batch.triggered_by || '—' }}</dd></div><div><dt class="text-gray-500">ExternalTrxId</dt><dd class="break-all" dir="ltr">{{ batch.external_trx_id }}</dd></div><div><dt class="text-gray-500">{{ $t('sms.template') }}</dt><dd class="break-all">{{ batch.template_id || '—' }}</dd></div><div><dt class="text-gray-500">{{ $t('sms.submittedAt') }}</dt><dd>{{ date(batch.submitted_at) }}</dd></div></dl>
        <p v-if="batch.error_code || batch.failure_category" class="mb-3 text-sm">{{ diagnostic(batch) }}</p>
        <div class="overflow-x-auto"><table class="w-full text-start text-sm"><thead><tr><th>{{ $t('sms.recipient') }}</th><th>{{ $t('sms.sender') }}</th><th>{{ $t('sms.status') }}</th><th>{{ $t('sms.providerStatus') }}</th><th>{{ $t('sms.errorCode') }}</th></tr></thead><tbody><tr v-for="message in batch.sms_messages" :key="message.id"><td dir="ltr">{{ message.recipient }}</td><td>{{ message.sender }}</td><td>{{ $t(`sms.statuses.${message.status}`) }}</td><td dir="ltr">{{ message.provider_status || '—' }}</td><td>{{ message.error_code || '—' }}</td></tr></tbody></table></div>
        <p v-for="attempt in batch.sms_attempts" :key="attempt.attempt_number" class="mt-3 text-xs">{{ $t('sms.attempts', { count: attempt.attempt_number }) }} · {{ $t(`sms.statuses.${attempt.status}`) }} · {{ date(attempt.started_at) }} · {{ diagnostic(attempt) }}</p>
      </details>
      <div class="mt-4 flex gap-3"><button class="sms-secondary" :disabled="history.page <= 1" @click="history.page--; loadTab()">{{ $t('sms.previous') }}</button><button class="sms-secondary" :disabled="history.page * 25 >= Math.max(history.total, history.orderTotal)" @click="history.page++; loadTab()">{{ $t('sms.next') }}</button></div>
    </section>
    <p v-else>{{ $t('sms.noAccess') }}</p>
  </div>
</template>

<script setup>
import { estimateSmsSegments, normalizeSmsPhone, renderSmsTemplate } from '~/utils/sms.js'
import { claimCommunicationTemplateDraft } from '~/utils/claimCommunications.js'
import { orderSmsVariables, orderSmsEvents, pdcSmsEvents, pdcSmsVariables } from '~/utils/orderSms.js'
definePageMeta({ layout: 'dashboard' })
const { t, locale, te } = useI18n()
const { uiMessage } = useUiLocale()
const route = useUiRoute()
const { hasPermission: can } = useAdminAccess()
const client = useSupportClient()
const loading = ref(true), busy = ref(false), error = ref(''), notice = ref('')
const capabilities = ref({ enabled: false, ready: false, sender_names: [], default_sender: '', batch_size: 50, default_country: 'EG', allow_international: false })
const settings = ref({}), senderNames = ref(''), secrets = reactive({ account_id: '', password: '', hash_secret: '' })
const templates = ref([]), orderEvents = ref([]), history = reactive({ page: 1, total: 0, batches: [], orderTotal: 0, orderEvents: [] })
const notificationGroups = computed(() => [
  { title: 'sms.orderNotifications', events: orderEvents.value.filter(item => orderSmsEvents.includes(item.event_type)), variables: orderSmsVariables },
  { title: 'sms.pdcNotifications', events: orderEvents.value.filter(item => pdcSmsEvents.includes(item.event_type)), variables: pdcSmsVariables }
])
const orderTemplates = computed(() => templates.value.filter(item => item.traffic_type === 'notification'))
const blankTemplate = () => claimCommunicationTemplateDraft(String(route.query.claimPurpose||''),'sms')||({ code: '', name: '', category: 'manual', text_en: '', text_ar: '', traffic_type: 'notification', sender: '', is_enabled: false, variables: [] })
const template = ref(blankTemplate())
const send = reactive({ trafficType: can('sms.notification.send') ? 'notification' : 'campaign', recipients: '', sender: '', text: '', templateCode: '', locale: locale.value, variablesJson: '{}', campaignConfirmed: false })
const requestKey = ref(''), sent = ref(null)
const settingTextFields = ['base_url', 'notification_path', 'campaign_path', 'expected_outbound_ip', 'activation_notes']
const secretFields = [{ key: 'account_id', presence: 'account_id_configured' }, { key: 'password', presence: 'password_configured' }, { key: 'hash_secret', presence: 'hash_secret_configured' }]
const numericFields = [{ key: 'timeout_ms', min: 1000, max: 30000 }, { key: 'preflight_retry_limit', min: 0, max: 3 }, { key: 'batch_size', min: 1, max: 200 }, { key: 'request_interval_ms', min: 500, max: 60000 }]
const confirmationFields = ['trusted_ip_confirmed', 'activation_confirmed', 'hash_protocol_confirmed']
const canSend = computed(() => can('sms.notification.send') || can('sms.campaign.send'))
const tabs = computed(() => [
  { key: 'settings', allowed: can('sms.settings.view') }, { key: 'templates', allowed: can('sms.templates.view') },
  { key: 'send', allowed: canSend.value }, { key: 'history', allowed: can('sms.history.view') }
].filter(item => item.allowed))
const tab = computed(() => String(route.query.tab || 'settings'))
const approvedSenders = computed(() => senderNames.value.split(/\r?\n/).map(name => name.trim()).filter(Boolean))
const usableTemplates = computed(() => templates.value.filter(item => item.is_enabled && item.traffic_type === send.trafficType))
const recipientList = computed(() => send.trafficType === 'campaign' ? send.recipients.split(/[\r\n,;]+/).map(phone => phone.trim()).filter(Boolean) : send.recipients.trim() ? [send.recipients.trim()] : [])
const preview = computed(() => {
  try {
    if (recipientList.value.length > capabilities.value.batch_size || send.trafficType === 'notification' && recipientList.value.length > 1) throw Error()
    const phones = recipientList.value.map(value => normalizeSmsPhone(value, { defaultCountry: capabilities.value.default_country, allowInternational: capabilities.value.allow_international }))
    if (new Set(phones).size !== phones.length) throw Error()
    const selected = templates.value.find(item => item.code === send.templateCode)
    const text = send.templateCode ? renderSmsTemplate(selected?.[send.locale === 'ar' ? 'text_ar' : 'text_en'] || '', JSON.parse(send.variablesJson)) : send.text
    if (send.templateCode && !text) throw Error()
    return { phones, text, estimate: estimateSmsSegments(text), error: false }
  } catch { return { error: true } }
})
const report = failure => { error.value = uiMessage(client.errorText(failure, t('sms.failed'))) }
const date = value => value ? new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const diagnostic = item => `${item.error_code || ''} ${item.failure_category && te('sms.categories.' + item.failure_category) ? t('sms.categories.' + item.failure_category) : item.failure_category || ''}`.trim()
let loadVersion = 0
const loadTab = async () => {
  const version = ++loadVersion
  loading.value = true; error.value = ''; notice.value = ''
  try {
    const caps = await client.request('/api/admin-sms/capabilities')
    if (version !== loadVersion) return
    capabilities.value = caps
    if (!send.sender) send.sender = caps.default_sender
    if (can('sms.templates.view')) {
      const result = await client.request('/api/admin-sms/templates')
      if (version !== loadVersion) return
      templates.value = result.templates
    }
    if (tab.value === 'settings' && can('sms.settings.view')) {
      const result = await client.request('/api/admin-sms/settings')
      if (version !== loadVersion) return
      settings.value = result.settings; senderNames.value = result.settings.sender_names.join('\n')
      const events = await client.request('/api/admin-sms/order-events')
      if (version !== loadVersion) return
      orderEvents.value = events.events
    }
    if (tab.value === 'history' && can('sms.history.view')) {
      const result = await client.request('/api/admin-sms/history', { query: { page: history.page } })
      if (version !== loadVersion) return
      Object.assign(history, result)
    }
  } catch (failure) { if (version === loadVersion) report(failure) }
  finally { if (version === loadVersion) loading.value = false }
}
const saveSettings = async (overrides = {}) => {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const result = await client.request('/api/admin-sms/settings', { method: 'PATCH', body: { ...settings.value, ...secrets, sender_names: approvedSenders.value, port: settings.value.port === '' ? null : settings.value.port, ...overrides } })
    settings.value = result.settings
    capabilities.value.enabled = result.settings.is_enabled; capabilities.value.ready = result.settings.readiness.ready
    for (const key of Object.keys(secrets)) secrets[key] = ''
    notice.value = t('sms.saved')
  } catch (failure) { report(failure) }
  finally { busy.value = false }
}
const newTemplate = () => { template.value = blankTemplate() }
const saveOrderEvent = async item => {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const result = await client.request('/api/admin-sms/order-events', { method: 'PATCH', body: { ...item } })
    Object.assign(item, result.event); notice.value = t('sms.saved')
  } catch (failure) { report(failure) }
  finally { busy.value = false }
}
const editTemplate = item => { template.value = { ...item } }
const saveTemplate = async () => {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const result = await client.request('/api/admin-sms/templates', { method: 'POST', body: template.value })
    const index = templates.value.findIndex(item => item.id === result.template.id)
    if (index < 0) templates.value.push(result.template); else templates.value[index] = result.template
    template.value = result.template; notice.value = t('sms.saved')
  } catch (failure) { report(failure) }
  finally { busy.value = false }
}
const resetSend = () => { sent.value = null; requestKey.value = crypto.randomUUID(); notice.value = ''; send.campaignConfirmed = false }
const sendSms = async () => {
  if (preview.value.error || !capabilities.value.enabled || !capabilities.value.ready || sent.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    if (!requestKey.value) requestKey.value = crypto.randomUUID()
    sent.value = await client.request('/api/admin-sms/send', { method: 'POST', body: { trafficType: send.trafficType, recipients: recipientList.value,
      text: send.text, sender: send.sender, templateCode: send.templateCode || undefined, locale: send.locale,
      variables: send.templateCode ? JSON.parse(send.variablesJson) : undefined, campaignConfirmed: send.campaignConfirmed, idempotencyKey: requestKey.value } })
    notice.value = t('sms.queuedNotice')
  } catch (failure) { report(failure) }
  finally { busy.value = false }
}
watch(() => [send.trafficType, send.recipients, send.text, send.sender, send.templateCode, send.locale, send.variablesJson], () => { if (!busy.value) { sent.value = null; requestKey.value = ''; send.campaignConfirmed = false } })
watch(() => send.trafficType, () => { send.templateCode = '' })
watch(tab, loadTab)
onMounted(loadTab)
</script>

<style scoped>
.sms-panel { border-radius: 1rem; padding: 1.5rem; background: #fff; border: 1px solid #e5e7eb; }
.sms-field { display: flex; flex-direction: column; gap: .5rem; font-size: .875rem; min-width: 0; }
.sms-field input, .sms-field textarea, .sms-field select { width: 100%; border: 1px solid #d1d5db; border-radius: .5rem; padding: .65rem; background: transparent; }
.sms-check { display: flex; align-items: center; gap: .6rem; font-size: .875rem; }
.sms-check input { width: 1.1rem; height: 1.1rem; }
.sms-primary, .sms-secondary { min-height: 44px; border-radius: .5rem; padding: .6rem 1rem; font-size: .875rem; }
.sms-primary { background: #111827; color: white; }
.sms-secondary { border: 1px solid #d1d5db; }
button:disabled, fieldset:disabled { opacity: .55; }
button:disabled { cursor: not-allowed; }
th, td { padding: .65rem; text-align: start; white-space: nowrap; border-bottom: 1px solid #e5e7eb; }
:global(.dark .sms-page .sms-panel) { background: #111827; border-color: #374151; }
:global(.dark .sms-page .sms-field input), :global(.dark .sms-page .sms-field textarea), :global(.dark .sms-page .sms-field select) { border-color: #4b5563; color: #f3f4f6; background: #111827; }
:global(.dark .sms-page .sms-primary) { background: #f3f4f6; color: #111827; }
:global(.dark .sms-page th), :global(.dark .sms-page td) { border-color: #374151; }
@media (max-width: 480px) { .sms-panel { padding: 1rem; } }
</style>
