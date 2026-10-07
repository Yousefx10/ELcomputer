// Local compiled Vue + built CSS + real H3/RBAC/SQL. Auth verification is an
// isolated fixture; no production sessions, credentials or provider calls.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { createApp as createH3App, createRouter, toNodeListener, defineEventHandler } from 'h3'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'
import { randomUUID } from 'node:crypto'
import { createOrderSmsFixture } from '../tests/helpers/orderSmsFixture.mjs'
const {chromium}=await import(pathToFileURL(process.env.AFTER_SALES_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-pdc-review-tools/node_modules/playwright/index.mjs').href)
const base=resolve(new URL('..',import.meta.url).pathname), dir=process.env.AFTER_SALES_REVIEW_ARTIFACTS||'/tmp/elcomputer-after-sales-review/browser'
await mkdir(dir,{recursive:true})
const components={Policies:'app/components/dashboard/AfterSalesPolicies.vue',PolicyField:'app/components/dashboard/after-sales/PolicyField.vue',ItemWarranty:'app/components/account/ItemWarranty.vue',ProductWarranty:'app/components/ProductWarranty.vue'}
for(const[name,file]of Object.entries(components)){const {descriptor}=parse(await readFile(join(base,file),'utf8'));await writeFile(join(dir,name+'.js'),compileScript(descriptor,{id:'after-sales-'+name,inlineTemplate:true}).content)}
const f=await createOrderSmsFixture(),viewer=randomUUID(),category=randomUUID()
await f.db.query("insert into auth.users(id,email) values($1,'policy-viewer@example.invalid')",[viewer]);await f.db.query("insert into public.admin_users(id,email,role,permissions) values($1,'policy-viewer@example.invalid','admin','{\"settings.view\":true}')",[viewer])
await f.db.query("insert into public.categories(id,name,name_ar,slug) values($1,'Policy category','فئة الاختبار',($1::uuid)::text)",[category]);await f.db.query("update public.products set category_id=$1,warranty_status='included',warranty_duration_value=12,warranty_duration_unit='months' where id=$2",[category,f.product])
f.client.auth={getUser:async token=>({data:{user:['owner','viewer'].includes(token)?{id:token==='owner'?f.owner:viewer,is_anonymous:false}:null}})}
globalThis.afterSalesBrowserDatabase=f.client;globalThis.defineEventHandler=fn=>fn
const router=createRouter()
for(const[method,route,file]of [['get','policy','policy.get.js'],['patch','policy','policy.patch.js'],['get','reasons','reasons.get.js'],['post','reasons','reasons.post.js'],['get','catalog','catalog.get.js']]){
 const result=await build({entryPoints:[join(base,'server/api/admin-after-sales',file)],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':join(base,'app')},plugins:[{name:'fixture-auth',setup(builder){builder.onResolve({filter:/\/supabaseAdmin$/},()=>({path:'supabaseAdmin',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const getSupabaseAdminClient=()=>globalThis.afterSalesBrowserDatabase',loader:'js'}));builder.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))}}]})
 router[method]('/api/admin-after-sales/'+route,(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default)
}
const rpc=async(name,args)=>{const r=await f.client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data}
const purchased=await f.checkout(),item=(await f.db.query('select * from public.customer_order_items where order_id=$1',[purchased.id])).rows[0]
// Browser display cases use actual SQL period computation; the draft purchase
// remains untouched and is tested separately by domain/API tests.
const periods={not_started:await rpc('after_sales_period',{p_basis:'order_date',p_fallback:'{}',p_dates:{order_date:'2026-10-10T12:00:00Z'},p_value:12,p_unit:'months',p_timezone:'Africa/Cairo',p_now:'2026-10-09T12:00:00Z'}),active:await rpc('after_sales_period',{p_basis:'order_date',p_fallback:'{}',p_dates:{order_date:'2026-10-10T12:00:00Z'},p_value:12,p_unit:'months',p_timezone:'Africa/Cairo',p_now:'2026-10-11T12:00:00Z'}),expired:await rpc('after_sales_period',{p_basis:'order_date',p_fallback:'{}',p_dates:{order_date:'2024-02-29T12:00:00Z'},p_value:1,p_unit:'years',p_timezone:'Africa/Cairo',p_now:'2026-10-11T12:00:00Z'}),pending:await rpc('after_sales_period',{p_basis:'delivery_date',p_fallback:'{}',p_dates:{},p_value:12,p_unit:'months',p_timezone:'Africa/Cairo'}),unavailable:{status:'unknown',reason:'historical_policy_unknown'}}
await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,computed,onMounted,watch,nextTick,resolveComponent} from 'vue';import {createI18n}from 'vue-i18n';
${Object.keys(components).map(name=>`import ${name} from './${name}.js'`).join(';')};
import en from '${join(base,'i18n/locales/en.json')}';import ar from '${join(base,'i18n/locales/ar.json')}';
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}}),view=ref('policies'),generation=ref(0),theme=ref('light'),canEdit=ref(true),caseName=ref('active'),requests=[];
const route={query:{}},product=${JSON.stringify({warranty_status:'included',warranty_duration_value:12,warranty_duration_unit:'months'})},item=${JSON.stringify(item)},periods=${JSON.stringify(periods)};
const request=async(path,options={})=>{requests.push({path,method:options.method||'GET',body:options.body});const url=path+(options.query?'?'+new URLSearchParams(options.query):'');const response=await fetch(url,{method:options.method||'GET',headers:{authorization:'Bearer '+(canEdit.value?'owner':'viewer'),'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const body=await response.json();if(!response.ok)throw {statusCode:response.status,data:body};return body};
Object.assign(globalThis,{ref,computed,onMounted,watch,nextTick,resolveComponent,useI18n:()=>i18n.global,useUiRoute:()=>route,useSupportClient:()=>({request})});
const appearance=()=>{document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.lang=i18n.global.locale.value;document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)};
watch([theme,i18n.global.locale],appearance);matchMedia('(prefers-color-scheme:dark)').addEventListener('change',appearance);
const show=async(name,query={})=>{view.value=name;route.query=query;generation.value++;await nextTick()};
const app=createApp({render:()=>h('main',{class:'dashboard-modern p-4 mx-auto max-w-5xl'},view.value==='policies'?h(Policies,{canEdit:canEdit.value,key:generation.value}):view.value==='product'?h(ProductWarranty,{product}):h(ItemWarranty,{item:{...item,after_sales:{warranty:{period:periods[caseName.value]}}}}))});
app.use(i18n);app.component('DashboardAfterSalesPolicyField',PolicyField);app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}});app.mount('#app');appearance();window.afterSalesTest={show,locale:i18n.global.locale,theme,canEdit,caseName,requests,appearance,product};
`)
await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'process.env.NODE_ENV':'"test"','__VUE_OPTIONS_API__':'true','__VUE_PROD_DEVTOOLS__':'false','__VUE_PROD_HYDRATION_MISMATCH_DETAILS__':'false'}})
const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(file=>file.endsWith('.css')).map(file=>readFile(join(base,'.output/public/_nuxt',file),'utf8')))).join('\n')
const app=createH3App();app.use(router);app.use(defineEventHandler(async event=>{event.node.res.setHeader('content-type',event.path==='/bundle.js'?'text/javascript':'text/html');return event.path==='/bundle.js'?await readFile(join(dir,'bundle.js'),'utf8'):`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>`}))
const server=createServer(toNodeListener(app));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Los_Angeles'}),errors=[],external=[],expectedHttpErrors=[];let assertions=0,screens=0,expectConflict=false
const check=(value,message)=>{assert.ok(value,message);assertions++}
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(expectConflict && m.type()==='error' && /server responded with a status of 409/.test(m.text()))expectedHttpErrors.push(m.text());else if(['warning','error'].includes(m.type()))errors.push(m.text())});await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():(external.push(route.request().url()),route.abort()))
const loaded=async()=>{await page.locator('[data-policy-save], [data-reason]').first().waitFor();await page.waitForFunction(()=>!document.querySelector('[data-after-sales]')?.textContent.includes('common.'));await page.waitForTimeout(30)}
const tab=async name=>{await page.locator('[data-policy-tab="'+name+'"]').click();if(['category','product'].includes(name)){await page.locator('[data-policy-scope] option').nth(1).waitFor({state:'attached'});await page.locator('[data-policy-scope]').selectOption(name==='category'?category:f.product)}await loaded()}
const save=async()=>{await page.locator('[data-policy-save]').click();await page.locator('[role="status"]').filter({hasText:/saved|حفظ/}).waitFor()}
try{
 await page.goto(url);await loaded()
 for(const language of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'});await page.evaluate(({language,theme})=>{window.afterSalesTest.locale.value=language;window.afterSalesTest.theme.value=theme;window.afterSalesTest.appearance()}, {language,theme})
  await page.evaluate(()=>window.afterSalesTest.show('policies'));await loaded()
  for(const name of ['warranty','returns','category','product','reasons']){
   if(name!=='warranty')await tab(name)
   check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'Locale direction')
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+name)
   check(!(await page.locator('body').innerText()).includes('afterSales.'),'Policy labels translated')
   if(name!=='reasons') {const colors=await page.locator('[data-policy-field] select, [data-policy-field] input:not([type="checkbox"])').first().evaluate(node=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});const rgb=value=>{ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)};return {fg:rgb(getComputedStyle(node).color),bg:rgb(getComputedStyle(node).backgroundColor)}});const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);const a=lum(colors.fg),b=lum(colors.bg);check((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,'Policy input theme contrast '+language+' '+theme+' '+name+' '+JSON.stringify(colors))}
   if(name==='category'||name==='product')check(await page.locator('[data-inherit]').count()===16,'Every field can inherit')
   if(name==='reasons'){await page.locator('[data-reason="changed_mind"]').click();check(await page.locator('[data-reason-field="key"]').isDisabled(),'Existing key immutable')}
   await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-'+name+'.png'),fullPage:true});screens++
  }
  await page.evaluate(()=>window.afterSalesTest.show('product'));check(await page.locator('[data-product-warranty]').innerText().then(text=>text.includes(language==='ar'?'شهر':'month')),'Structured product duration');await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-product-page.png')});screens++
  for(const name of ['active','expired','not_started','pending','unavailable']){
   await page.evaluate(async name=>{window.afterSalesTest.caseName.value=name;await window.afterSalesTest.show('account')},name)
   check(await page.locator('[data-warranty-period]').count()===1,'Period status shown')
   check(!(await page.locator('[data-item-warranty]').innerText()).includes('warranty.'),'Account labels translated')
   check(await page.locator('[data-item-warranty]').innerText().then(text=>name==='active'||name==='expired'?/2027|2025|٢٠٢٧|٢٠٢٥/.test(text):!/2027|2025|٢٠٢٧|٢٠٢٥/.test(text)),'Only authoritative dates shown')
   await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-'+name+'.png')});screens++
  }
 }
 await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));check(true,'System follows OS light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));check(true,'System follows OS dark');
 await page.evaluate(async()=>{window.afterSalesTest.locale.value='en';await window.afterSalesTest.show('policies')});await loaded()
 await page.locator('#policy-warranty_start_basis').selectOption('payment_date');await page.locator('#policy-warranty_fallback_bases').selectOption('invoice_date');await page.locator('[data-policy-field="warranty_fallback_bases"] button').last().click();await page.locator('#policy-warranty_fallback_bases').selectOption('order_date');await page.locator('[data-policy-field="warranty_fallback_bases"] button').last().click();await page.locator('[data-policy-field="warranty_fallback_bases"] button[aria-label="Move up"]').nth(1).click();await save()
 await page.locator('[data-policy-effective] summary').click();check((await page.locator('[data-policy-effective]').innerText()).includes('Order date، Invoice date'),'Ordered fallbacks saved through actual API/SQL')
 await tab('returns');await page.locator('#policy-return_window_days').fill('30');await page.locator('#policy-return_enabled').selectOption('true');await save();check(await page.locator('#policy-return_window_days').inputValue()==='30','Global return save/reload')
 await tab('category');await page.locator('[data-inherit="return_opened"]').uncheck();await page.locator('#policy-return_opened').selectOption('not_allowed');await save();check(await page.locator('[data-inherit="return_window_days"]').isChecked(),'Unchanged category field inherits')
 await tab('product');await page.locator('[data-inherit="return_window_days"]').uncheck();await page.locator('#policy-return_window_days').fill('10');await save();await page.locator('[data-inherit="return_window_days"]').check();await save();check(await page.locator('#policy-return_window_days').inputValue()==='30','Restore parent inheritance');check(await page.locator('#policy-return_opened').inputValue()==='not_allowed','Product inherits real category')
 await tab('reasons');await page.locator('[data-reason="changed_mind"]').click();await page.locator('[data-reason-field="label_en"]').fill('Changed mind fixture');await page.locator('[data-reason-field="sort_order"]').fill('5');await page.locator('[data-reason-field="is_enabled"]').uncheck();await page.locator('[data-reason-form] button').click();await page.locator('[data-reason="changed_mind"]').filter({hasText:'Changed mind fixture'}).waitFor();check((await page.locator('[data-reason="changed_mind"]').innerText()).includes('Disabled'),'Reason save/reload')
 await page.evaluate(()=>window.afterSalesTest.show('policies'));await loaded();await f.client.rpc('after_sales_save_policy',{p_admin_id:f.owner,p_scope_key:'global',p_section:'warranty',p_revision:(await f.db.query("select revision from public.after_sales_policies where scope_key='global'")).rows[0].revision,p_values:{warranty_enabled:true}})
 expectConflict=true;await page.locator('[data-policy-save]').click();await page.locator('[role="alert"]').waitFor();expectConflict=false;check((await page.locator('[role="alert"]').innerText()).includes('Reload'),'Stale write requires reload')
 await page.evaluate(async()=>{window.afterSalesTest.canEdit.value=false;await window.afterSalesTest.show('policies')});await loaded();check(await page.locator('[data-policy-save]').isDisabled(),'Viewer cannot save');check(await page.locator('#policy-warranty_start_basis').isDisabled(),'Viewer cannot edit');await tab('reasons');await page.locator('[data-reason="changed_mind"]').click();check(await page.locator('[data-reason-field="label_en"]').isDisabled(),'Viewer reason fields read only')
 check(expectedHttpErrors.length===1,'One intentionally tested stale-write HTTP conflict');check(errors.length===0,'No unexpected browser errors: '+errors.join('\n'));check(external.length===0,'No external requests');await writeFile(join(dir,'results.json'),JSON.stringify({assertions,screens,errors,external,expectedHttpErrors,transport:'actual local H3 + RBAC + isolated PostgreSQL; Auth fixture'},null,2));console.log(JSON.stringify({assertions,screens,errors:errors.length,external:external.length,artifacts:dir}))
}finally{await browser.close();await new Promise(r=>server.close(r));await f.db.close();delete globalThis.afterSalesBrowserDatabase}
