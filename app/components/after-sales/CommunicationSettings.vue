<script setup>
import { claimCommunicationPurposes,claimCommunicationTemplateMatches } from '~/utils/claimCommunications.js'
const {t}=useI18n(),client=useSupportClient(),{hasPermission:can}=useAdminAccess()
const loading=ref(true),busy=ref(''),error=ref(''),notice=ref(''),data=ref({settings:[],sms:{templates:[],senders:[]},email:{templates:[],senders:[]}})
const label=key=>t('claimCommunications.'+key)
const choices=(purpose,channel)=>data.value[channel].templates.filter(item=>claimCommunicationTemplateMatches(item,purpose,channel))
const load=async()=>{loading.value=true;try{data.value=await client.request('/api/admin-after-sales/communications')}catch{error.value=label('unavailable')}finally{loading.value=false}}
const save=async setting=>{
 busy.value=setting.purpose;error.value='';notice.value=''
 try{
  const {updated_at,...body}=setting
  const result=await client.request('/api/admin-after-sales/communications',{method:'POST',body})
  Object.assign(setting,result.setting);notice.value=label('saved')
 }catch(cause){error.value=label(cause.statusCode===409||cause.data?.statusCode===409?'conflict':'invalid')}
 finally{busy.value=''}
}
onMounted(()=>{if(can('claims.communications.view'))load();else loading.value=false})
</script>
<template>
 <section v-if="can('claims.communications.view')" class="claim-communication-settings space-y-5" data-claim-communications>
  <header class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-2xl font-bold">{{ label('title') }}</h2><p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ label('intro') }}</p></div><button type="button" :disabled="loading || !!busy" class="min-h-10 rounded-lg border px-3 text-sm" @click="load">{{ label('refresh') }}</button></header>
  <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{{ error }}</p><p v-if="notice" role="status" class="text-sm text-green-700 dark:text-green-300">{{ notice }}</p><p v-if="loading" role="status">{{ label('loading') }}</p>
  <p v-if="!loading" class="text-sm">SMS: {{ label(data.sms.enabled?'providerReady':'providerOff') }} · Email: {{ label(data.email.enabled?'providerReady':'providerOff') }}</p>
  <form v-for="setting in data.settings" :key="setting.purpose" class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" :data-purpose="setting.purpose" @submit.prevent="save(setting)">
   <h3 class="font-bold">{{ label('purposes.'+setting.purpose) }}</h3>
   <fieldset :disabled="!!busy || !can('claims.communications.manage')" class="mt-4 min-w-0 space-y-4">
    <label class="flex items-center gap-2 text-sm"><input v-model="setting.is_enabled" type="checkbox" :aria-label="label('eventEnabled')" />{{ label('eventEnabled') }}</label>
    <div class="grid gap-5 md:grid-cols-2">
     <section v-for="channel in ['sms','email']" :key="channel" class="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <label class="flex items-center gap-2 font-semibold"><input v-model="setting[channel+'_enabled']" type="checkbox" :aria-label="label(channel+'Enabled')" />{{ label(channel+'Enabled') }}</label>
      <label v-for="lang in ['en','ar']" :key="lang" class="mt-3 block text-sm">{{ label(lang==='en'?'templateEn':'templateAr') }}<select v-model="setting[channel+'_template_'+lang]" :aria-label="label(channel+'Template'+(lang==='en'?'En':'Ar'))" class="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"><option :value="null">{{ label('choose') }}</option><option v-for="item in choices(setting.purpose,channel)" :key="item.id||item.key" :value="item.id||item.key">{{ item.name }}{{ item.is_enabled?'':' · '+label('disabled') }}</option></select></label>
      <label class="mt-3 block text-sm">{{ label('sender') }}<select v-model="setting[channel+'_sender']" :aria-label="label(channel+'Sender')" class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"><option value="">{{ label('defaultSender') }}</option><option v-for="sender in data[channel].senders" :key="sender" :value="sender">{{ sender }}</option></select></label>
      <NuxtLinkLocale v-if="can(channel+'.templates.view')" :to="`/dashboard/${channel}?tab=templates&claimPurpose=${setting.purpose}`" class="mt-3 inline-block text-sm font-semibold text-blue-700 dark:text-blue-300">{{ label('editTemplates') }}</NuxtLinkLocale>
     </section>
    </div>
    <p class="text-xs text-slate-600 dark:text-slate-300">{{ label('approvalHint') }}</p><button v-if="can('claims.communications.manage')" type="submit" class="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50">{{ label(busy===setting.purpose?'saving':'save') }}</button>
   </fieldset>
  </form>
 </section>
</template>

<style>
.claim-communication-settings { color: var(--text-primary); }
.claim-communication-settings :is([data-purpose], fieldset section, select) { background: var(--surface); border-color: var(--border); color: var(--text-primary); }
.claim-communication-settings .text-slate-600 { color: var(--text-secondary); }
.claim-communication-settings a { color: var(--brand-text); }
</style>
