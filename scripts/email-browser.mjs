// Actual Email Vue page + compiled application CSS + real H3/RBAC/disposable SQL.
// Auth/provider transports are fixtures; external browser requests are refused.
import assert from 'node:assert/strict'
import { readFile,writeFile,mkdir,readdir } from 'node:fs/promises'
import { resolve,join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse,compileScript,compileStyle } from '@vue/compiler-sfc'
import { defineEventHandler } from 'h3'
import { createEmailHttpFixture } from '../tests/helpers/emailHttpFixture.mjs'
import { EMAIL_KEY_CANARY,WEBHOOK_CANARY } from '../tests/helpers/emailFixture.mjs'
const {chromium}=await import(pathToFileURL(process.env.EMAIL_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-pdc-review-tools/node_modules/playwright/index.mjs').href)
const base=resolve('.'),dir=process.env.EMAIL_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-email-browser';await mkdir(dir,{recursive:true})
let componentCss=''
for(const [name,file]of Object.entries({Email:'dashboard/email.vue',Unsubscribe:'email/unsubscribe.vue'})){
 const {descriptor}=parse(await readFile(join(base,'app/pages',file),'utf8'))
 await writeFile(join(dir,name+'.js'),compileScript(descriptor,{id:'email-'+name,inlineTemplate:true}).content)
 for(const style of descriptor.styles)componentCss+=compileStyle({source:style.content,filename:file,id:'email-'+name,scoped:!!style.scoped}).code
}
const f=await createEmailHttpFixture();await f.activate();await f.saveTemplate(f.template());await f.saveTemplate(f.template('marketing'))
const admins=Object.fromEntries((await f.db.query('select id,role,is_active,permissions from public.admin_users')).rows.map(row=>[Object.keys(f.actors).find(name=>f.actors[name]===row.id),row]))
await f.configure({is_enabled:false})
await writeFile(join(dir,'entry.js'),`
import{createApp,h,ref,reactive,computed,onMounted,watch,nextTick}from'vue';import{createI18n}from'vue-i18n';import Email from './Email.js';import Unsubscribe from './Unsubscribe.js';
import en from '${join(base,'i18n/locales/en.json')}';import ar from '${join(base,'i18n/locales/ar.json')}';import{useUiLocale}from'${join(base,'app/composables/useUiLocale.js')}';import{hasAdminPermission}from'${join(base,'app/utils/adminPermissions.js')}';
Email.__scopeId='data-v-email-Email';
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}}),actor=ref('owner'),generation=ref(0),theme=ref('light'),view=ref('email'),admins=${JSON.stringify(admins)},route=reactive({path:'/dashboard/email',query:{tab:'settings'}});
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)};matchMedia('(prefers-color-scheme:dark)').addEventListener('change',appearance);
const show=async(tab='settings',name='owner',kind='email')=>{actor.value=name;view.value=kind;route.query.tab=tab;generation.value++;appearance();await nextTick()};
const request=async(path,options={})=>{const response=await fetch(path,{method:options.method||'GET',headers:{authorization:'Bearer '+actor.value,'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const data=await response.json();if(!response.ok)throw{statusCode:response.status,data};return data};
Object.assign(globalThis,{ref,reactive,computed,onMounted,watch,nextTick,definePageMeta:()=>{},useHead:()=>{},useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useUiLocale,useUiRoute:()=>route,useSupportClient:()=>({request,errorText:error=>error.data?.statusMessage||error.message}),useAdminAccess:()=>({hasPermission:key=>hasAdminPermission(admins[actor.value],key)}),$fetch:(path,options)=>request(path,options)});
const app=createApp({render:()=>h('main',{class:'p-4 mx-auto max-w-6xl'},[h(view.value==='email'?Email:Unsubscribe,{key:generation.value})])});app.use(i18n);app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:props.to,onClick:event=>{event.preventDefault();show(new URL(props.to,location.origin).searchParams.get('tab'),actor.value)}},slots.default?.())}});app.mount('#app');appearance();window.emailTest={show,route,locale:i18n.global.locale,theme,appearance};
`)
await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}})
const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(x=>x.endsWith('.css')).map(x=>readFile(join(base,'.output/public/_nuxt',x),'utf8')))).join('\n')+componentCss
const {url,close}=await f.start(defineEventHandler(async event=>{event.node.res.setHeader('content-type',event.path==='/bundle.js'?'text/javascript':'text/html');return event.path==='/bundle.js'?readFile(join(dir,'bundle.js'),'utf8'):`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`}))
const browser=await chromium.launch({executablePath:process.env.EMAIL_REVIEW_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[],scans=[]
let assertions=0,screens=0,states=0
const check=(value,message)=>{assert.ok(value,message);assertions++}
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(['warning','error'].includes(message.type()))errors.push(message.text())})
await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():(external.push(route.request().url()),route.abort()))
const pendingScans=[];page.on('response',response=>{if((response.headers()['content-type']||'').includes('json'))pendingScans.push((async()=>{const text=await response.text();check(!text.includes(EMAIL_KEY_CANARY)&&!text.includes(WEBHOOK_CANARY)&&!text.includes('browser-replacement-private-api-key-over-32-characters'),'Secrets absent from browser API');check(!/_encrypted|html_body|text_body|unsubscribe_hash|"correlation"/.test(text),'Private snapshots absent');scans.push({path:new URL(response.url()).pathname,status:response.status()})})())})
const messages={en:JSON.parse(await readFile('i18n/locales/en.json','utf8')).emailFoundation,ar:JSON.parse(await readFile('i18n/locales/ar.json','utf8')).emailFoundation}
let language='en'
const button=key=>page.getByRole('button',{name:messages[language][key],exact:true})
const field=key=>page.getByLabel(messages[language][key],{exact:true})
const show=async(tab,name='owner')=>{await page.evaluate(args=>window.emailTest.show(...args),[tab,name]);await page.waitForFunction(()=>!document.body.textContent.includes('Loading…')&&!document.body.textContent.includes('جارٍ التحميل…'));await page.waitForTimeout(70)}
const inspect=async label=>{check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+label);check(!(await page.locator('main').first().innerText()).includes('emailFoundation.'),'Labels translated '+label);check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'Direction '+label);await page.screenshot({path:join(dir,label+'.png'),fullPage:true});states++;screens++}
const manual=async(template=false)=>{
 await field('recipient').fill('browser@email.example.invalid');await field('sender').selectOption('store@email.example.invalid')
 if(template){await field('template').selectOption('fixture_transactional');await field('variable_reference').fill('BROWSER');await field('variable_customer_name').fill('<script>unsafe</script>');await field('variable_message').fill(language==='ar'?'تم تحديث طلبك.':'Your request has changed.')}
 else{await field('subject').fill(language==='ar'?'تحديث الطلب':'Request update');await field('body').fill(language==='ar'?'مرحبًا، تم تحديث طلبك.':'Hello, your request has changed.')}
 await button('preview').click();await page.locator('.email-preview').waitFor();check(await page.locator('.email-preview').getAttribute('sandbox')==='','Preview sandboxed')
}
try{
 await page.goto(url)
 for(language of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'});await page.evaluate(({language,theme})=>{window.emailTest.locale.value=language;window.emailTest.theme.value=theme;window.emailTest.appearance()},{language,theme})
  const label=language+'-'+width+'-'+theme
  for(const tab of ['settings','templates','send','history','events','preferences']){await show(tab);await inspect(label+'-'+tab)}
  await show('send');await manual(true);await field('essentialConfirmation').check();await field('sendConfirmation').check();check(await button('queueEmail').isDisabled(),'Disabled provider cannot queue');check((await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n===0,'No disabled backlog');await inspect(label+'-disabled-preview')
  await show('templates');await page.getByRole('button',{name:'Fixture transactional · '+messages[language].transactional,exact:true}).click();await button('previewAr').click();await page.locator('.email-preview').waitFor();await inspect(label+'-template-preview')
 }
 language='en';await page.evaluate(()=>window.emailTest.locale.value='en');await page.setViewportSize({width:1440,height:1000})
 // Settings mutations exercise encrypted replacement and a separate fresh confirmation.
 await show('settings');await field('api_key').fill('browser-replacement-private-api-key-over-32-characters');await button('save').click();await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();check(await field('api_key').inputValue()==='','Replacement input cleared');check(!(await f.settings()).config.is_enabled,'Replacement leaves provider disabled');await inspect('settings-secret-replaced')
 await field('account_approved').check();await field('activation_confirmed').check();await field('is_enabled').check();await button('save').click();await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();check((await f.settings()).config.is_enabled,'Fresh configured activation saved');await inspect('settings-enabled-mock')
 await show('send','sender');await manual();await field('essentialConfirmation').check();await field('sendConfirmation').check();await field('subject').fill('Changed after preview');check(await page.locator('.email-preview').count()===0,'Editing invalidates preview');await button('preview').click();await page.locator('.email-preview').waitFor();await field('essentialConfirmation').check();await field('sendConfirmation').check();await button('queueEmail').click();await button('newMessage').waitFor();check((await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n===1,'Single confirmed intent');await inspect('manual-queued');check(f.providerCalls.length===0,'Queue action makes no provider request')
 const worker=await fetch(url+'/api/internal/email/process',{method:'POST',headers:{'content-type':'application/json','x-email-worker-secret':'email-fixture-worker-over-32-characters'},body:'{"limit":1}'});check(worker.status===200,'Mock worker accepted');check(f.providerCalls.length===1,'Only mocked provider used')
 await show('history','history');await button('view').click();await page.getByText('Send attempts',{exact:true}).waitFor();await inspect('history-accepted')
 const m=(await f.db.query('select * from public.email_messages limit 1')).rows[0];const {WEBHOOK_CANARY:token}=await import('../tests/helpers/emailFixture.mjs');const webhook=await fetch(url+'/api/webhooks/brevo',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({event:'delivered',email:m.recipient,'message-id':m.provider_message_id,ts_event:Math.floor(Date.now()/1000)})});check(webhook.status===200,'Authenticated fixture webhook')
 await show('events','history');await button('view').click();await page.getByText('Delivered observation').last().waitFor();await inspect('events-delivered')
 await show('preferences','preferences');await field('recipient').fill('browser@email.example.invalid');await button('lookup').click();await field('marketingStatus').waitFor();await field('marketingStatus').selectOption('subscribed');await field('provenance').fill('Browser fixture explicit consent');await button('save').click();await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();await inspect('preference-consent');check((await f.db.query('select marketing_status from public.email_preferences where recipient=$1',['browser@email.example.invalid'])).rows[0].marketing_status==='subscribed','Consent persisted')
 for(const [actor,tab]of [['viewer','settings'],['templates','templates'],['sender','send'],['history','history'],['preferences','preferences'],['customer','settings'],['inactive','send']]){await show(tab,actor);await inspect('role-'+actor);if(['customer','inactive'].includes(actor))check(await page.locator('.email-panel').count()===0,'Customer/inactive has no private panel')}
 // Claims shortcuts use the central editor, with a disabled purpose-bound draft.
 await page.evaluate(()=>{window.emailTest.route.query.claimPurpose='more_information'});await show('templates','owner');await button('newTemplate').click()
 check(await field('templateKey').inputValue()==='claim_more_information','Claims draft uses approved purpose key');check(await field('category').inputValue()==='claims:more_information','Claims draft has purpose category');check(await field('classification').inputValue()==='transactional','Claims draft is Transactional');check(!await field('enabled').isChecked(),'Claims draft defaults OFF')
 check((await field('bodyEn').inputValue()).includes('{{request_text}}')&&(await field('bodyAr').inputValue()).includes('{{claim_url}}'),'Bilingual customer request and account link');await button('save').click();await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();check((await f.db.query("select is_enabled from public.email_templates where key='claim_more_information'")).rows[0].is_enabled===false,'Central draft saved disabled');await inspect('claims-central-template-draft')
 await field('enabled').check();await button('save').click();await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();await show('send','owner');await field('template').selectOption('claim_more_information');check(!/emailFoundation\.variable_/.test(await page.locator('main').innerText()),'Claim variable labels translated in central editor');await inspect('claims-central-variable-labels')
 await page.evaluate(()=>{delete window.emailTest.route.query.claimPurpose})
 // Future marketing service supplies a recipient-bound fragment token, no campaign UI.
 const {createEmailService}=await import('../server/utils/email/service.js');const marketing=await createEmailService(f.client).sendMarketing(f.input({recipient:'browser@email.example.invalid',sender:'marketing@email.example.invalid',template_key:'fixture_marketing',values:{reference:'X',customer_name:'Buyer',message:'Fixture'}}));const marketingMessage=await f.message(marketing.id),linkToken=marketingMessage.text_body.match(/#([A-Za-z0-9_-]{43})/)[1]
 await page.evaluate(async token=>{history.replaceState(null,'','/email/unsubscribe#'+token);await window.emailTest.show('settings','customer','unsubscribe')},linkToken);await button('unsubscribeAction').waitFor();check(!(await page.evaluate(()=>location.href)).includes(linkToken),'Token removed from address bar');await button('unsubscribeAction').click();await page.getByRole('status').filter({hasText:messages.en.unsubscribeDone}).waitFor();await inspect('unsubscribe-confirmed');check((await f.db.query('select marketing_status from public.email_preferences where recipient=$1',['browser@email.example.invalid'])).rows[0].marketing_status==='unsubscribed','Recipient token changes only marketing consent')
 for(language of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.evaluate(({language,theme})=>{window.emailTest.locale.value=language;window.emailTest.theme.value=theme;window.emailTest.appearance()},{language,theme});await inspect('unsubscribe-'+language+'-'+width+'-'+theme)
 }
 await Promise.all(pendingScans);check(errors.length===0,'No browser errors '+errors.join('; '));check(external.length===0,'No external browser request')
 const report={assertions,states,screens,jsonResponses:scans.length,errors,external,mockedProviderCalls:f.providerCalls.length,realProviderCalls:0,authenticatedProductionAcceptance:false}
 await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close();await close()}
