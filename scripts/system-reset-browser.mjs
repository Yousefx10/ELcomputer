// Actual reset Vue component/cart, HTTP, PostgreSQL, Auth and Storage. Nuxt's
// shell and Realtime transport are fixtures. Only owned loopback traffic runs.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer,request as httpRequest} from 'node:http'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript} from '@vue/compiler-sfc'
import {build} from 'esbuild'
import {createResetPlatform,resetPlatformAvailable} from '../tests/helpers/systemResetPlatform.mjs'
import {saveProduct} from '../server/utils/productSave.js'
assert.ok(resetPlatformAvailable,'Actual disposable platform tools required')
const base=resolve('.'),dir=process.env.RESET_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-system-reset-browser'
await mkdir(dir,{recursive:true})
const {chromium}=await import(pathToFileURL(process.env.PRODUCT_SAVE_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const f=await createResetPlatform();let browser,server
try{
 const warehouse=randomUUID();await f.db.query("insert into public.commerce_warehouses(id,name) values($1,'Owned browser warehouse')",[warehouse])
 const input={request_id:randomUUID(),title:'Owned browser product',slug:'browser-'+randomUUID(),price:'10.00',is_serialized:true,is_published:false,primary_warehouse_id:warehouse,image_url:'/uploads/products/reset.png',description:'<img src="/uploads/products/reset.png">',variants:[{name:'Default',code:'DEFAULT'}]}
 const product=await saveProduct(f.service,{id:f.actors.owner},input,'create'),snapshot=(await f.service.rpc('catalog_product_edit_snapshot',{p_admin_id:f.actors.owner,p_product_id:product.id})).data
 await mkdir(f.uploads+'/products');await writeFile(f.uploads+'/products/reset.png','owned image')
 const {descriptor}=parse(await readFile(join(base,'app/components/dashboard/SystemReset.vue'),'utf8'))
 await writeFile(join(dir,'Reset.js'),compileScript(descriptor,{id:'reset-review',inlineTemplate:true}).content)
 await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,computed,onMounted,onBeforeUnmount,watch,nextTick} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {ofetch} from '${base}/node_modules/ofetch/dist/index.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useCart} from '${base}/app/composables/useCart.js'
import en from '${base}/i18n/locales/en.json';import ar from '${base}/i18n/locales/ar.json';import Reset from './Reset.js'
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}}),generation=ref(0),actor=ref('owner'),theme=ref('light'),states=new Map(),invalidations=[]
const tokens=${JSON.stringify(f.tokens)},useState=(key,init)=>{if(!states.has(key))states.set(key,ref(init()));return states.get(key)}
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)}
watch([theme,i18n.global.locale],appearance)
Object.assign(globalThis,{ref,computed,onMounted,onBeforeUnmount,watch,nextTick,useState,useUiLocale,useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useStoreAnalytics:()=>({trackEvent(){}}),useDashboardCache:()=>({invalidate:()=>invalidations.push('reset')}),refreshNuxtData:async()=>{},useSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:tokens[actor.value]}}})}}),$fetch:ofetch.create({retry:0})})
let cart;const Shell={setup(){cart=useCart();return()=>h('main',{class:'dashboard-modern p-4'},h(Reset,{key:generation.value}))}}
const app=createApp(Shell);app.use(i18n);const ui=useUiLocale();app.config.globalProperties.$uiLabel=ui.uiLabel;app.config.globalProperties.$uiMessage=ui.uiMessage
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}});app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:props.to},slots.default?.())}})
app.mount('#app');appearance();window.resetTest={actor,theme,locale:i18n.global.locale,appearance,invalidations,get cart(){return cart},async reload(){generation.value++;await nextTick()}}
`)
 await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'process.env.NODE_ENV':'"test"','import.meta.client':'true','__VUE_OPTIONS_API__':'true','__VUE_PROD_DEVTOOLS__':'false','__VUE_PROD_HYDRATION_MISMATCH_DETAILS__':'false'}})
 const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(n=>n.endsWith('.css')).map(n=>readFile(join(base,'.output/public/_nuxt',n),'utf8')))).join('\n')
 server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){const upstream=httpRequest(f.url+req.url,{method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)});upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream);return}
  res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(dir,'bundle.js')):`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`)
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];let assertions=0,screens=0,lose=false
 const check=(v,m)=>{assert.ok(v,m);assertions++}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/net::ERR_FAILED|status of (400|401|403|409|503)\b/.test(m.text()))errors.push(m.text())})
 await page.route('**/*',async route=>{if(!route.request().url().startsWith(url+'/')){external.push(route.request().url());await route.abort();return}if(lose&&route.request().method()==='POST'){lose=false;await route.fetch();await route.abort('failed');return}await route.continue()})
 const labels=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile(join(base,'i18n/locales/'+l+'.json'),'utf8'))])))
 await page.goto(url);await page.waitForFunction(()=>!!window.resetTest)
 const ready=()=>page.locator('article').nth(7).waitFor(),dialog=()=>page.locator('dialog[open]')
 const review=async index=>{await ready();await page.locator('article').nth(index).getByRole('button').click();await dialog().waitFor();await page.waitForFunction(()=>!document.querySelector('dialog[open] [role=status]'))}
 const close=()=>dialog().getByRole('button',{name:labels[pageLanguage].common.cancel,exact:true}).click()
 let pageLanguage='en'
 for(const language of ['en','ar'])for(const width of [390,768,1440])for(const theme of ['light','dark','system']){
  pageLanguage=language;await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'});await page.evaluate(({language,theme})=>{const t=window.resetTest;t.locale.value=language;t.theme.value=theme;t.appearance()},{language,theme});await ready()
  check(await page.locator('article').count()===8,'All eight scopes');check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'EN/AR direction');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Responsive reset options')
  await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-options.png'),fullPage:true});screens++
  await review(4);check(await dialog().locator('button[type=submit]').isDisabled(),'Authored references prevent confirmation');check((await dialog().innerText()).includes(labels[language].systemReset.message11),'Authored-reference guidance translated');check(await dialog().locator('input[type=password]').inputValue()==='','Password starts empty');check(!(await dialog().innerText()).includes('systemReset.'),'No translation keys')
  await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-media.png'),fullPage:true});screens++;await close()
 }
 pageLanguage='en';await page.evaluate(()=>{window.resetTest.locale.value='en';window.resetTest.theme.value='light';window.resetTest.appearance()})
 // Every scope can be previewed without mutation or a password attempt.
 for(let i=0;i<8;i++){await review(i);check(await dialog().locator('input[type=password]').inputValue()==='','Preview never carries password');await close()}
 check((await f.db.query('select count(*)::int n from public.system_reset_runs')).rows[0].n===0,'Preview never resets')
 await page.evaluate(async()=>{window.resetTest.actor.value='editor';await window.resetTest.reload()});await page.locator('[role=alert]').waitFor();check(await page.locator('article').count()===0,'Non-owner sees no reset controls')
 await page.evaluate(async()=>{window.resetTest.actor.value='owner';await window.resetTest.reload()});await ready()
 await f.db.query("update public.products set description='' where id=$1",[product.id])
 const execute=async(index,phrase,password=f.lab.owner.password)=>{await review(index);await dialog().locator('input[type=text]').fill(phrase);await dialog().locator('input[type=password]').fill(password);await dialog().locator('button[type=submit]').click()}
 await execute(4,'RESET MEDIA','invalid-owned-password');await dialog().getByRole('alert').waitFor();await page.waitForFunction(()=>document.querySelector('dialog[open] input[type=password]')?.value==='');check(await dialog().locator('input[type=password]').inputValue()==='','Failed password is cleared');check((await f.db.query('select count(*)::int n from public.system_reset_runs')).rows[0].n===0,'Invalid password changes nothing');await close()
 await execute(4,'RESET MEDIA');await dialog().waitFor({state:'detached'});check((await f.db.query("select state from catalog_private.media_paths where path='/uploads/products/reset.png'")).rows[0].state==='deleted','Media completes reservation');check(await page.evaluate(()=>window.resetTest.invalidations.length>0),'Reset invalidates dashboard cache')
 await assert.rejects(()=>saveProduct(f.service,{id:f.actors.owner},{...input,request_id:randomUUID(),expected_revision:snapshot.revision,variants:snapshot.variants},'update',product.id),e=>e.statusCode===409);check(true,'Loaded editorial snapshot rejected')
 await page.evaluate(async p=>{window.resetTest.cart.addItem({...p,stock_quantity:1,is_serialized:true});await window.resetTest.reload()},{id:product.id,title:'Owned cart product',price:10,variant_id:snapshot.variants[0].id})
 lose=true;await execute(0,'RESET PRODUCTS');await page.waitForFunction(()=>sessionStorage.getItem('elcomputer-system-reset-request')===null);check((await f.db.query("select count(*)::int n from public.system_reset_runs where scope='products' and status='completed'")).rows[0].n===1,'Lost browser acknowledgement reconciles completion')
 check(await page.evaluate(()=>window.resetTest.cart.items.value.length===1&&JSON.parse(localStorage.getItem('elcomputer-cart')).length===1),'Other browser cart state remains explicit')
 await page.reload();await ready();check(await page.evaluate(()=>window.resetTest.cart.items.value.length===1),'Cart restores safely after reload')
 await f.db.query("insert into public.site_settings(key,payment_cash_enabled,erp_mode) values('default',true,'built_in') on conflict(key) do update set payment_cash_enabled=true,erp_mode='built_in'")
 await assert.rejects(()=>f.db.query('select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4)',[f.actors.customer,JSON.stringify({order_number:'OWNED-'+randomUUID(),first_name:'Buyer',phone:'01012345678',street_address:'Fixture',city:'Cairo',governorate:'Cairo',payment_method:'cash',locale:'en'}),JSON.stringify([{product_id:product.id,variant_id:snapshot.variants[0].id,quantity:1}]),randomUUID()]),/product|item|available/i);check(true,'Stale cart cannot create erased order')
 await page.evaluate(()=>window.resetTest.cart.clearCart({track:false}));check(await page.evaluate(()=>window.resetTest.cart.items.value.length===0),'Cart remains usable')
 await execute(7,'RESET FULL');await dialog().waitFor({state:'detached'});check((await f.call('/api/admin-chat/settings')).response.status===200,'Chat settings initialize');check((await f.call('/api/chat/status',{actor:null})).body.enabled===false,'Public chat remains disabled');check((await f.service.auth.getUser(f.tokens.owner)).error===null,'Owner session survives Full')
 check(errors.length===0,'Unexpected browser errors: '+errors.join(';'));check(external.length===0,'No external browser requests')
 const report={assertions,screenshots:screens,errors,external,boundary:'Actual Vue reset/cart, HTTP, native PostgreSQL, Auth, Storage/files; Nuxt shell and Realtime fixtures. Other product suites use synthetic Auth. No hosted acceptance.'};await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await f.close()}
