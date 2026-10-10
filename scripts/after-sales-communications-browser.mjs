// Actual Vue components + built CSS + real H3/RBAC/disposable SQL. Auth and
// Storage transport are fixtures; no production credentials or external calls.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'
import { defineEventHandler } from 'h3'
import { createClaimsHttpFixture } from '../tests/helpers/claimsHttpFixture.mjs'
import { attachClaimCommunicationsFixture,communicationRuntime } from '../tests/helpers/claimCommunicationsFixture.mjs'
import { claimCommunicationPurposes } from '../app/utils/claimCommunications.js'
const { chromium } = await import(pathToFileURL(process.env.CLAIMS_REVIEW_PLAYWRIGHT || '/private/tmp/elcomputer-pdc-review-tools/node_modules/playwright/index.mjs').href)
const base = resolve(new URL('..', import.meta.url).pathname), dir = process.env.CLAIM_COMMUNICATIONS_ARTIFACTS || '/tmp/elcomputer-claims-communications-browser'
await mkdir(dir, { recursive: true })
const components = { CommunicationSettings: 'after-sales/CommunicationSettings.vue', Communications: 'after-sales/Communications.vue', ReverseLogistics: 'after-sales/ReverseLogistics.vue', Center: 'after-sales/Center.vue', Detail: 'after-sales/Detail.vue', ClaimForm: 'after-sales/ClaimForm.vue', EvidencePicker: 'after-sales/EvidencePicker.vue', Timeline: 'after-sales/Timeline.vue', ItemWarranty: 'account/ItemWarranty.vue', Navigation: 'account/Navigation.vue' }
for (const [name, file] of Object.entries(components)) {
  const { descriptor } = parse(await readFile(join(base, 'app/components', file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'claims-' + name, inlineTemplate: true }).content)
}
const f=await attachClaimCommunicationsFixture(await createClaimsHttpFixture({communications:true}));f.setCommunicationProviders({sms:f.smsProvider,email:f.emailProvider})
await f.enable();await f.providers();await f.createTemplates()
const item=await f.purchase(),claim=await f.create(f.body(item));await f.action(claim.id,'review');await f.action(claim.id,'note',{text:'BROWSER-COMMUNICATION-PRIVATE-NOTE'})
const requestItem=await f.purchase(),requested=await f.create(f.body(requestItem));await f.action(requested.id,'review');await f.action(requested.id,'request_information',{text:'Please provide more details.'})
const admins = Object.fromEntries((await f.db.query('select id,role,is_active,permissions from public.admin_users')).rows.map(row => [Object.keys(f.actors).find(name => f.actors[name] === row.id), row]))
await writeFile(join(dir, 'entry.js'), `
import {createApp,h,ref,reactive,computed,onMounted,onBeforeUnmount,watch,nextTick,resolveComponent} from 'vue';import{createI18n}from'vue-i18n';
${Object.keys(components).map(name => `import ${name} from './${name}.js'`).join(';')};
import en from '${join(base, 'i18n/locales/en.json')}';import ar from '${join(base, 'i18n/locales/ar.json')}';
import{useUiLocale}from'${join(base, 'app/composables/useUiLocale.js')}';import{hasAdminPermission}from'${join(base, 'app/utils/adminPermissions.js')}';
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}}),actor=ref('buyer'),staff=ref(false),view=ref('center'),claimId=ref(''),generation=ref(0),theme=ref('light'),downloads=[],admins=${JSON.stringify(admins)};
const route=reactive({path:'/account/after-sales',query:{},params:{}});
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)};matchMedia('(prefers-color-scheme:dark)').addEventListener('change',appearance);
const show=async(kind,isStaff=false,id='',name=isStaff?'owner':'buyer')=>{actor.value=name;staff.value=isStaff;view.value=kind;claimId.value=id;route.path=(isStaff?'/dashboard/after-sales':'/account/after-sales')+(id?'/'+id:'');generation.value++;appearance();await nextTick()};
const navigate=to=>{const path=typeof to==='string'?to:to.path;const id=/after-sales\\/([a-f0-9-]{36})/.exec(path)?.[1]||'';return show(id?'detail':'center',path.startsWith('/dashboard'),id,path.startsWith('/dashboard')?actor.value:'buyer')};
const request=async(path,options={})=>{if(path==='/api/support/unread')return{unreadTicketCount:0};const url=path+(options.query?'?'+new URLSearchParams(options.query):'');const isForm=options.body instanceof FormData;const response=await fetch(url,{method:options.method||'GET',headers:{authorization:'Bearer '+actor.value,...(isForm?{}:{'content-type':'application/json'})},...(options.body?{body:isForm?options.body:JSON.stringify(options.body)}:{})});const data=await response.json();if(!response.ok)throw{statusCode:response.status,data};return data};
const downloadFrom=async(path,name)=>{const response=await fetch(path,{headers:{authorization:'Bearer '+actor.value}});if(!response.ok)throw{data:await response.json()};downloads.push({name,bytes:(await response.arrayBuffer()).byteLength})};
Object.assign(globalThis,{ref,reactive,computed,onMounted,onBeforeUnmount,watch,nextTick,resolveComponent,useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useUiLocale,useUiRoute:()=>route,useUiNavigation:()=>({uiNavigateTo:navigate}),useSupportClient:()=>({request,downloadFrom}),useAdminAccess:()=>({hasPermission:key=>hasAdminPermission(admins[actor.value],key)})});
const app=createApp({render:()=>h('main',{class:'p-4 mx-auto max-w-6xl '+(staff.value?'dashboard-modern':'account-modern')},[!staff.value?h(Navigation,{variant:'modern',key:'nav'+generation.value}):null,view.value==='settings'?h(CommunicationSettings,{key:generation.value}):view.value==='center'?h(Center,{staff:staff.value,key:generation.value}):h(Detail,{staff:staff.value,id:claimId.value,key:generation.value})])});app.use(i18n);for(const[name,component]of Object.entries({AfterSalesCenter:Center,AfterSalesDetail:Detail,AfterSalesClaimForm:ClaimForm,AfterSalesEvidencePicker:EvidencePicker,AfterSalesTimeline:Timeline,AfterSalesCommunications:Communications,AfterSalesReverseLogistics:ReverseLogistics,AccountItemWarranty:ItemWarranty}))app.component(name,component);app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:'#',onClick:event=>{event.preventDefault();navigate(props.to)}},slots.default?.())}});app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}});app.config.globalProperties.$uiLabel=value=>useUiLocale().uiLabel(value);app.config.globalProperties.$uiMessage=value=>useUiLocale().uiMessage(value);app.mount('#app');appearance();window.claimsTest={show,locale:i18n.global.locale,theme,appearance,downloads};
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } })
const css = (await Promise.all((await readdir(join(base, '.output/public/_nuxt'))).filter(file => file.endsWith('.css')).map(file => readFile(join(base, '.output/public/_nuxt', file), 'utf8')))).join('\n')
const { url, close } = await f.start(defineEventHandler(async event => { event.node.res.setHeader('content-type', event.path === '/bundle.js' ? 'text/javascript' : 'text/html'); return event.path === '/bundle.js' ? readFile(join(dir, 'bundle.js'), 'utf8') : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>` }))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], external = [], scans = []
let assertions=0,states=0,screens=0,expectedSettingsOutage=false
const expectedHttpErrors=[]
const check=(value,message)=>{assert.ok(value,message);assertions++}
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type())){
 if(expectedSettingsOutage&&m.location().url===url+'/api/admin-after-sales/communications'&&/^Failed to load resource:.*503/.test(m.text()))expectedHttpErrors.push({status:503,path:'/api/admin-after-sales/communications'})
 else errors.push(m.text())
}})
await page.route('**/*',r=>r.request().url().startsWith(url)?r.continue():(external.push(r.request().url()),r.abort()))
page.on('response',r=>{if((r.headers()['content-type']||'').includes('json'))scans.push({path:new URL(r.url()).pathname,status:r.status()})})
const show=async(view,staff=true,id='',actor=staff?'owner':'buyer')=>{
 await page.evaluate(args=>window.claimsTest.show(...args),[view,staff,id,actor])
 await page.locator(view==='settings'?'[data-purpose]':'[data-claim-timeline]').first().waitFor();await page.waitForTimeout(70)
}
const messages=Object.fromEntries(await Promise.all(['en','ar'].map(async lang=>[lang,JSON.parse(await readFile(join(base,'i18n/locales/'+lang+'.json'),'utf8'))])))
const inspect=async label=>{
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow: '+label)
 check(!/\b(?:claims|claimCommunications)\.[A-Za-z]/.test(await page.locator('main').innerText()),'Translated: '+label)
 check(await page.locator('html').getAttribute('dir')===(await page.evaluate(()=>window.claimsTest.locale.value)==='ar'?'rtl':'ltr'),'Direction: '+label)
 const contrast=await page.locator('[data-purpose] h3, [data-claim-communication-history] h2').evaluateAll(nodes=>nodes.every(node=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d',{willReadFrequently:true});const colors=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)}
  const luminance=rgb=>rgb.map(c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0)
  let parent=node,bg
  while(parent){const color=getComputedStyle(parent).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent'){bg=colors(color);break}parent=parent.parentElement}
  const fg=luminance(colors(getComputedStyle(node).color)),back=luminance(bg||[255,255,255]);return (Math.max(fg,back)+0.05)/(Math.min(fg,back)+0.05)>=4.5
 }))
 check(contrast,'Readable communication text: '+label)
 check(await page.locator('main input, main select, main textarea').evaluateAll(nodes=>nodes.every(node=>node.closest('label')||node.getAttribute('aria-label'))),'Form controls have accessible labels: '+label)
 await page.screenshot({path:join(dir,label+'.png'),fullPage:true});states++;screens++
}
const staffAction=async(action,text='Browser staff decision',resolution=null)=>{
 await page.locator('[data-claim-action]').selectOption(action);const form=page.locator('form').last();await form.locator('textarea').fill(text)
 if(resolution)await page.locator('[data-claim-resolution]').selectOption(resolution)
 await page.getByRole('button',{name:messages.en.claims.saveAction,exact:true}).click();await page.getByRole('status').filter({hasText:messages.en.claims.saved}).waitFor();await page.waitForTimeout(80)
}
const drain=async()=>{for(const channel of ['sms','email']){await f.unthrottle();const r=await fetch(url+'/api/internal/'+channel+'/process',{method:'POST',headers:{'content-type':'application/json',['x-'+channel+'-worker-secret']:communicationRuntime[channel+'WorkerSecret']},body:'{"limit":3}'});assert.equal(r.status,200)}}
const history=()=>page.locator('[data-claim-communication-history]')
try{
 await page.goto(url)
 for(const language of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  const label=language+'-'+width+'-'+theme
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'})
  await page.evaluate(({language,theme})=>{window.claimsTest.locale.value=language;window.claimsTest.theme.value=theme;window.claimsTest.appearance()},{language,theme})
  await show('settings');check(await page.locator('[data-purpose]').count()===7,'All seven controls');check(await page.locator('input[type="checkbox"]:checked').count()===0,'All default OFF');check(await page.locator('select').count()===42,'Bilingual bindings and senders');await inspect(label+'-settings-off')
  await show('settings',true,'','communicationsViewer');check(await page.locator('fieldset:disabled').count()===7,'Read-only configuration');await inspect(label+'-settings-read-only')
  await show('detail',true,requested.id);check(await history().count()===1,'Staff diagnostics mounted');await inspect(label+'-staff-history')
  await show('detail',false,requested.id);check(await history().count()===0,'Customer has no diagnostics');check(!(await page.locator('main').innerText()).includes('BROWSER-COMMUNICATION-PRIVATE-NOTE'),'Customer privacy');await inspect(label+'-customer-timeline')
 }
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{window.claimsTest.locale.value='en';window.claimsTest.theme.value='system';window.claimsTest.appearance()});await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));check(true,'System follows light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));check(true,'System follows dark')
 await page.evaluate(()=>{window.claimsTest.theme.value='light';window.claimsTest.appearance()});await show('settings')
 await page.keyboard.press('Tab');check(await page.evaluate(()=>['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)),'Keyboard reaches an interactive control')
 await page.keyboard.press('Tab')
 await page.keyboard.press('Shift+Tab');check(await page.evaluate(()=>['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)),'Reverse keyboard traversal works')
 const settingsUrl=url+'/api/admin-after-sales/communications'
 let releaseOutage;const pendingOutage=new Promise(resolve=>{releaseOutage=resolve});expectedSettingsOutage=true
 await page.route(settingsUrl,async route=>{await pendingOutage;await route.fulfill({status:503,contentType:'application/json',body:'{"statusCode":503}'})})
 await page.evaluate(()=>window.claimsTest.show('settings',true,'','owner'));await page.getByRole('status').filter({hasText:messages.en.claimCommunications.loading}).waitFor();check(true,'Integrated loading state is accessible');releaseOutage()
 await page.getByRole('alert').waitFor();check((await page.getByRole('alert').innerText()).includes(messages.en.claimCommunications.unavailable),'Integrated settings error is accessible')
 await page.unroute(settingsUrl);expectedSettingsOutage=false
 await page.evaluate(()=>window.claimsTest.show('settings',true,'','viewer'));await page.waitForTimeout(100);check(await page.locator('[data-claim-communications]').count()===0,'Unprivileged staff do not fetch or render controls')
 await show('settings')
 for(const purpose of claimCommunicationPurposes){
  const form=page.locator('[data-purpose="'+purpose+'"]');await form.getByRole('checkbox',{name:messages.en.claimCommunications.eventEnabled,exact:true}).check()
  await form.getByRole('checkbox',{name:messages.en.claimCommunications.smsEnabled,exact:true}).check();await form.getByRole('checkbox',{name:messages.en.claimCommunications.emailEnabled,exact:true}).check()
  for(const lang of ['en','ar']){await form.getByRole('combobox',{name:messages.en.claimCommunications['smsTemplate'+(lang==='en'?'En':'Ar')],exact:true}).selectOption(f.templates.sms[purpose].id);await form.getByRole('combobox',{name:messages.en.claimCommunications['emailTemplate'+(lang==='en'?'En':'Ar')],exact:true}).selectOption(f.templates.email[purpose].key)}
  await form.getByRole('combobox',{name:messages.en.claimCommunications.smsSender,exact:true}).selectOption('APP');await form.getByRole('combobox',{name:messages.en.claimCommunications.emailSender,exact:true}).selectOption('store@email.example.invalid')
  const response=page.waitForResponse(r=>r.url().endsWith('/api/admin-after-sales/communications')&&r.request().method()==='POST');await form.getByRole('button',{name:'Save',exact:true}).click();check((await response).status()===200,'Actual binding save '+purpose);await page.waitForTimeout(60)
 }
 await show('settings');check(await page.locator('input[type="checkbox"]:checked').count()===21,'Persisted fixture enablement');await inspect('enabled-approved-bindings')
 const snapshot=async purpose=>{
  await drain();await show('detail',true,claim.id);check((await history().innerText()).includes(messages.en.claimCommunications.purposes[purpose]),'History '+purpose);check(!(await history().innerText()).includes('purchase-contact'),'Masked email');check(!(await history().innerText()).includes('01012345678'),'Masked phone');await inspect(purpose+'-staff')
  await show('detail',false,claim.id);check(await history().count()===0,'Private '+purpose);await inspect(purpose+'-customer');await show('detail',true,claim.id)
 }
 await show('detail',true,claim.id);await staffAction('request_information','Please add the customer-facing item details.');await snapshot('more_information')
 await show('detail',false,claim.id);await page.locator('textarea').fill('Browser customer response');await page.getByRole('button',{name:messages.en.claims.sendResponse,exact:true}).click();await page.getByRole('status').filter({hasText:messages.en.claims.saved}).waitFor()
 await show('detail',true,claim.id);await staffAction('approve');await snapshot('approved')
 await f.reverseConfigure();globalThis.useRuntimeConfig=()=>communicationRuntime
 const booked=await f.schedule(claim.id),work=(await f.take()).find(j=>j.id===booked.id);await f.finish(work);await snapshot('pickup_scheduled')
 const job=await f.job(work.id),delivery=f.event(job,5);await f.record(delivery);await f.record(delivery);await snapshot('received')
 await staffAction('inspect');await staffAction('select_resolution','Refund decision only.','refund');await snapshot('resolution_decided');await staffAction('resolve','Claim handling closed.');await snapshot('resolved')
 const rejectedItem=await f.purchase(),rejected=await f.create(f.body(rejectedItem));await show('detail',true,rejected.id);await staffAction('review');await staffAction('reject');await drain();await show('detail',true,rejected.id);check((await history().innerText()).includes(messages.en.claimCommunications.purposes.rejected),'Rejection history');await inspect('rejected-staff');await show('detail',false,rejected.id);check(await history().count()===0,'Rejection privacy');await inspect('rejected-customer')
 for(const language of ['en','ar']){await page.evaluate(language=>{window.claimsTest.locale.value=language;window.claimsTest.appearance()},language);await page.setViewportSize({width:390,height:1000});await show('detail',true,claim.id);await inspect(language+'-mobile-completed-history')}
 const reference=(await f.detail(claim.id)).claim.reference;check(f.calls.email.filter(m=>m.business_reference===reference).length===6,'All six sequential milestones sent mocked Email');check(f.calls.sms.length===7,'Seven mocked SMS including rejection');check(f.calls.email.length===7,'Seven mocked Email including rejection')
 check(errors.length===0,'No browser errors: '+errors.join('\n'));check(external.length===0,'No external requests')
 check(expectedHttpErrors.length===1,'Exactly one deliberately injected settings outage')
 const result={assertions,states,screens,responseScans:scans.length,errors,external,expectedHttpErrors,smsMockAcceptances:f.calls.sms.length,emailMockAcceptances:f.calls.email.length,authentication:'Fixture only; actual Vue/H3/RBAC/disposable SQL',reverseProvider:'Verified SQL fixture acceptance only',productionAcceptance:false}
 await writeFile(join(dir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}catch(e){await page.screenshot({path:join(dir,'failure.png'),fullPage:true});await writeFile(join(dir,'failure.json'),JSON.stringify({message:e.message,assertions,states,errors,external},null,2));throw e}
finally{await browser.close();await close()}
