<template>
  <div class="setup-page">
    <header class="setup-header">
      <div><p class="setup-eyebrow">{{ t('ownerGuide') }}</p><h1>{{ t('title') }}</h1><p class="setup-subtitle">{{ t('subtitle') }}</p></div>
      <button v-if="isOwner && isActiveAdmin" type="button" class="setup-button" :disabled="loading || saving" @click="refreshStatus"><Icon name="lucide:refresh-cw" aria-hidden="true" />{{ t('refresh') }}</button>
    </header>
    <p v-if="!isOwner || !isActiveAdmin" role="alert" class="setup-alert">{{ t('ownerOnly') }}</p>
    <template v-else>
      <p v-if="error" role="alert" class="setup-alert">{{ t('loadError') }}</p>
      <p v-if="mutationError" role="alert" class="setup-alert">{{ t(mutationError) }}</p>
      <p v-if="saving" role="status" class="setup-loading">{{ t('saving') }}</p>
      <p v-if="loading" role="status" class="setup-loading">{{ t('loading') }}</p>
      <template v-else-if="status">
        <p v-if="!status.setup?.available" role="status" class="setup-metadata-notice">{{ t('persistenceUnavailable') }}</p>
        <section class="setup-summary" :aria-label="t('progressTitle')">
          <div class="setup-progress-copy"><span class="setup-eyebrow">{{ t('progressTitle') }}</span><strong>{{ t('progressCount', status.progress) }}</strong><p>{{ t('progressHint') }}</p></div>
          <div class="setup-progress"><div class="setup-progress-heading"><span>{{ t('configurationProgress') }}</span><strong>{{ status.progress.percent }}%</strong></div><div role="progressbar" :aria-label="t('configurationProgress')" :aria-valuenow="status.progress.percent" aria-valuemin="0" aria-valuemax="100" class="setup-track"><span :style="{ width: status.progress.percent + '%' }" /></div><p>{{ t('selectionHint') }}</p></div>
          <div class="setup-acceptance"><Icon name="lucide:clipboard-list" aria-hidden="true" /><div><strong>{{ t('acceptanceOutstanding') }}</strong><p>{{ t('acceptanceHint') }}</p><p v-if="status.setup?.available">{{ t('ownerReviewCount', status.setup.ownerReviewProgress) }}</p></div></div>
        </section>
        <p v-if="status.setup?.available" class="setup-evidence-summary">{{ t('verificationCount', status.setup.verificationProgress) }} {{ t('verificationCountHint') }}</p>
        <div class="setup-workspace">
          <nav class="setup-steps" :aria-label="t('steps')">
            <button v-for="(section, index) in setupSections" :key="section.id" type="button" :aria-current="active.id === section.id ? 'step' : undefined" :class="{ 'is-current': active.id === section.id }" @click="selectStep(index)">
              <span class="setup-step-number">{{ index + 1 }}</span><span><strong>{{ t('sections.' + section.id) }}</strong><small>{{ sectionProgress(section) }}</small></span><Icon :name="'lucide:' + section.icon" aria-hidden="true" />
            </button>
          </nav>
          <section class="setup-content" :aria-labelledby="'setup-section-title'">
            <header class="setup-section-header"><p class="setup-eyebrow">{{ t('stepOf', { current: step + 1, total: setupSections.length }) }}</p><h2 id="setup-section-title" ref="sectionTitle" tabindex="-1">{{ t('sections.' + active.id) }}</h2><p>{{ t('sectionHints.' + active.id) }}</p></header>
            <div v-if="active.id !== 'readiness'" class="setup-cards">
              <article v-for="entry in activeItems" :key="entry.id" class="setup-card" :data-setup-item="entry.id">
                <header class="setup-card-header"><div><h3>{{ t('items.' + entry.id) }}</h3><span class="setup-requirement">{{ t(entry.required ? 'required' : 'optional') }}</span></div><span class="setup-badge" :data-state="entry.configuration">{{ t('states.' + entry.configuration) }}</span></header>
                <div v-if="choiceFor(entry.id)" class="setup-choice"><label><input type="checkbox" data-setup-selection :data-integration="choiceFor(entry.id).key" :checked="choiceFor(entry.id).selected || choiceFor(entry.id).inUse === true" :disabled="!!saving || choiceFor(entry.id).inUse !== false" @change="saveSetup({ action: 'selection', key: choiceFor(entry.id).key, selected: $event.target.checked })"><span>{{ t('includeIntegration') }}</span></label><p>{{ t(choiceFor(entry.id).inUse === true ? 'integrationInUse' : choiceFor(entry.id).inUse === null ? 'integrationUsageUnknown' : 'selectionDoesNotEnable') }}</p></div>
                <dl class="setup-facts">
                  <template v-if="entry.credentialsSaved !== null"><dt>{{ t('credentials') }}</dt><dd>{{ t(entry.credentialsSaved ? 'saved' : 'notSaved') }}</dd></template>
                  <template v-if="entry.connection !== 'not_applicable'"><dt>{{ t('connection') }}</dt><dd :data-state="entry.connection">{{ t('states.' + entry.connection) }}</dd></template>
                  <template v-if="entry.enabled !== null"><dt>{{ t(entry.id === 'daftra' ? 'erpOwnership' : 'providerState') }}</dt><dd>{{ t(entry.id === 'daftra' ? entry.enabled ? 'daftraActive' : 'builtInActive' : entry.enabled ? 'enabled' : 'disabled') }}</dd></template>
                  <template v-if="entry.lastCheckedAt"><dt>{{ t('lastConnectionCheck') }}</dt><dd>{{ date(entry.lastCheckedAt) }}</dd></template>
                </dl>
                <ul class="setup-checks"><li v-for="check in entry.checks" :key="check.id"><Icon :name="check.state === 'complete' ? 'lucide:circle-check' : check.state === 'incomplete' ? 'lucide:circle-alert' : 'lucide:circle-help'" :class="'check-' + check.state" aria-hidden="true" /><span>{{ t('checks.' + check.id) }}<small v-if="check.managedBy === 'operator'">{{ t('operatorManaged') }}</small></span><span class="setup-check-state">{{ t('states.' + check.state) }}</span></li></ul>
                <p v-for="note in entry.notes" :key="note" class="setup-note">{{ t('notes.' + note) }}</p>
                <p class="setup-verification"><Icon name="lucide:clipboard-list" aria-hidden="true" />{{ t('operationalUnverified') }}</p>
                <div v-if="entry.evidence" class="setup-evidence" :data-evidence-item="entry.id"><div><strong>{{ t('recordedVerification') }}</strong><span class="setup-badge" :data-state="entry.evidence.state">{{ t('states.' + entry.evidence.state) }}</span></div><p v-if="entry.evidence.checkedAt">{{ t('recordedAt', { time: date(entry.evidence.checkedAt) }) }}</p><p v-if="entry.evidence.source">{{ t('sources.' + entry.evidence.source) }}</p><button type="button" class="setup-link" :disabled="!!saving || !entry.evidence.basisToken" @click="saveSetup({ action: 'capture', key: entry.id, basisToken: entry.evidence.basisToken })">{{ t('saveCurrentCheck') }}</button><p>{{ t('captureHint') }}</p></div>
                <div v-if="setupLinks[entry.id]?.length" class="setup-actions"><NuxtLinkLocale v-for="link in setupLinks[entry.id]" :key="link.to" :to="link.to" class="setup-link">{{ t('links.' + link.label) }}<Icon name="lucide:arrow-up-right" aria-hidden="true" /></NuxtLinkLocale></div>
              </article>
            </div>
            <template v-else>
              <div class="setup-readiness-banner"><Icon name="lucide:clipboard-list" aria-hidden="true" /><div><h3>{{ t('acceptanceOutstanding') }}</h3><p>{{ t('launchHint') }}</p></div></div>
              <article class="setup-card"><h3>{{ t('blockersTitle') }}</h3><p class="setup-note">{{ t('blockersHint') }}</p><ul class="setup-blockers"><li v-for="entry in blockers" :key="entry.id"><div><strong>{{ t('items.' + entry.id) }}</strong><span>{{ t('states.' + entry.configuration) }}</span></div><button type="button" class="setup-link" @click="openItem(entry.id)">{{ t('review') }}<Icon name="lucide:arrow-up-right" aria-hidden="true" /></button></li></ul><p v-if="!blockers.length">{{ t('noConfigurationBlockers') }}</p></article>
              <article class="setup-card"><h3>{{ t('manualAcceptance') }}</h3><p class="setup-note">{{ t('acknowledgementHint') }}</p><ul class="setup-manual"><li v-for="key in acceptanceChecks" :key="key" :data-acknowledgement="key"><Icon :name="ackFor(key)?.state === 'acknowledged' ? 'lucide:circle-check' : 'lucide:circle-help'" aria-hidden="true" /><span>{{ t('acceptance.' + key) }}<small>{{ t('states.' + (ackFor(key)?.state || 'not_verified')) }}</small></span><button v-if="ackFor(key)" type="button" class="setup-link" :disabled="!!saving || !ackFor(key).basisToken" @click="saveSetup({ action: 'acknowledge', key, basisToken: ackFor(key).basisToken, acknowledged: ackFor(key).state !== 'acknowledged' })">{{ t(ackFor(key).state === 'acknowledged' ? 'withdrawAcknowledgement' : 'confirmReview') }}</button><span v-else>{{ t('states.not_verified') }}</span></li></ul></article>
              <article v-if="status.setup?.available" class="setup-card setup-history"><h3>{{ t('historyTitle') }}</h3><p class="setup-note">{{ t('historyHint') }}</p><p v-if="!status.setup.history.length" class="setup-note">{{ t('historyEmpty') }}</p><ol><li v-for="record in status.setup.history" :key="record.revision"><div><strong>{{ historyTitle(record) }}</strong><span>{{ t('historyActions.' + record.action) }} · {{ t('states.' + record.currentState) }}</span><small>{{ t('sources.' + record.source) }}</small></div><time :datetime="record.createdAt">{{ date(record.createdAt) }}</time></li></ol></article>
              <p class="setup-note">{{ t('noLaunchAction') }}</p>
            </template>
            <footer class="setup-footer"><button type="button" class="setup-button" :disabled="step === 0" @click="selectStep(step - 1)">{{ t('previous') }}</button><span>{{ t('stepOf', { current: step + 1, total: setupSections.length }) }}</span><button v-if="step < setupSections.length - 1" type="button" class="setup-button setup-primary" @click="selectStep(step + 1)">{{ t(step === setupSections.length - 2 ? 'reviewReadiness' : 'next') }}</button><NuxtLinkLocale v-else to="/dashboard" class="setup-button setup-primary">{{ t('returnDashboard') }}</NuxtLinkLocale></footer>
          </section>
        </div>
        <p class="setup-updated">{{ t('checkedAt', { time: date(status.checkedAt) }) }}</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { setupSections, setupLinks, setupAcceptanceChecks } from '~/utils/quickSetup.js'
definePageMeta({ layout: 'dashboard' })
const { t: translate, locale } = useI18n()
const t = (key, values = {}) => translate('quickSetup.' + key, values)
const { isOwner, isActiveAdmin } = useAdminAccess()
const client = useSupportClient()
const status = ref(null), loading = ref(false), error = ref(false), step = ref(0), sectionTitle = ref(null), saving = ref(false), mutationError = ref('')
const active = computed(() => setupSections[step.value])
const activeItems = computed(() => (status.value?.items || []).filter(item => active.value.items.includes(item.id)))
const blockers = computed(() => (status.value?.items || []).filter(item => status.value.readiness.blockers.includes(item.id)))
const acceptanceChecks = setupAcceptanceChecks
const choiceFor = id => status.value?.setup?.selections?.find(choice => choice.key === (id === 'shipping' ? 'pdc' : id))
const ackFor = key => status.value?.setup?.acknowledgements?.find(ack => ack.key === key)
const historyTitle = record => record.action === 'acknowledge' ? t('acceptance.' + record.key) : record.action === 'selection' && record.key === 'pdc' ? t('pdcIntegration') : t('items.' + record.key)
const sectionProgress = section => {
  if (section.id === 'readiness') return t('acceptanceOutstanding')
  const required = (status.value?.items || []).filter(item => section.items.includes(item.id) && item.required)
  return required.length ? t('sectionProgress', { complete: required.filter(item => item.configuration === 'complete').length, total: required.length }) : t('optionalSection')
}
const date = value => new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const selectStep = async index => { step.value = Math.max(0, Math.min(index, setupSections.length - 1)); await nextTick(); sectionTitle.value?.focus({ preventScroll: true }) }
const openItem = id => selectStep(setupSections.findIndex(section => section.items.includes(id)))
let requestGeneration = 0
const refreshStatus = async () => {
  const generation = ++requestGeneration
  status.value = null; error.value = false; mutationError.value = ''
  if (!isOwner.value || !isActiveAdmin.value) return
  loading.value = true
  try {
    const result = await client.request('/api/admin-setup/status', { method: 'GET', retry: 0, timeout: 15000 })
    if (generation === requestGeneration && isOwner.value && isActiveAdmin.value) status.value = result
  }
  catch { if (generation === requestGeneration) error.value = true }
  finally { if (generation === requestGeneration) loading.value = false }
}
const saveSetup = async change => {
  if (saving.value || !isOwner.value || !isActiveAdmin.value || !status.value?.setup?.available) return
  const generation = ++requestGeneration, revision = status.value.setup.revision
  saving.value = true; mutationError.value = ''
  const allowed = () => generation === requestGeneration && isOwner.value && isActiveAdmin.value
  try {
    await client.request('/api/admin-setup/state', { method: 'PATCH', body: { ...change, revision }, retry: 0, timeout: 15000 })
    if (!allowed()) return
    const result = await client.request('/api/admin-setup/status', { method: 'GET', retry: 0, timeout: 15000 })
    if (allowed()) status.value = result
  } catch (caught) {
    if (!allowed()) return
    mutationError.value = [caught?.statusCode, caught?.response?.status].includes(409) ? 'saveConflict' : 'saveError'
    try { const result = await client.request('/api/admin-setup/status', { method: 'GET', retry: 0, timeout: 15000 }); if (allowed()) status.value = result }
    catch { if (allowed()) { status.value = null; error.value = true } }
  } finally { if (allowed()) saving.value = false }
}
// Private setup data is fetched only after client mount and owner authorization.
onMounted(refreshStatus)
watch([isOwner, isActiveAdmin], () => { requestGeneration++; status.value = null; loading.value = false; saving.value = false; mutationError.value = ''; if (isOwner.value && isActiveAdmin.value) refreshStatus() })
useHead(() => ({ title: t('title') }))
</script>

<style scoped>
.setup-page{color:#172033;min-width:0;--setup-surface:#fff;--setup-border:#e2e8f0;--setup-muted:#64748b;--setup-soft:#f8fafc;--setup-accent:#2563eb}
.setup-metadata-notice{padding:14px;margin-bottom:16px;background:var(--setup-soft);border:1px solid var(--setup-border);border-radius:12px;font-size:12px;line-height:1.7}.setup-evidence-summary{font-size:12px;color:var(--setup-muted);margin:-8px 0 22px}.setup-choice{border:1px solid var(--setup-border);border-radius:10px;background:var(--setup-soft);padding:12px;margin-bottom:16px}.setup-choice label{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:600;min-height:24px}.setup-choice input{width:18px;height:18px;accent-color:var(--setup-accent);flex:none}.setup-choice p,.setup-evidence p{font-size:10px;color:var(--setup-muted);line-height:1.7;margin-top:7px}.setup-evidence{border-top:1px solid var(--setup-border);margin-top:16px;padding-top:13px}.setup-evidence>div{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px}.setup-evidence .setup-link{font-size:11px}.setup-link:disabled{opacity:.45;cursor:default}.setup-manual small{display:block;font-size:10px;color:var(--setup-muted);margin-top:5px}.setup-manual .setup-link{font-size:10px;padding:0;min-height:44px;text-align:end;max-width:120px;flex:none}.setup-history ol{margin-top:14px}.setup-history li{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;border-top:1px solid var(--setup-border);padding:13px 0;font-size:11px}.setup-history strong,.setup-history span,.setup-history small{display:block}.setup-history span,.setup-history small{margin-top:6px;color:var(--setup-muted);line-height:1.6}.setup-history time{font-size:10px;color:var(--setup-muted);max-width:130px;text-align:end;flex:none}
.setup-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}.setup-header h1{font-size:30px;font-weight:750;letter-spacing:-.025em;margin-top:5px}.setup-eyebrow{font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--setup-muted)}.setup-subtitle{color:var(--setup-muted);margin-top:8px;font-size:14px;max-width:620px;line-height:1.7}
.setup-button,.setup-link{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border-radius:10px;padding:10px 15px;font-size:13px;font-weight:650;cursor:pointer}.setup-button{border:1px solid var(--setup-border);background:var(--setup-surface)}.setup-button:disabled{opacity:.45;cursor:default}.setup-primary{background:var(--setup-accent);border-color:var(--setup-accent);color:#fff}.setup-link{color:var(--setup-accent);padding-inline:0}.setup-button:focus-visible,.setup-link:focus-visible,.setup-steps button:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}
.setup-summary{display:grid;grid-template-columns:1fr 1.1fr 1fr;gap:28px;padding:25px 28px;border:1px solid var(--setup-border);border-radius:18px;background:var(--setup-surface);margin-bottom:24px}.setup-progress-copy strong{display:block;font-size:22px;margin:6px 0}.setup-summary p{font-size:12px;line-height:1.7;color:var(--setup-muted)}.setup-progress-heading{display:flex;justify-content:space-between;gap:15px;font-size:12px;margin-bottom:12px}.setup-progress-heading strong{font-size:20px;color:var(--setup-accent)}.setup-track{height:8px;border-radius:20px;overflow:hidden;background:var(--setup-border);margin-bottom:10px}.setup-track span{display:block;height:100%;background:var(--setup-accent);border-radius:inherit}.setup-acceptance{display:flex;gap:12px;align-items:flex-start;padding:15px;border-radius:12px;background:var(--setup-soft)}.setup-acceptance>span{font-size:22px;color:#b45309;flex:none}.setup-acceptance strong{font-size:13px}.setup-acceptance p{margin-top:5px}
.setup-workspace{display:grid;grid-template-columns:250px minmax(0,1fr);gap:28px;align-items:start}.setup-steps{display:flex;flex-direction:column;gap:6px;position:sticky;top:20px}.setup-steps button{display:flex;align-items:center;gap:11px;text-align:start;border:1px solid transparent;padding:13px 10px;border-radius:12px;min-height:64px;cursor:pointer;background:transparent;color:var(--setup-muted)}.setup-steps button>span:nth-child(2){flex:1;min-width:0}.setup-steps strong{display:block;font-size:12px;line-height:1.5}.setup-steps small{display:block;font-size:10px;margin-top:4px}.setup-step-number{display:grid;place-items:center;width:29px;height:29px;flex:none;border:1px solid var(--setup-border);background:var(--setup-surface);border-radius:9px;font-size:11px;font-weight:700}.setup-steps .is-current{color:var(--setup-accent);background:var(--setup-surface);border-color:var(--setup-border)}.is-current .setup-step-number{background:var(--setup-accent);color:#fff;border-color:var(--setup-accent)}
.setup-content{min-width:0}.setup-section-header{margin:3px 0 22px}.setup-section-header h2{font-size:23px;font-weight:700;margin:7px 0;outline:none}.setup-section-header p:last-child{font-size:13px;line-height:1.7;color:var(--setup-muted)}.setup-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.setup-card{border:1px solid var(--setup-border);border-radius:16px;padding:22px;background:var(--setup-surface);min-width:0;overflow-wrap:anywhere}.setup-card h3{font-size:16px;font-weight:700}.setup-card-header{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:17px}.setup-requirement{font-size:10px;color:var(--setup-muted);display:block;margin-top:5px}.setup-badge{border-radius:7px;padding:5px 8px;font-size:10px;white-space:nowrap;background:var(--setup-soft);color:var(--setup-muted);border:1px solid var(--setup-border)}.setup-badge[data-state=complete]{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.setup-badge[data-state=incomplete]{background:#fffbeb;color:#92400e;border-color:#fde68a}.setup-badge[data-state=unsupported]{background:#f1f5f9;color:#475569}.setup-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-bottom:15px}.setup-facts dt{color:var(--setup-muted)}.setup-facts dd{text-align:end;font-weight:600}.setup-checks{border-top:1px solid var(--setup-border);padding-top:12px}.setup-checks li{display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:11px;line-height:1.6}.setup-checks li>span:nth-child(2){flex:1;min-width:0}.setup-checks small{display:block;font-size:9px;color:var(--setup-muted)}.setup-check-state{font-size:10px;color:var(--setup-muted);text-align:end}.setup-checks li>span:first-child{flex:none;font-size:16px;margin-top:1px}.check-complete{color:#059669}.check-incomplete{color:#d97706}.check-not_verified{color:var(--setup-muted)}.setup-note{font-size:11px;line-height:1.8;color:var(--setup-muted);margin-top:10px}.setup-verification{display:flex;gap:7px;font-size:10px;line-height:1.6;margin-top:15px;color:var(--setup-muted)}.setup-actions{display:flex;flex-wrap:wrap;gap:4px 18px;border-top:1px solid var(--setup-border);margin-top:15px;padding-top:5px}.setup-actions .setup-link{font-size:11px}
.setup-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:24px 0 8px}.setup-footer>span{font-size:11px;color:var(--setup-muted)}.setup-updated{font-size:10px;color:var(--setup-muted);text-align:end;margin-top:20px}.setup-loading,.setup-alert{padding:20px;background:var(--setup-surface);border:1px solid var(--setup-border);border-radius:14px}.setup-alert{color:#b91c1c}.setup-readiness-banner{display:flex;align-items:flex-start;gap:14px;background:var(--setup-soft);border:1px solid var(--setup-border);border-radius:14px;padding:20px;margin-bottom:16px}.setup-readiness-banner>span{font-size:25px;color:#b45309;flex:none}.setup-readiness-banner h3{font-size:15px;font-weight:700}.setup-readiness-banner p{font-size:12px;color:var(--setup-muted);line-height:1.8;margin-top:5px}.setup-content>.setup-card{margin-bottom:16px}.setup-blockers li{display:flex;gap:16px;justify-content:space-between;align-items:center;border-bottom:1px solid var(--setup-border);padding:12px 0;font-size:12px}.setup-blockers li:last-child{border:0}.setup-blockers strong,.setup-blockers span{display:block}.setup-blockers span{font-size:10px;color:var(--setup-muted);margin-top:5px}.setup-manual{margin-top:14px}.setup-manual li{display:flex;gap:10px;align-items:flex-start;font-size:12px;padding:10px 0;line-height:1.6}.setup-manual li>span:first-child{flex:none;color:var(--setup-muted);font-size:17px}.setup-manual li>span:nth-child(2){flex:1}.setup-manual li>span:last-child{color:var(--setup-muted);font-size:10px}
:global(.dark .setup-page){color:#e2e8f0;--setup-surface:#111827;--setup-border:#334155;--setup-muted:#94a3b8;--setup-soft:#172033;--setup-accent:#60a5fa}:global(.dark .setup-primary){background:#2563eb;color:#fff;border-color:#2563eb}:global(.dark .setup-badge[data-state=complete]){background:#052e24;color:#6ee7b7;border-color:#065f46}:global(.dark .setup-badge[data-state=incomplete]){background:#30240d;color:#fcd34d;border-color:#713f12}:global(.dark .setup-badge[data-state=unsupported]){background:#1e293b;color:#cbd5e1}:global(.dark .setup-alert){color:#fca5a5}
@media(max-width:1100px){.setup-summary{grid-template-columns:1fr 1fr}.setup-acceptance{grid-column:1/-1}.setup-workspace{grid-template-columns:210px minmax(0,1fr);gap:20px}.setup-cards{grid-template-columns:1fr}}
@media(max-width:700px){.setup-header{align-items:flex-start;gap:10px}.setup-header h1{font-size:25px}.setup-header .setup-button{font-size:11px;padding:9px;flex:none}.setup-summary{grid-template-columns:1fr;padding:20px;gap:17px}.setup-workspace{grid-template-columns:1fr;gap:20px}.setup-steps{position:static;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.setup-steps button{padding:9px 6px;gap:7px}.setup-steps button>span:last-child{display:none}.setup-steps strong{font-size:11px}.setup-step-number{width:25px;height:25px}.setup-card{padding:18px}.setup-footer{flex-wrap:wrap}.setup-footer>span{display:none}.setup-section-header h2{font-size:21px}}
</style>
