<script setup>
import { claimDate, claimErrorKey } from '~/utils/afterSalesClaims.js'
const props = defineProps({ id: { type: String, required: true }, staff: Boolean })
const { t, locale } = useI18n(), { intlLocale } = useUiLocale(), { request, downloadFrom } = useSupportClient()
const access = props.staff ? useAdminAccess() : null
const detail = ref(null), loading = ref(true), saving = ref(false), uploading = ref(false), error = ref(''), notice = ref(''), files = ref([]), picker = ref(null)
const staffAction = ref(''), actionText = ref(''), resolution = ref(''), requireEvidence = ref(false), responseText = ref(''), cancellation = ref(false)
const api = props.staff ? '/api/admin-after-sales/claims' : '/api/account/after-sales/claims'
const path = props.staff ? '/dashboard/after-sales' : '/account/after-sales'
const claim = computed(() => detail.value?.claim)
const pending = computed(() => detail.value?.information?.find(row => !row.response_at))
const canCancel = computed(() => !props.staff && detail.value?.customer_can_cancel !== false && ['submitted', 'under_review', 'more_information_required', 'approved'].includes(claim.value?.status))
const canSeeEvidence = computed(() => !props.staff || access?.hasPermission('claims.evidence'))
let generation = 0
const load = async () => {
  const version = ++generation; loading.value = true
  try {
    const result = await request(`${api}/${props.id}`)
    if (version !== generation) return
    detail.value = result
    if (!result.allowed_actions.includes(staffAction.value)) staffAction.value = result.allowed_actions.find(action => action !== 'note') || result.allowed_actions[0] || ''
  } catch (cause) { if (version === generation) { detail.value = null; error.value = t(claimErrorKey(cause)) } }
  finally { if (version === generation) loading.value = false }
}
const older = async () => {
  loading.value = true
  try {
    const result = await request(`${api}/${props.id}`, { query: { before: detail.value.events.at(-1).id } })
    detail.value.events.push(...result.events); detail.value.has_more_events = result.has_more_events
  } catch (cause) { error.value = t(claimErrorKey(cause)) }
  finally { loading.value = false }
}
const perform = async (action, extra = {}) => {
  saving.value = true; error.value = ''; notice.value = ''
  try {
    await request(`${api}/${props.id}/actions`, { method: 'POST', body: { action, revision: claim.value.revision, ...extra } })
    actionText.value = ''; responseText.value = ''; cancellation.value = false; files.value = []; notice.value = t('claims.saved'); await load()
  } catch (cause) { error.value = t(claimErrorKey(cause)); if (cause.statusCode === 409 || cause?.data?.statusCode === 409) await load() }
  finally { saving.value = false }
}
const staffSubmit = () => perform(staffAction.value, { text: actionText.value,
  ...(staffAction.value === 'select_resolution' ? { resolution: resolution.value } : {}),
  ...(staffAction.value === 'request_information' ? { require_evidence: requireEvidence.value } : {}) })
const customerSubmit = () => perform(cancellation.value ? 'cancel' : 'respond', { text: responseText.value, attachment_ids: cancellation.value ? [] : files.value.map(file => file.id) })
const download = async file => { try { await downloadFrom(`${api.replace(/\/claims$/, '')}/${props.staff ? 'claims/' : ''}evidence/${file.id}`, file.original_name) } catch (cause) { error.value = t(claimErrorKey(cause)) } }
onMounted(load)
watch(() => props.id, load)
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <div data-claim-detail class="mx-auto max-w-6xl space-y-5 text-slate-900">
    <NuxtLinkLocale :to="path" class="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700"><Icon name="lucide:arrow-left" size="16" class="directional-icon" />{{ $t('claims.back') }}</NuxtLinkLocale>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p><p v-if="notice" role="status" class="rounded-xl bg-green-50 p-4 text-sm text-green-800">{{ notice }}</p>
    <p v-if="loading && !claim" role="status" class="p-6 text-sm text-slate-600">{{ $t('claims.loading') }}</p>
    <template v-if="claim">
      <header class="rounded-2xl border border-slate-200 bg-white p-5"><div class="flex flex-wrap items-start justify-between gap-4"><div class="min-w-0"><p class="break-all text-sm font-bold text-blue-700">{{ claim.reference }}</p><h1 class="mt-2 text-2xl font-bold">{{ $t(`claims.types.${claim.claim_type}`) }}</h1><p class="mt-2 text-xs text-slate-600">{{ claimDate(claim.created_at, intlLocale) }} · {{ detail.order.order_number }}</p></div><span class="rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">{{ $t(`claims.statuses.${claim.status}`) }}</span></div><button type="button" :disabled="loading" class="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold" @click="load">{{ $t('claims.refresh') }}</button></header>
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div class="min-w-0 space-y-5">
          <section class="rounded-2xl border border-slate-200 bg-white p-5"><h2 class="text-lg font-bold">{{ $t('claims.purchase') }}</h2><p class="mt-3 break-words font-semibold">{{ detail.item.product_title }}</p><p class="mt-1 text-sm text-slate-600">{{ detail.item.variant_name }} <span v-if="detail.item.variant_sku">· {{ detail.item.variant_sku }}</span></p><p class="mt-1 text-sm text-slate-600">{{ $t('claims.claimedQuantity') }}: {{ claim.quantity }} / {{ detail.item.quantity }}</p><AccountItemWarranty :item="{ ...detail.item, after_sales: claim.claim_type === 'warranty' && claim.eligibility_snapshot ? { warranty: claim.eligibility_snapshot.eligibility } : null }" /><p class="mt-4 whitespace-pre-wrap break-words text-sm">{{ claim.description }}</p><dl v-if="claim.claim_type === 'return'" class="mt-3 space-y-1 text-sm text-slate-700"><div>{{ $t('claims.reason') }}: {{ detail.return_reason?.[locale === 'ar' ? 'label_ar' : 'label_en'] || claim.reason_key }}</div><div>{{ $t('claims.opened') }}: {{ $t(claim.declarations.opened ? 'claims.yes' : 'claims.no') }}</div><div>{{ $t('claims.packaging') }}: {{ $t(claim.declarations.packaging ? 'claims.yes' : 'claims.no') }}</div></dl><p v-if="detail.purchased_serials.length" class="mt-3 break-all text-sm">{{ $t('claims.purchasedSerial') }}: {{ detail.purchased_serials.join(', ') }}</p><p v-if="claim.customer_serials.length" class="mt-3 break-all text-sm">{{ $t('claims.serial') }}: {{ claim.customer_serials.join(', ') }} · {{ $t(`claims.serialStates.${claim.serial_verification}`) }}</p></section>
          <section class="rounded-2xl border border-slate-200 bg-white p-5"><h2 class="text-lg font-bold">{{ $t('claims.evidence') }}</h2><p v-if="!canSeeEvidence" class="mt-3 text-sm text-slate-600">{{ $t('claims.evidenceRestricted') }}</p><ul v-else-if="detail.attachments.length" class="mt-3 space-y-2"><li v-for="file in detail.attachments" :key="file.id"><button type="button" class="min-h-10 break-all text-start text-sm font-semibold text-blue-700" @click="download(file)">{{ file.original_name }} · {{ $t('claims.download') }}</button></li></ul><p v-else class="mt-3 text-sm text-slate-600">{{ $t('claims.noEvidence') }}</p></section>
          <section v-if="!staff && (claim.status === 'more_information_required' || cancellation)" class="rounded-2xl border border-blue-200 bg-white p-5">
            <h2 class="text-lg font-bold">{{ $t(cancellation ? 'claims.cancelClaim' : 'claims.moreInformation') }}</h2><p v-if="!cancellation && pending" class="mt-3 whitespace-pre-wrap break-words text-sm">{{ pending.prompt }}</p>
            <form class="mt-4 space-y-4" @submit.prevent="customerSubmit"><label class="block text-sm font-semibold">{{ $t(cancellation ? 'claims.cancellationReason' : 'claims.yourResponse') }}<textarea v-model="responseText" required maxlength="4000" rows="4" class="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900"></textarea></label><AfterSalesEvidencePicker v-if="!cancellation && pending" ref="picker" :key="pending.id" v-model="files" :item-id="detail.item.id" :claim-type="claim.claim_type" :claim-id="claim.id" :mode="detail.evidence" :required="pending.require_evidence" @busy="uploading = $event" /><button type="submit" :disabled="saving || uploading || (!cancellation && pending?.require_evidence && !files.length)" class="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">{{ $t(cancellation ? 'claims.confirmCancellation' : 'claims.sendResponse') }}</button><button v-if="cancellation" type="button" class="ms-3 min-h-11 px-3 text-sm font-semibold" @click="cancellation = false">{{ $t('claims.close') }}</button></form>
          </section>
          <AfterSalesReverseLogistics :key="`${claim.id}-${claim.revision}`" :claim="claim" :staff="staff" @changed="load" />
          <AfterSalesTimeline :events="detail.events" :more="detail.has_more_events" :loading="loading" @older="older" />
        </div>
        <aside class="min-w-0 space-y-5">
          <section v-if="staff && detail.customer" class="rounded-2xl border border-slate-200 bg-white p-5"><h2 class="font-bold">{{ $t('claims.customer') }}</h2><p class="mt-3 text-sm">{{ detail.customer.name }}</p><p class="mt-1 break-all text-sm text-slate-600">{{ detail.customer.email }}</p><p class="mt-1 text-sm text-slate-600">{{ detail.customer.phone }}</p></section>
          <section v-if="claim.resolution || claim.decision_text" class="rounded-2xl border border-slate-200 bg-white p-5"><h2 class="font-bold">{{ $t('claims.decision') }}</h2><p v-if="claim.decision_text" class="mt-3 whitespace-pre-wrap break-words text-sm">{{ claim.decision_text }}</p><p v-if="claim.resolution" class="mt-3 text-sm font-semibold">{{ $t(`claims.resolutions.${claim.resolution}`) }}</p><p v-if="claim.resolution_text" class="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{{ claim.resolution_text }}</p><p v-if="claim.resolution === 'refund'" class="mt-3 text-xs text-slate-600">{{ $t('claims.refundNotice') }}</p></section>
          <section v-if="staff" class="rounded-2xl border border-slate-200 bg-white p-5"><h2 class="font-bold">{{ $t('claims.staffActions') }}</h2><p v-if="!detail.allowed_actions.length" class="mt-3 text-sm text-slate-600">{{ $t('claims.readOnly') }}</p><form v-else class="mt-4 space-y-4" @submit.prevent="staffSubmit"><label class="block text-xs font-semibold">{{ $t('claims.action') }}<select v-model="staffAction" data-claim-action class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option v-for="action in detail.allowed_actions" :key="action" :value="action">{{ $t(`claims.actions.${action}`) }}</option></select></label><label class="block text-xs font-semibold">{{ $t(staffAction === 'note' || staffAction === 'verify_serial' ? 'claims.internalNote' : 'claims.customerMessage') }}<textarea v-model="actionText" :required="!['review','inspect'].includes(staffAction)" maxlength="4000" rows="4" class="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"></textarea></label><label v-if="staffAction === 'request_information' && detail.evidence !== 'disabled'" class="flex gap-2 text-sm"><input v-model="requireEvidence" type="checkbox">{{ $t('claims.requestEvidence') }}</label><label v-if="staffAction === 'select_resolution'" class="block text-xs font-semibold">{{ $t('claims.resolution') }}<select v-model="resolution" required data-claim-resolution class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">{{ $t('claims.choose') }}</option><option v-for="choice in detail.allowed_resolutions" :key="choice" :value="choice">{{ $t(`claims.resolutions.${choice}`) }}</option></select></label><p v-if="staffAction === 'receive'" class="text-xs text-slate-600">{{ $t('claims.manualReceipt') }}</p><p v-if="staffAction === 'verify_serial'" class="text-xs text-slate-600">{{ $t('claims.verifyNotice') }}</p><button type="submit" :disabled="saving" class="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-50">{{ $t(saving ? 'claims.saving' : 'claims.saveAction') }}</button></form></section>
          <section v-if="staff && claim.eligibility_snapshot" class="rounded-2xl border border-slate-200 bg-white p-5"><h2 class="font-bold">{{ $t('claims.purchasedPolicy') }}</h2><dl class="mt-3 space-y-3 text-xs"><div><dt class="text-slate-500">{{ $t('claims.policyReference') }}</dt><dd class="break-all">{{ claim.policy_version_id }}</dd></div><div><dt class="text-slate-500">{{ $t('claims.policyRevision') }}</dt><dd class="break-all">{{ detail.provenance?.version_key }}</dd></div><div><dt class="text-slate-500">{{ $t('claims.admission') }}</dt><dd>{{ $t(`claims.admissions.${claim.admission}`) }}</dd></div><div><dt class="text-slate-500">{{ $t('claims.evaluatedAt') }}</dt><dd>{{ claimDate(claim.eligibility_snapshot.evaluated_at, intlLocale) }}</dd></div><div v-if="claim.eligibility_snapshot.eligibility.period?.start_date"><dt class="text-slate-500">{{ $t('claims.startDate') }}</dt><dd>{{ claim.eligibility_snapshot.eligibility.period.start_date }}</dd></div><div v-if="claim.eligibility_snapshot.eligibility.period?.expiry_date"><dt class="text-slate-500">{{ $t('claims.expiryDate') }}</dt><dd>{{ claim.eligibility_snapshot.eligibility.period.expiry_date }}</dd></div><div v-for="key in ['delivery_date','payment_date','invoice_date']" :key="key"><dt class="text-slate-500">{{ $t(`claims.dateBases.${key}`) }}</dt><dd>{{ claimDate(detail.dates?.[key], intlLocale) }}</dd></div></dl></section>
          <button v-if="canCancel && !cancellation" type="button" class="min-h-11 w-full rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700" @click="cancellation = true">{{ $t('claims.cancelClaim') }}</button>
        </aside>
      </div>
    </template>
  </div>
</template>
