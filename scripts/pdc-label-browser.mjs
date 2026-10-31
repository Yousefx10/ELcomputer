// Real label components/PDF renderer with owned loopback-only fixtures.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,join,dirname,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {parse,compileScript} from '@vue/compiler-sfc'
import {build} from 'esbuild'
import {shippingLabelFixture} from '../tests/helpers/shippingLabelFixture.mjs'
const {chromium}=await import(pathToFileURL(process.env.PDC_REVIEW_PLAYWRIGHT).href)
const base=resolve(new URL('..',import.meta.url).pathname),dir=process.env.PDC_REVIEW_ARTIFACTS
assert.ok(dir);await mkdir(dir,{recursive:true})
const component=join(base,'app/components/dashboard/OrderDetailsDialog.vue'),source=await readFile(component,'utf8')
const tags=[...new Set([...source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(x=>x[1]))].filter(x=>!['Teleport','Transition','Suspense','ShippingLabelPreview'].includes(x))
const fixtures=Array.from({length:40},(_,i)=>{const id='00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),job='10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),awb='FIXTURE-AWB-'+(i+1),reference='FIXTURE-REF-'+(i+1),bytes=shippingLabelFixture({awb,reference,compressed:true});return {id,job,awb,reference,data:bytes.toString('base64'),sha:createHash('sha256').update(bytes).digest('hex')}})
const entry=`
import {createApp,h,Suspense,ref,computed,watch,onMounted,onBeforeUnmount,nextTick} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
import Dialog from '${component}'
const fixtures=${JSON.stringify(fixtures)},i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}})
const index=ref(0),requests=[],revoked=[],prints=[],mode=ref('good');let delayed
const current=()=>fixtures[index.value],id=ref(current().id)
const detail=()=>({order:{id:id.value,order_number:'OWNED-LABEL-FIXTURE',status:'ready_to_deliver',payment_status:'pending',payment_method:'cash',erp_owner:'built_in',is_preorder:false,total_amount:187.25,currency:'EGP',created_at:'2026-10-31T00:00:00Z',first_name:'Owned local fixture',street_address:'Owned street',city:'Owned city',governorate:'Cairo',shipping_review_status:'approved',stock_fulfillment_state:'untracked'},items:[],customer:null,preorderPayments:[],codCash:null,shipping:{id:current().job,provider:'pdc',state:'ready',awb:current().awb,label_ready:true,events:[]}})
const request=async(path,options={})=>{requests.push({path,method:options.method||'GET'});if(path==='/api/admin-orders/'+id.value)return detail();throw Error('Unexpected fixture request')}
const originalFetch=window.fetch.bind(window),originalRevoke=URL.revokeObjectURL.bind(URL)
URL.revokeObjectURL=url=>{revoked.push(url);originalRevoke(url)}
window.fetch=async(path,options={})=>{
 if(String(path).startsWith('/api/admin-shipping/')){
  requests.push({path:String(path),method:options.method||'GET',authorization:options.headers?.Authorization||options.headers?.authorization,redirect:options.redirect,cache:options.cache})
  const row={...current()},response=()=>new Response(Uint8Array.from(atob(row.data),c=>c.charCodeAt(0)),{headers:{'content-type':'application/pdf','content-length':String(atob(row.data).length),'x-shipping-order':mode.value==='wrong'?fixtures[39].id:row.id,'x-shipping-job':row.job,'x-shipping-awb':row.awb,'x-shipping-ref':row.reference,'x-label-sha256':row.sha}})
  if(mode.value==='missing')return new Response('unavailable',{status:503})
  if(mode.value==='delayed')return new Promise(resolve=>{delayed=()=>resolve(response())})
  return response()
 }
 return originalFetch(path,options)
}
window.print=()=>{prints.push({identity:current().id,pages:document.querySelectorAll('[data-label-page]').length,printing:document.body.classList.contains('shipping-label-printing')})}
Object.assign(globalThis,{ref,computed,watch,onMounted,onBeforeUnmount,nextTick,useNuxtData:()=>({data:ref(null)}),useNuxtApp:()=>({$i18n:i18n.global}),useUiLocale,useI18n:()=>i18n.global,useSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'owned-local-fixture-token'}}})}}),useSiteContent:async()=>({data:ref({site_name:'Owned fixture store'})}),$fetch:request})
const app=createApp({render:()=>h(Suspense,null,{default:()=>h(Dialog,{open:true,orderId:id.value}),fallback:()=>h('p','Loading')})});app.use(i18n)
for(const tag of ${JSON.stringify(tags)})app.component(tag,{render(){return null}})
const ui=useUiLocale();Object.assign(app.config.globalProperties,{$uiLabel:ui.uiLabel,$uiMessage:ui.uiMessage,$uiPluralSuffix:ui.uiPluralSuffix});app.mount('#app')
window.labelFixture={fixtures,index,id,mode,requests,revoked,prints,locale:i18n.global.locale,messages:{en,ar},nextTick,release:()=>delayed?.(),change:n=>{index.value=n;id.value=current().id}}
`
const bundle=await build({stdin:{contents:entry,resolveDir:base,sourcefile:'owned-label-entry.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':join(base,'app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'owned-label-vue',setup(b){
 b.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'label-worker-url',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/pdf.worker.mjs"',loader:'js'}))
 b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))
}}]})
const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(x=>x.endsWith('.css')).map(x=>readFile(join(base,'.output/public/_nuxt',x),'utf8')))).join('\n')
const server=createServer(async(req,res)=>{try{
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return res.end(bundle.outputFiles[0].text)}
 if(req.url==='/pdf.worker.mjs'){res.setHeader('Content-Type','application/javascript');return res.end(await readFile(join(base,'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')))}
 if(req.url.startsWith('/_nuxt/pdfjs-6.4.299/standard_fonts/')){res.setHeader('Content-Type','application/octet-stream');return res.end(await readFile(join(base,'node_modules/pdfjs-dist/standard_fonts',basename(req.url))))}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>')
 }catch{res.statusCode=404;res.end()}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage({acceptDownloads:true}),errors=[],external=[]
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{if(!route.request().url().startsWith(origin)){external.push(route.request().url());return route.abort()}return route.continue()})
let assertions=0;const check=(value,label)=>{assert.ok(value,label);assertions++}
try{
 await page.goto(origin)
 let index=0
 for(const locale of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark',media:'screen'})
  await page.evaluate(({locale,theme,index})=>{const f=window.labelFixture;f.locale.value=locale;f.mode.value='good';f.change(index);document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme!=='light');document.documentElement.dataset.theme=theme},{locale,theme,index:++index})
  const copy=await page.evaluate(locale=>window.labelFixture.messages[locale],locale),view=page.getByRole('button',{name:copy.shippingLabel.view,exact:true}),preview=page.locator('[data-shipping-label-preview]')
  await view.waitFor();await view.click();await preview.waitFor();await preview.getByRole('button',{name:copy.shippingLabel.print,exact:true}).waitFor()
  await page.waitForFunction(()=>{const button=document.querySelector('[data-shipping-label-preview] button');return button&&!button.disabled})
  check(await preview.locator('canvas').count()===1,'actual PDF page rendered');check(await preview.locator('canvas').evaluate(c=>c.width>1000&&c.height>1500),'print raster has sufficient resolution')
  check(await preview.locator('h4').evaluate(el=>{const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4}),lum=s=>{const [r,g,b]=rgb(s);return 0.2126*r+0.7152*g+0.0722*b},a=lum(getComputedStyle(el).color),b=lum(getComputedStyle(el.closest('header')).backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5}),'label header remains readable in every theme')
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');check(await preview.getAttribute('role')===null,'dialog semantics belong to labelled section');check(await preview.getByRole('dialog').getAttribute('aria-modal')==='true','accessible modal')
  await page.screenshot({path:join(dir,`${locale}-${width}-${theme}.png`),fullPage:true})
  const before=await page.evaluate(()=>window.labelFixture.prints.length);await preview.getByRole('button',{name:copy.shippingLabel.print,exact:true}).click()
  await page.waitForFunction(n=>window.labelFixture.prints.length===n+1,before)
  check(await page.evaluate(()=>window.labelFixture.prints.at(-1).printing&&window.labelFixture.prints.at(-1).pages===1),'Print includes only rendered label pages')
  if(locale==='en'&&width===390&&theme==='light'){
   await page.emulateMedia({media:'print'});check(await page.locator('#app').evaluate(e=>getComputedStyle(e).display)==='none','order UI is excluded from print');check(await preview.locator('[data-label-controls]').evaluate(e=>getComputedStyle(e).display)==='none','label controls excluded from print')
   const printed=await page.pdf({path:join(dir,'owned-label-print.pdf'),preferCSSPageSize:true,printBackground:true})
   const {default:DOMMatrix}=await import('@thednp/dommatrix');globalThis.DOMMatrix=DOMMatrix
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=pathToFileURL(join(base,'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
   const task=pdfjs.getDocument({data:new Uint8Array(printed),verbosity:0,useWasm:false})
   try{const doc=await task.promise,v=(await doc.getPage(1)).getViewport({scale:1});check(doc.numPages===1&&Math.abs(v.width-283.465)<1&&Math.abs(v.height-425.197)<1,'actual browser printed PDF preserves label paper size')}finally{await task.destroy()}
   await page.emulateMedia({media:'screen'})
  }
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));check(!await page.evaluate(()=>document.body.classList.contains('shipping-label-printing')),'print CSS state is cleaned')
  await preview.getByRole('button',{name:copy.common.close,exact:true}).click();await preview.waitFor({state:'hidden'})
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:copy.shippingLabel.download,exact:true}).click();const download=await downloadPromise
  const fixture=fixtures[index],file=join(dir,`${locale}-${width}-${theme}.pdf`);await download.saveAs(file)
  check(createHash('sha256').update(await readFile(file)).digest('hex')===fixture.sha,'Download preserves original PDF bytes');check(download.suggestedFilename()==='PDC-'+fixture.awb+'.pdf','Download uses server-bound AWB filename')
  await page.waitForFunction(url=>window.labelFixture.revoked.includes(url),download.url());check(true,'download object URL revoked')
  const prints=await page.evaluate(()=>window.labelFixture.prints.length);await page.getByRole('button',{name:copy.shippingLabel.print,exact:true}).click();await page.waitForFunction(n=>window.labelFixture.prints.length===n+1,prints)
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await preview.getByRole('button',{name:copy.common.close,exact:true}).click();await preview.waitFor({state:'hidden'})
 }
 await page.evaluate(()=>{const f=window.labelFixture;f.locale.value='en';f.change(30);f.mode.value='missing'})
 const copy=await page.evaluate(()=>window.labelFixture.messages.en),preview=page.locator('[data-shipping-label-preview]')
 await page.getByRole('button',{name:copy.shippingLabel.view,exact:true}).click();await page.getByText(copy.shippingLabel.unavailable,{exact:true}).waitFor();check(await preview.count()===0,'missing PDF is withheld')
 await page.evaluate(()=>window.labelFixture.mode.value='wrong');await page.getByRole('button',{name:copy.shippingLabel.view,exact:true}).click();await page.getByText(copy.shippingLabel.unavailable,{exact:true}).waitFor();check(await preview.count()===0,'wrong-order response is withheld')
 await page.evaluate(()=>window.labelFixture.mode.value='delayed');const requested=await page.evaluate(()=>window.labelFixture.requests.length)
 await page.getByRole('button',{name:copy.shippingLabel.view,exact:true}).click();await page.waitForFunction(n=>window.labelFixture.requests.length>n,requested)
 await page.evaluate(()=>{window.labelFixture.change(31);window.labelFixture.mode.value='good';window.labelFixture.release()});await page.waitForTimeout(200)
 check(await preview.count()===0,'stale previous-order PDF cannot open after switching orders')
 await page.getByRole('button',{name:copy.shippingLabel.view,exact:true}).click();await preview.waitFor();await page.waitForFunction(()=>!document.querySelector('[data-shipping-label-preview] button').disabled)
 await preview.getByRole('button',{name:copy.common.close,exact:true}).focus();await page.keyboard.press('Tab');check(await preview.getByRole('button',{name:copy.shippingLabel.print,exact:true}).evaluate(e=>e===document.activeElement),'keyboard focus stays inside the label dialog')
 await page.keyboard.press('Escape');await preview.waitFor({state:'hidden'});check(await page.getByRole('button',{name:copy.shippingLabel.view,exact:true}).evaluate(e=>e===document.activeElement),'Escape closes label and restores focus')
 const calls=await page.evaluate(()=>window.labelFixture.requests)
 check(calls.every(c=>c.method==='GET'),'no booking, retry, provider or other mutation request');check(calls.filter(c=>c.path.includes('/label')).every(c=>c.authorization==='Bearer owned-local-fixture-token'&&c.redirect==='error'&&c.cache==='no-store'),'labels use private auth with no redirects/cache')
 check(errors.length===0,'no browser exceptions: '+errors.join('; '));check(external.length===0,'no external network')
 console.log(JSON.stringify({result:'PDC_LABEL_BROWSER_PASS',assertions,scenarios:12,locales:['en','ar'],widths:[1440,390],themes:['light','dark','system'],real_pdf_rendering:true,original_download_bytes:true,printed_pdf_geometry:true,stale_error_and_identity_cases:true,provider_calls:0,real_orders:0,external_requests:0}))
}catch(error){await writeFile(join(dir,'failure.private.json'),JSON.stringify({error:String(error),errors,external},null,2));await page.screenshot({path:join(dir,'failure.png'),fullPage:true});throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
