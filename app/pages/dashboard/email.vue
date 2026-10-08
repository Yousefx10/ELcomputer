<template>
 <div class="email-page space-y-5">
  <header class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-2xl font-bold">{{ t('title') }}</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('subtitle') }}</p></div><span class="email-badge">{{ t(capabilities.enabled ? 'enabled':'disabled') }}</span></header>
  <nav class="flex flex-wrap gap-2" :aria-label="t('title')"><NuxtLinkLocale v-for="item in tabs" :key="item.key" :to="`/dashboard/email?tab=${item.key}`" class="email-secondary" :class="{ 'email-active':tab===item.key }" :aria-current="tab===item.key?'page':undefined">{{ t(item.key) }}</NuxtLinkLocale></nav>
  <p v-if="error" class="email-error" role="alert">{{ error }}</p><p v-if="notice" class="email-notice" role="status">{{ notice }}</p><p v-if="loading" role="status">{{ t('loading') }}</p>
  <section v-else-if="tab==='settings' && can('email.settings.view')" class="email-panel">
   <h3 class="text-lg font-semibold">Brevo</h3><p class="mt-2 text-sm">{{ t(settings.readiness?.ready?'ready':'incomplete') }}</p><p v-if="!settings.encryption_ready" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ t('encryptionMissing') }}</p>
   <form class="mt-5 space-y-5" @submit.prevent="saveSettings">
    <fieldset :disabled="busy || !can('email.settings.manage')" class="grid gap-4 md:grid-cols-2">
     <label class="email-field">{{ t('endpoint') }}<input :value="settings.api_url" readonly dir="ltr" /></label>
     <label class="email-field">{{ t('brand') }}<input :aria-label="t('brand')" v-model="settings.config.brand_name" maxlength="100" /></label>
     <label v-for="key in ['transactional_sender','marketing_sender']" :key="key" class="email-field">{{ t(key) }}<select :aria-label="t(key)" v-model="settings.config[key]"><option value="">{{ t('choose') }}</option><option v-for="sender in settings.config.approved_senders" :key="sender.email" :value="sender.email">{{ sender.email }}</option></select></label>
     <label class="email-field">{{ t('replyTo') }}<input :aria-label="t('replyTo')" v-model="settings.config.reply_to" type="email" dir="ltr" maxlength="254" /></label>
     <label class="email-field">{{ t('timeout') }}<input :aria-label="t('timeout')" v-model.number="settings.config.timeout_ms" type="number" min="1000" max="30000" /></label>
     <label class="email-field">{{ t('unsubscribeOrigin') }}<input :aria-label="t('unsubscribeOrigin')" v-model="settings.config.unsubscribe_origin" type="url" dir="ltr" maxlength="300" /></label>
     <div v-for="key in ['api_key','webhook_token']" :key="key" class="email-field"><label :for="'email-secret-'+key">{{ t(key) }}</label><span class="text-xs text-gray-500">{{ t(settings[key+'_configured']?'configured':'unconfigured') }}</span><input :id="'email-secret-'+key" :aria-label="t(key)" v-model="secrets[key]" type="password" autocomplete="new-password" dir="ltr" maxlength="1024" :disabled="!settings.encryption_ready" :placeholder="t('replaceSecret')" /><label class="email-check"><input :aria-label="t('removeSecret')" v-model="clearSecrets[key]" type="checkbox" />{{ t('removeSecret') }}</label></div>
     <label v-for="key in ['account_approved','activation_confirmed','is_enabled','marketing_enabled','webhook_enabled']" :key="key" class="email-check"><input :aria-label="t(key)" v-model="settings.config[key]" type="checkbox" />{{ t(key) }}</label>
    </fieldset>
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('confirmationHint') }}</p><p class="text-sm text-gray-500 dark:text-gray-400">{{ t('configurationChange') }}</p>
    <fieldset :disabled="busy || !can('email.settings.manage')" class="space-y-3"><legend class="font-semibold">{{ t('approvedSenders') }}</legend>
     <div v-for="(sender,index) in settings.config.approved_senders" :key="index" class="email-sender grid gap-3 rounded-lg border p-3 md:grid-cols-4"><label class="email-field">{{ t('address') }}<input :aria-label="t('address')" v-model="sender.email" type="email" dir="ltr" maxlength="254" required /></label><label class="email-field">{{ t('senderName') }}<input :aria-label="t('senderName')" v-model="sender.name" maxlength="100" required /></label><label class="email-check"><input :aria-label="t('verifiedSender')" v-model="sender.verified" type="checkbox" />{{ t('verifiedSender') }}</label><button type="button" class="email-secondary" @click="settings.config.approved_senders.splice(index,1)">{{ t('remove') }}</button></div>
     <button type="button" class="email-secondary" :disabled="settings.config.approved_senders.length>=20" @click="settings.config.approved_senders.push({email:'',name:'',verified:false})">{{ t('addSender') }}</button>
    </fieldset>
    <p class="text-sm break-all" dir="ltr">POST /api/webhooks/brevo</p><button v-if="can('email.settings.manage')" class="email-primary" :disabled="busy" type="submit">{{ t('save') }}</button>
   </form>
  </section>
  <section v-else-if="tab==='templates' && can('email.templates.view')" class="email-panel">
   <div class="flex flex-wrap justify-between gap-3"><h3 class="text-lg font-semibold">{{ t('templates') }}</h3><button v-if="can('email.templates.manage')" class="email-secondary" @click="template=blankTemplate();templatePreview=null">{{ t('newTemplate') }}</button></div>
   <div class="my-4 flex flex-wrap gap-2"><button v-for="item in templates" :key="item.key" class="email-secondary" @click="template={...item};templatePreview=null">{{ item.name }} · {{ t(item.classification) }}</button></div>
   <form class="space-y-4" @submit.prevent="saveTemplate">
    <fieldset :disabled="busy || !can('email.templates.manage')" class="grid gap-4 md:grid-cols-2">
     <label class="email-field">{{ t('templateKey') }}<input :aria-label="t('templateKey')" v-model="template.key" :readonly="template.version>0" pattern="[a-z][a-z0-9_]{1,79}" maxlength="80" required dir="ltr" /></label><label class="email-field">{{ t('templateName') }}<input :aria-label="t('templateName')" v-model="template.name" maxlength="100" required /></label>
     <label class="email-field">{{ t('category') }}<input :aria-label="t('category')" v-model="template.category" maxlength="50" required /></label><label class="email-field">{{ t('classification') }}<select :aria-label="t('classification')" v-model="template.classification" :disabled="template.version>0"><option value="transactional">{{ t('transactional') }}</option><option value="marketing">{{ t('marketing') }}</option></select></label>
     <label class="email-field">{{ t('sender') }}<select :aria-label="t('sender')" v-model="template.sender"><option value="">{{ t('defaultSender') }}</option><option v-for="sender in capabilities.senders" :key="sender.email" :value="sender.email">{{ sender.email }}</option></select></label><label class="email-field">{{ t('replyTo') }}<input :aria-label="t('replyTo')" v-model="template.reply_to" type="email" dir="ltr" maxlength="254" /></label>
     <template v-for="lang in ['en','ar']" :key="lang"><label class="email-field">{{ t(lang==='en'?'subjectEn':'subjectAr') }}<input :aria-label="t(lang==='en'?'subjectEn':'subjectAr')" v-model="template['subject_'+lang]" maxlength="200" required :dir="lang==='ar'?'rtl':'ltr'" :lang="lang" /></label><label class="email-field">{{ t(lang==='en'?'bodyEn':'bodyAr') }}<textarea :aria-label="t(lang==='en'?'bodyEn':'bodyAr')" v-model="template['body_'+lang]" rows="6" maxlength="20000" required :dir="lang==='ar'?'rtl':'ltr'" :lang="lang" /></label></template>
     <label class="email-check"><input :aria-label="t('enabled')" v-model="template.is_enabled" type="checkbox" />{{ t('enabled') }}</label>
    </fieldset>
    <p class="text-sm text-gray-500">{{ t('safeSource') }}</p><p class="text-sm break-all" dir="ltr">{{ placeholderList }}</p><p class="text-xs">{{ t('version') }} {{ template.version }} · {{ date(template.updated_at) }}</p>
    <div class="flex flex-wrap gap-3"><button v-if="can('email.templates.manage')" class="email-primary" :disabled="busy">{{ t('save') }}</button><button class="email-secondary" type="button" @click="previewTemplate('en')">{{ t('previewEn') }}</button><button class="email-secondary" type="button" @click="previewTemplate('ar')">{{ t('previewAr') }}</button></div>
   </form><iframe v-if="templatePreview" :srcdoc="templatePreview" sandbox="" referrerpolicy="no-referrer" class="email-preview" :title="t('preview')" />
  </section>
  <section v-else-if="tab==='send' && can('email.transactional.send')" class="email-panel">
   <h3 class="text-lg font-semibold">{{ t('send') }}</h3><p class="mt-2 text-sm">{{ t('singleRecipient') }}</p><p v-if="!capabilities.enabled" class="mt-3 email-warning" role="status">{{ t('sendBlocked') }}</p>
   <form class="mt-4 space-y-4" @submit.prevent="makePreview">
    <fieldset :disabled="busy || !!sent" class="grid gap-4 md:grid-cols-2">
     <label class="email-field">{{ t('recipient') }}<input :aria-label="t('recipient')" v-model="manual.recipient" type="email" dir="ltr" maxlength="254" required /></label><label class="email-field">{{ t('sender') }}<select :aria-label="t('sender')" v-model="manual.sender" required><option value="">{{ t('choose') }}</option><option v-for="sender in capabilities.senders" :key="sender.email" :value="sender.email">{{ sender.email }}</option></select></label>
     <label class="email-field">{{ t('language') }}<select :aria-label="t('language')" v-model="manual.locale"><option value="en">English</option><option value="ar">العربية</option></select></label><label class="email-field">{{ t('format') }}<select :aria-label="t('format')" v-model="manual.body_format"><option value="html">HTML</option><option value="text">{{ t('plainText') }}</option></select></label>
     <label class="email-field md:col-span-2">{{ t('template') }}<select :aria-label="t('template')" v-model="manual.template_key"><option value="">{{ t('customMessage') }}</option><option v-for="item in transactionalTemplates" :key="item.key" :value="item.key">{{ item.name }}</option></select></label>
     <template v-if="manual.template_key"><label v-for="key in requiredVariables" :key="key" class="email-field">{{ t('variable_'+key) }}<textarea :aria-label="t('variable_'+key)" v-model="manual.values[key]" rows="2" maxlength="4000" required /></label></template>
     <template v-else><label class="email-field md:col-span-2">{{ t('subject') }}<input :aria-label="t('subject')" v-model="manual.subject" maxlength="200" required :dir="manual.locale==='ar'?'rtl':'ltr'" /></label><label class="email-field md:col-span-2">{{ t('body') }}<textarea :aria-label="t('body')" v-model="manual.body" rows="8" maxlength="20000" required :dir="manual.locale==='ar'?'rtl':'ltr'" /></label></template>
    </fieldset><button class="email-secondary" :disabled="busy || !!sent">{{ t('preview') }}</button>
   </form>
   <div v-if="preview" class="mt-5 space-y-3"><p class="break-all" dir="ltr">{{ preview.sender }} → {{ preview.recipient }}</p><p class="font-semibold">{{ preview.subject }}</p><iframe v-if="manual.body_format==='html'" :srcdoc="preview.html" sandbox="" referrerpolicy="no-referrer" class="email-preview" :title="t('preview')" /><pre v-else class="email-text" :dir="manual.locale==='ar'?'rtl':'ltr'">{{ preview.text }}</pre>
    <label class="email-check"><input :aria-label="t('essentialConfirmation')" v-model="essential" type="checkbox" :disabled="!!sent" />{{ t('essentialConfirmation') }}</label><label class="email-check"><input :aria-label="t('sendConfirmation')" v-model="confirmed" type="checkbox" :disabled="!!sent" />{{ t('sendConfirmation') }}</label>
    <button class="email-primary" :disabled="busy || !capabilities.enabled || !essential || !confirmed || !!sent" @click="sendEmail">{{ t('queueEmail') }}</button>
   </div><p v-if="sent" class="mt-4" role="status">{{ t(sent.state) }} · <span dir="ltr">{{ sent.id }}</span></p><button v-if="sent" class="email-secondary mt-3" @click="resetManual">{{ t('newMessage') }}</button>
  </section>
  <section v-else-if="['history','events'].includes(tab) && can('email.history.view')" class="email-panel">
   <div class="flex flex-wrap justify-between gap-3"><h3 class="text-lg font-semibold">{{ t(tab) }}</h3><button class="email-secondary" @click="loadTab">{{ t('refresh') }}</button></div><p class="my-3 text-sm text-gray-500 dark:text-gray-400">{{ t('acceptanceHint') }}</p>
   <p v-if="!history.items.length">{{ t('noHistory') }}</p><div class="overflow-x-auto"><table v-if="history.items.length" class="email-table"><thead><tr><th>{{ t('recipient') }}</th><th>{{ t('sender') }}</th><th>{{ t('classification') }}</th><th>{{ t('state') }}</th><th>{{ t('delivery') }}</th><th>{{ t('created') }}</th><th>{{ t('events') }}</th></tr></thead><tbody><tr v-for="item in history.items" :key="item.id"><td dir="ltr">{{ item.recipient }}</td><td dir="ltr">{{ item.sender }}</td><td>{{ t(item.classification) }}</td><td>{{ t(item.state) }}</td><td>{{ t(item.delivery_state) }}</td><td>{{ date(item.created_at) }}</td><td><button class="email-secondary" @click="loadEvents(item)">{{ t('view') }}</button></td></tr></tbody></table></div>
   <div class="mt-4 flex gap-3"><button class="email-secondary" :disabled="history.page<=1" @click="history.page--;loadTab()">{{ t('previous') }}</button><button class="email-secondary" :disabled="history.page*25>=history.total" @click="history.page++;loadTab()">{{ t('next') }}</button></div>
   <div v-if="selected" class="mt-6 space-y-3 rounded-lg border p-4"><p class="break-all" dir="ltr">{{ selected.id }}</p><dl class="grid gap-2 text-sm md:grid-cols-2"><div>{{ t('template') }}: {{ selected.template_key || '—' }} · {{ selected.template_version || '—' }}</div><div>{{ t('language') }}: {{ selected.locale }}</div><div>{{ t('category') }}: {{ selected.category }}</div><div>{{ t('source') }}: {{ selected.source }}</div><div class="break-all">{{ t('businessReference') }}: {{ selected.business_reference || '—' }}</div><div class="break-all">{{ t('providerId') }}: {{ selected.provider_message_id || '—' }}</div><div>{{ t('opened') }}: {{ date(selected.opened_at) }}</div><div>{{ t('errorCategory') }}: {{ selected.error_category || '—' }}</div></dl><h4 class="font-semibold">{{ t('attempts') }}</h4><p v-for="item in observations.attempts" :key="item.attempt_number" class="text-sm">{{ item.attempt_number }} · {{ t(item.state) }} · {{ item.http_status || '—' }} · {{ item.error_category || '—' }} · {{ date(item.started_at) }}</p><h4 class="font-semibold">{{ t('events') }}</h4><p v-if="!observations.events.length">{{ t('noEvents') }}</p><p v-for="(item,index) in observations.events" :key="index" class="text-sm">{{ t(item.event_type) }} · {{ date(item.event_at) }}</p></div>
  </section>
  <section v-else-if="tab==='preferences' && can('email.marketing.manage')" class="email-panel">
   <h3 class="text-lg font-semibold">{{ t('preferences') }}</h3><p class="my-3 text-sm">{{ t('consentHint') }}</p>
   <form class="flex flex-wrap items-end gap-3" @submit.prevent="findPreference"><label class="email-field grow">{{ t('recipient') }}<input :aria-label="t('recipient')" v-model="preferenceAddress" type="email" maxlength="254" required dir="ltr" /></label><button class="email-secondary" :disabled="busy">{{ t('lookup') }}</button></form>
   <form v-if="preference" class="mt-5 space-y-4" @submit.prevent="savePreference"><p class="break-all" dir="ltr">{{ preference.recipient }}</p><fieldset :disabled="busy" class="grid gap-4 md:grid-cols-2"><label class="email-field">{{ t('marketingStatus') }}<select :aria-label="t('marketingStatus')" v-model="preference.marketing_status"><option v-for="key in ['unknown','subscribed','unsubscribed']" :key="key" :value="key">{{ t(key) }}</option></select></label><label class="email-check"><input :aria-label="t('manualSuppression')" v-model="manualSuppression" type="checkbox" />{{ t('manualSuppression') }}</label><label class="email-field md:col-span-2">{{ t('provenance') }}<textarea :aria-label="t('provenance')" v-model="preference.provenance" rows="3" maxlength="500" required /></label><label class="email-check md:col-span-2"><input :aria-label="t('safetyConfirmation')" v-model="clearSafety" type="checkbox" />{{ t('safetyConfirmation') }}</label></fieldset><p>{{ t('currentRestriction') }}: {{ originalRestriction || '—' }}</p><p v-if="preference.blocked_senders.length" class="break-all">{{ t('blockedSenders') }}: {{ preference.blocked_senders.join(', ') }}</p><p class="text-xs">{{ date(preference.updated_at) }}</p><button class="email-primary" :disabled="busy">{{ t('save') }}</button></form>
  </section><p v-else>{{ t('noAccess') }}</p>
 </div>
</template>
<script setup>
import { emailVariables, renderEmailSource, emailLayout } from '~/utils/email.js'
definePageMeta({layout:'dashboard'})
const {t:translate,locale}=useI18n(),{uiMessage}=useUiLocale(),route=useUiRoute(),client=useSupportClient(),{hasPermission:can}=useAdminAccess()
const t=key=>translate('emailFoundation.'+key)
const loading=ref(true),busy=ref(false),error=ref(''),notice=ref(''),capabilities=ref({enabled:false,senders:[],default_sender:''}),settings=ref({config:{approved_senders:[]}})
const secrets=reactive({api_key:'',webhook_token:''}),clearSecrets=reactive({api_key:false,webhook_token:false})
const tab=computed(()=>String(route.query.tab||'settings'))
const tabs=computed(()=>[{key:'settings',permission:'email.settings.view'},{key:'templates',permission:'email.templates.view'},{key:'send',permission:'email.transactional.send'},{key:'history',permission:'email.history.view'},{key:'events',permission:'email.history.view'},{key:'preferences',permission:'email.marketing.manage'}].filter(x=>can(x.permission)))
const blankTemplate=()=>({key:'',name:'',category:'manual',classification:'transactional',subject_en:'',subject_ar:'',body_en:'',body_ar:'',sender:'',reply_to:'',is_enabled:false,version:0})
const template=ref(blankTemplate()),templates=ref([]),templatePreview=ref(null),placeholderList=emailVariables.map(x=>'{{'+x+'}}').join(' · ')
const blankManual=()=>({recipient:'',sender:capabilities.value.default_sender,locale:locale.value==='ar'?'ar':'en',body_format:'html',template_key:'',subject:'',body:'',values:{}})
const manual=ref(blankManual()),preview=ref(null),essential=ref(false),confirmed=ref(false),sent=ref(null)
const transactionalTemplates=computed(()=>templates.value.filter(x=>x.classification==='transactional'&&x.is_enabled))
const requiredVariables=computed(()=>{const source=templates.value.find(x=>x.key===manual.value.template_key);return source?[...new Set([...((source['subject_'+manual.value.locale]||'')+' '+(source['body_'+manual.value.locale]||'')).matchAll(/\{\{([a-z_]+)\}\}/g)].map(x=>x[1]))]:[]})
const history=reactive({page:1,total:0,items:[]}),selected=ref(null),observations=ref({attempts:[],events:[]})
const preferenceAddress=ref(''),preference=ref(null),manualSuppression=ref(false),clearSafety=ref(false),originalRestriction=ref(null)
const date=value=>value?new Intl.DateTimeFormat(locale.value==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—'
const run=async fn=>{busy.value=true;error.value='';notice.value='';try{return await fn()}catch(e){error.value=uiMessage(client.errorText(e,'Request failed. Please try again.'))}finally{busy.value=false}}
const request=(url,options={})=>client.request('/api/admin-email/'+url,options)
const loadTab=async()=>{loading.value=true;error.value='';selected.value=null;if(!can('email.view')){loading.value=false;return}await run(async()=>{
 capabilities.value=await request('capabilities')
 if(tab.value==='settings'&&can('email.settings.view'))settings.value=(await request('settings')).settings
 if(['templates','send'].includes(tab.value)&&can(tab.value==='templates'?'email.templates.view':'email.transactional.send')){templates.value=(await request('templates')).templates;if(!manual.value.sender)manual.value.sender=capabilities.value.default_sender}
 if(['history','events'].includes(tab.value)&&can('email.history.view')){const result=await request('history?page='+history.page);Object.assign(history,result)}
});loading.value=false}
const saveSettings=()=>run(async()=>{settings.value=(await request('settings',{method:'PATCH',body:{...settings.value.config,revision:settings.value.revision,...secrets,clear_api_key:clearSecrets.api_key,clear_webhook_token:clearSecrets.webhook_token}})).settings;secrets.api_key='';secrets.webhook_token='';clearSecrets.api_key=false;clearSecrets.webhook_token=false;capabilities.value=await request('capabilities');notice.value=t('saved')})
const saveTemplate=()=>run(async()=>{template.value=(await request('templates',{method:'POST',body:template.value})).template;templates.value=(await request('templates')).templates;notice.value=t('saved')})
const previewTemplate=lang=>run(async()=>{const values=Object.fromEntries(emailVariables.map(key=>[key,t('sample')]));templatePreview.value=emailLayout({subject:renderEmailSource(template.value['subject_'+lang],values,true),body:renderEmailSource(template.value['body_'+lang],values),locale:lang,brand:capabilities.value.senders[0]?.name||t('sample')})})
const manualPayload=()=>({...manual.value,values:Object.fromEntries(requiredVariables.value.map(key=>[key,manual.value.values[key]||'']))})
const makePreview=()=>run(async()=>{preview.value=await request('preview',{method:'POST',body:manualPayload()});essential.value=false;confirmed.value=false})
const sendEmail=()=>run(async()=>{sent.value=await request('send',{method:'POST',body:{...manualPayload(),receipt:preview.value.receipt,essential_confirmed:essential.value,confirmed:confirmed.value}});notice.value=t(sent.value.state)})
const resetManual=()=>{manual.value=blankManual();preview.value=null;sent.value=null;essential.value=false;confirmed.value=false}
const loadEvents=item=>run(async()=>{observations.value=await request('events?id='+encodeURIComponent(item.id));selected.value=item})
const findPreference=()=>run(async()=>{preference.value=(await request('preferences?recipient='+encodeURIComponent(preferenceAddress.value))).preference;originalRestriction.value=preference.value.global_reason;manualSuppression.value=!!preference.value.global_reason;clearSafety.value=false})
const savePreference=()=>run(async()=>{preference.value=(await request('preferences',{method:'POST',body:{recipient:preference.value.recipient,marketing_status:preference.value.marketing_status,global_reason:manualSuppression.value?(originalRestriction.value||'manual'):null,provenance:preference.value.provenance,clear_safety_confirmed:clearSafety.value,updated_at:preference.value.updated_at}})).preference;originalRestriction.value=preference.value.global_reason;clearSafety.value=false;notice.value=t('saved')})
watch(manual,()=>{preview.value=null;essential.value=false;confirmed.value=false},{deep:true})
watch(tab,()=>{preview.value=null;templatePreview.value=null;loadTab()})
onMounted(loadTab)
</script>
<style scoped>
.email-page fieldset{min-width:0}
.email-panel{min-width:0;border:1px solid #e5e7eb;border-radius:16px;padding:24px;background:var(--surface,#fff)}
.email-field{display:flex;flex-direction:column;gap:7px;font-size:14px;min-width:0}
.email-field input:not([type="checkbox"]),.email-field textarea,.email-field select{width:100%;min-width:0;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;background:transparent;color:inherit}
.email-check{display:flex;align-items:center;gap:8px;font-size:14px}.email-check input{flex:none}
.email-primary,.email-secondary{border-radius:8px;padding:10px 15px;font-size:14px;border:1px solid #cbd5e1;cursor:pointer}
.email-primary,.email-active{background:#111827;color:#fff;border-color:#111827}.email-secondary{background:transparent}.email-active{background:#111827}
button:disabled,fieldset:disabled{opacity:.55}button:disabled{cursor:not-allowed}
.email-badge{padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
.email-preview{display:block;width:100%;height:460px;border:1px solid #cbd5e1;border-radius:10px;margin-top:20px;background:white}
.email-text{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #cbd5e1;border-radius:10px;padding:20px}
.email-table{width:100%;border-collapse:collapse;font-size:13px}.email-table td,.email-table th{padding:12px;text-align:start;border-bottom:1px solid #e5e7eb;max-width:250px;overflow-wrap:anywhere}
.email-error,.email-notice,.email-warning{border-radius:10px;padding:12px;font-size:14px}.email-error{background:#fef2f2;color:#991b1b}.email-notice{background:#f0fdf4;color:#166534}.email-warning{background:#fffbeb;color:#92400e}
:global(.dark) .email-panel{background:#111827;border-color:#374151}:global(.dark) .email-active,:global(.dark) .email-primary{background:#f3f4f6;color:#111827}:global(.dark) .email-error{background:#450a0a;color:#fecaca}:global(.dark) .email-notice{background:#052e16;color:#bbf7d0}:global(.dark) .email-warning{background:#451a03;color:#fde68a}
@media(max-width:600px){.email-panel{padding:16px}.email-preview{height:400px}}
</style>
