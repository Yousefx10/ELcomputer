// Actual Vue Router transitions, product/specification/media components, product
// HTTP commands, PostgREST RLS, filesystem and native disposable SQL. Auth is synthetic.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer,request as httpRequest} from 'node:http'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript,compileStyle} from '@vue/compiler-sfc'
import {build} from 'esbuild'
import {createCatalogRestFixture} from '../tests/helpers/catalogRestFixture.mjs'
import {createProductSaveHttpFixture} from '../tests/helpers/productSaveHttpFixture.mjs'
import {createMediaFixture,pngImage} from '../tests/helpers/mediaFixture.mjs'
import {seedListing} from '../tests/helpers/productListFixture.mjs'
import {TABLES,semanticCell,guideRows} from '../server/utils/catalogTransferContract.js'
import {readCsv,writeCsv} from '../server/utils/catalogTransferCsv.js'
import {readXlsx,writeXlsx} from '../server/utils/catalogTransferXlsx.js'
import {nativeWaitFor} from '../tests/helpers/emailNativeDatabase.mjs'
const base=resolve(new URL('..',import.meta.url).pathname)
const dir=process.env.CATALOG_TRANSFER_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-catalog-transfer-browser'
await mkdir(dir,{recursive:true})
const {chromium}=await import(pathToFileURL(process.env.PRODUCT_SAVE_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const rest=await createCatalogRestFixture();let f,media,browser,server,empty,reviewPage
try{
 const migrationDir=join(base,'supabase/migrations');for(const name of(await readdir(migrationDir)).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await rest.db.exec(await readFile(join(migrationDir,name),'utf8'))
 // Schema reference omits hosted baseline grants; match certified fixture table access.
 await rest.db.exec('grant select on public.commerce_warehouses,public.commerce_crm_accounts to authenticated')
 f=await createProductSaveHttpFixture({database:rest.db,closeDatabase:false});Object.assign(rest.actors,f.actors)
 media=await createMediaFixture({fixture:f});f.client.__ownedUploadsDir=media.root
 empty=await createProductSaveHttpFixture();await empty.db.exec('delete from public.categories;delete from public.brands')
 await nativeWaitFor(async()=>(await rest.request('/specification_definitions?select=id',{actor:'owner'})).status===200)
 const seed=await f.save(f.body({title:'Authored product',is_published:false}));const snapshot=await f.snapshot(seed.id)
 const definitions=(await rest.db.query('select id from public.specification_definitions order by name limit 2')).rows
 assert.equal(definitions.length,2)
 const specs=[];for(let i=0;i<2;i++)specs.push((await rest.db.query("insert into public.product_specifications(product_id,definition_id,label,value,sort_order) select $1,id,name,$2,$3 from public.specification_definitions where id=$4 returning id",[seed.id,'Known value '+i,i,definitions[i].id])).rows[0].id)
 const gallery=[];for(let i=0;i<2;i++){await media.addFile('products/gallery/saved-'+i+'.png');gallery.push((await rest.db.query("insert into public.product_images(product_id,variant_id,image_url,alt_text,sort_order) values($1,$2,$3,$4,$5) returning id",[seed.id,snapshot.variants[0].id,'/uploads/products/gallery/saved-'+i+'.png','Known alt '+i,i])).rows[0].id)}
 const longProduct=await f.save(f.body({title:'Long authored field',long_description:'X'.repeat(35000)}))
 const listingSeed=await seedListing(f,60)
 await media.addFile('products/list-thumbnail.png');await rest.db.query("update public.products set image_url='/uploads/products/list-thumbnail.png' where title like 'Listing product %'")
 const components={Transfer:'app/pages/dashboard/products/transfer.vue',CatalogTransfer:'app/components/dashboard/products/CatalogTransfer.vue',Listing:'app/pages/dashboard/products/index.vue',ListFilter:'app/components/dashboard/products/ListFilter.vue',Add:'app/pages/dashboard/products/add.vue',Edit:'app/pages/dashboard/products/edit/[id].vue',Variants:'app/components/dashboard/products/VariantsEditor.vue',SellingMode:'app/components/dashboard/products/SellingModeFields.vue',Warranty:'app/components/dashboard/products/WarrantyFields.vue',Specifications:'app/components/dashboard/products/SpecificationEditor.vue',Seo:'app/components/dashboard/SeoFields.vue',PageIntro:'app/components/dashboard/PageIntro.vue',MediaField:'app/components/dashboard/MediaUploadField.vue',MediaLibrary:'app/components/dashboard/MediaLibrary.vue'}
 let componentCss='';for(const[name,file]of Object.entries(components)){const{descriptor}=parse(await readFile(join(base,file),'utf8'));await writeFile(join(dir,name+'.js'),compileScript(descriptor,{id:'editor-'+name,inlineTemplate:true}).content);for(const style of descriptor.styles)componentCss+=compileStyle({source:style.content,filename:file,id:'data-v-editor-'+name,scoped:style.scoped}).code}
 const config={url:f.url,emptyUrl:empty.url,media:media.url,rest:rest.url,actors:f.actors,tokens:Object.fromEntries(['owner','editor','viewer','disabled','customer'].map(a=>[a,rest.token(a)])),product:seed.id,warehouse:f.warehouse,gallery,specs,category:f.category,brand:f.brand,listingRows:listingSeed.rows.map(p=>({id:p.id,title:p.title,sku:p.sku}))}
 await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,Suspense,resolveComponent,useId} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createRouter,createWebHistory,RouterView,useRoute,useRouter} from '${base}/node_modules/vue-router/dist/vue-router.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {PostgrestClient} from '${base}/node_modules/@supabase/postgrest-js/dist/index.mjs'
import {ofetch} from '${base}/node_modules/ofetch/dist/index.mjs'
import {localizedPath} from '${base}/app/utils/appearance.js'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useProductSave} from '${base}/app/composables/useProductSave.js'
import {useProductEditor} from '${base}/app/composables/useProductEditor.js'
import {useProductSection} from '${base}/app/composables/useProductSection.js'
import {useAdminUploads} from '${base}/app/composables/useAdminUploads.js'
import {useMediaErrors} from '${base}/app/composables/useMediaErrors.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
${Object.keys(components).map(name=>"import "+name+" from './"+name+".js'").join('\n')}
Listing.__scopeId='data-v-editor-Listing'
const config=${JSON.stringify(config)}
const state=new Map(),useState=(key,create)=>{if(!state.has(key))state.set(key,ref(create()));return state.get(key)}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}}),actor=ref('owner'),theme=ref('light'),erp=ref({mode:'built_in'}),generation=ref(0),invalidations=[]
const adminUser=computed(()=>({id:config.actors[actor.value]}))
const permissions=key=>actor.value==='owner'||actor.value==='editor'&&['products.view','products.add','products.edit'].includes(key)||actor.value==='viewer'&&key==='products.view'
let failSpecification=false,failLookup=false,delayedList=false,emptyMode=false
const supabase={from(table){return new PostgrestClient(config.rest,{headers:{Authorization:'Bearer '+config.tokens[actor.value]},fetch:async(...args)=>{if(failSpecification&&table==='product_specifications'&&args[1]?.method==='PATCH'){failSpecification=false;return new Response(JSON.stringify({code:'23514',message:'Fixture validation failure'}),{status:400,headers:{'content-type':'application/json'}})}if(failLookup&&table==='commerce_warehouses')return new Response(JSON.stringify({code:'PGRST',message:'Fixture lookup failure'}),{status:503,headers:{'content-type':'application/json'}});return fetch(...args)}}).from(table)}}
const Dummy={render:()=>h('div',{'data-prerequisite':true},[h('p','Existing management route fixture'),h('a',{href:'/dashboard/products/add',onClick:e=>{e.preventDefault();router.push('/dashboard/products/add')}},'Return to product')])}
const router=createRouter({history:createWebHistory(),routes:[{path:'/dashboard/products/transfer',component:Transfer},{path:'/ar/dashboard/products/transfer',component:Transfer},{path:'/dashboard/products',component:Listing},{path:'/ar/dashboard/products',component:Listing},{path:'/dashboard/products/add',component:Add},{path:'/dashboard/products/edit/:id',component:Edit},{path:'/ar/dashboard/products/add',component:Add},{path:'/ar/dashboard/products/edit/:id',component:Edit},{path:'/:pathMatch(.*)*',component:Dummy}]})
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}
watch([theme,i18n.global.locale],appearance);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',appearance)
Object.assign(globalThis,{ref,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,resolveComponent,useId,useState,useUiLocale,useProductSave,useProductEditor,useProductSection,useAdminUploads,useMediaErrors,definePageMeta(){},useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useUiRoute:()=>useRoute(),useRouter,useSupabaseClient:()=>supabase,useNuxtData:()=>({data:erp}),useSiteContent:()=>({data:ref({settings:{}})}),useRuntimeConfig:()=>({public:{siteUrl:'https://fixture.example.invalid'}}),useDashboardLayout:()=>({dashboardLayout:ref('standard')}),
 useAdminAccess:()=>({adminUser,hasPermission:permissions}),useAdminLogs:()=>({getAdminAuthHeaders:async()=>({authorization:'Bearer '+actor.value}),recordAdminLog:async()=>{}}),
 useDashboardCache:()=>({getSnapshot:()=>null,isFresh:()=>false,setSnapshot(){},invalidate:p=>invalidations.push(p)}),
 useAsyncData:async(_key,loader)=>{const data=ref(null),error=ref(null),pending=ref(false);const refresh=async()=>{pending.value=true;try{data.value=await loader();error.value=null}catch(e){error.value=e}finally{pending.value=false}};await refresh();return{data,error,pending,refresh}},
 useUiNavigation:()=>({uiNavigateTo:to=>router.push(localizedPath(to,i18n.global.locale.value)),uiRouterPush:to=>router.push(localizedPath(to,i18n.global.locale.value)),uiRouterReplace:to=>router.replace(localizedPath(to,i18n.global.locale.value))}),$fetch:async(path,options)=>{if(delayedList&&path==='/api/admin-products/list'){delayedList=false;const result=await ofetch(config.url+path,{...options,signal:undefined,retry:0});await new Promise(resolve=>window.releaseStaleList=resolve);return result}return ofetch((path.startsWith('/api/admin-gallery')||path.startsWith('/api/admin-uploads')?'':emptyMode?config.emptyUrl:config.url)+path,{...options,retry:0})}})
const app=createApp({render:()=>h('div',{class:'dashboard-modern p-4'},h(RouterView,null,{default:({Component,route})=>h(Suspense,null,{default:()=>h(Component,{key:route.path+generation.value})})}))})
app.use(i18n);app.use(router);const ui=useUiLocale();app.config.globalProperties.$uiLabel=ui.uiLabel;app.config.globalProperties.$uiMessage=ui.uiMessage
for(const[name,component]of Object.entries({DashboardProductsVariantsEditor:Variants,DashboardProductsSellingModeFields:SellingMode,DashboardProductsWarrantyFields:Warranty,DashboardProductsSpecificationEditor:Specifications,DashboardPageIntro:PageIntro,DashboardSeoFields:Seo,DashboardMediaUploadField:MediaField,DashboardMediaLibrary:MediaLibrary}))app.component(name,component)
app.component('DashboardSecondaryNav',{render(){return null}})
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}})
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots,attrs}){return()=>h('a',{...attrs,href:router.resolve(localizedPath(props.to,i18n.global.locale.value)).href,onClick:e=>{if(attrs.onClick)attrs.onClick(e);if(!e.defaultPrevented){e.preventDefault();router.push(localizedPath(props.to,i18n.global.locale.value))}}},slots.default?.())}})
router.isReady().then(()=>{app.mount('#app');appearance()})
window.editorTest={config,invalidations,actor,theme,erp,locale:i18n.global.locale,state,router,appearance,failSpecification:()=>failSpecification=true,failLookup:value=>failLookup=value,holdNextList:()=>delayedList=true,emptyMode:value=>emptyMode=value,async show(path){await router.push(path);generation.value++;await nextTick()}}
`)
 await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],plugins:[{name:'compiled-list-filter',setup(b){b.onResolve({filter:/CatalogTransfer\.vue$/},()=>({path:join(dir,'CatalogTransfer.js')}));b.onResolve({filter:/ListFilter\.vue$/},()=>({path:join(dir,'ListFilter.js')}))}}],define:{'process.env.NODE_ENV':'"test"','import.meta.client':'true','__VUE_OPTIONS_API__':'true','__VUE_PROD_DEVTOOLS__':'false','__VUE_PROD_HYDRATION_MISMATCH_DETAILS__':'false'}})
 const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(n=>n.endsWith('.css')).map(n=>readFile(join(base,'.output/public/_nuxt',n),'utf8')))).join('\n')+componentCss
 server=createServer(async(req,res)=>{if(req.url.startsWith('/api/admin-gallery')||req.url.startsWith('/api/admin-uploads')){const proxy=httpRequest(media.url+req.url,{method:req.method,headers:{...req.headers,host:new URL(media.url).host}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});proxy.on('error',()=>{res.statusCode=503;res.end()});req.pipe(proxy);return}if(req.url.startsWith('/uploads/')){const response=await fetch(media.url+req.url);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return}res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(dir,'bundle.js')):'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],external=[];let assertions=0,screens=0,failList=false,oversizeList=false,expectedLostResponses=0,loseBrowserResponse=false
 reviewPage=page
 const check=(value,message)=>{assert.ok(value,message);assertions++}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/ERR_EMPTY_RESPONSE|ERR_FAILED/.test(m.text())){expectedLostResponses++;return}if(m.type()==='error'&&!/server responded with a status of (400|401|403|409|503)\b/.test(m.text()))errors.push(m.text())})
 const listRequests=[];page.on('request',r=>{if(r.url().startsWith(f.url+'/api/admin-products/list'))listRequests.push(r.url())})
 await page.route('**/*',async route=>{
  if(![url,f.url,rest.url,media.url,empty.url].some(origin=>route.request().url().startsWith(origin+'/'))){external.push(route.request().url());await route.abort();return}
  if(route.request().url().startsWith(f.url+'/api/admin-products/list')&&failList){failList=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({statusCode:503,statusMessage:'Fixture listing outage'})});return}
  if(route.request().url().startsWith(f.url+'/api/admin-products/list')&&oversizeList){oversizeList=false;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:Array.from({length:26},(_,i)=>({id:String(i)})),total:26,page:1,page_size:25,catalog_total:26})});return}
  if(loseBrowserResponse&&route.request().url().startsWith(f.url+'/api/admin-products/transfer/import/apply')&&route.request().method()==='POST'){loseBrowserResponse=false;await route.fetch();await route.abort('failed');return}
  await route.continue()
 })
 const labels=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile(join(base,'i18n/locales/'+l+'.json'),'utf8'))])))
 const waitList=async()=>{try{await page.locator('tr[data-product-id]').first().waitFor();await page.waitForFunction(()=>document.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='false')}catch(error){await writeFile(join(dir,'failure.json'),JSON.stringify({url:page.url(),body:await page.locator('body').innerText(),errors,requests:listRequests,rpcErrors:f.controls.rpcErrors},null,2));await page.screenshot({path:join(dir,'failure.png')});throw error}}
 const show=async path=>{await page.evaluate(path=>window.editorTest.show(path),path);await waitList()}
 const screenshot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});screens++}
 await page.goto(url+'/dashboard/products?q=Listing+product');await page.waitForFunction(()=>!!window.editorTest);await waitList()
 const rowBoxes=()=>page.locator('table tbody input[type=checkbox]')
 const controls=page.locator('[data-bulk-controls]')
 const countText=async(language,n)=>{const text=labels[language].productBulk.selected.replace('{count}',String(n));await controls.getByText(text,{exact:true}).waitFor();check(true,'Exact selected count '+n)}
 const selectOne=async()=>{await rowBoxes().first().check();await countText('en',1);return page.locator('tr[data-product-id]').first().getAttribute('data-product-id')}
 const review=async(language='en')=>{await controls.getByRole('button',{name:labels[language].productBulk.review,exact:true}).click();await controls.getByRole('button',{name:labels[language].productBulk.apply,exact:true}).waitFor()}
 const apply=async(language='en')=>{await review(language);await controls.getByRole('button',{name:labels[language].productBulk.apply,exact:true}).click();await page.locator('[data-bulk-results]').waitFor();await waitList()}
 const transfer=page.locator('[data-catalog-transfer]'),previewPane=page.locator('[data-catalog-preview]')
 const exportFixture=async(format='csv')=>{const r=await fetch(f.url+'/api/admin-products/transfer/export',{method:'POST',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({format,scope:'selected',ids:[seed.id],filters:{}})});assert.equal(r.status,200);return Buffer.from(await r.arrayBuffer())}
 const csvBytes=await exportFixture(),xlsxBytes=await exportFixture('xlsx')
 const parseDownload=async(download,format)=>{const bytes=await readFile(await download.path());return format==='csv'?readCsv(bytes):readXlsx(bytes)}
 const unusedOpenTransfer=async language=>{await transfer.getByRole('button',{name:labels[language].catalogTransfer.title,exact:true}).click();await transfer.locator('#catalog-preview-file').waitFor()}
 const choose=async(bytes=csvBytes,format='csv')=>transfer.locator('#catalog-preview-file').setInputFiles({name:'merchant.'+format,mimeType:'application/octet-stream',buffer:bytes})
 const inspect=async(bytes=csvBytes,format='csv',language='en')=>{await choose(bytes,format);await transfer.getByRole('button',{name:labels[language].catalogTransfer.preview,exact:true}).click();await previewPane.waitFor();await page.waitForFunction(()=>!document.querySelector('#catalog-preview-file')?.disabled)}
 const invariant=async()=>({counts:await f.counts(),products:(await rest.db.query('select to_jsonb(p) row from public.products p order by id')).rows,variants:(await rest.db.query('select to_jsonb(v) row from public.product_variants v order by id')).rows,gallery:(await rest.db.query('select to_jsonb(i) row from public.product_images i order by id')).rows,specs:(await rest.db.query('select to_jsonb(s) row from public.product_specifications s order by id')).rows})
 const goTransfer=async(language='en',query='q=Authored+product')=>{
  await page.evaluate(path=>window.editorTest.show(path),(language==='ar'?'/ar':'')+'/dashboard/products/transfer?'+query)
  await transfer.locator('#catalog-preview-file').waitFor()
  await page.waitForFunction(()=>!document.querySelector('#catalog-preview-file')?.disabled)
 }
 const resetReview=async()=>{
  if(await page.locator('[data-import-close]').count()) {await page.locator('[data-import-close]').click();await page.locator('[data-import-close]').waitFor({state:'detached'})}
  const fresh=transfer.getByRole('button',{name:labels.en.catalogImport.new,exact:true});if(await fresh.count())await fresh.click()
 }
 const jobPane=page.locator('[data-catalog-job]')
 const before=await invariant()
 check(await page.locator('#catalog-preview-file').count()===0,'Main listing has no large import preview')
 await screenshot('en-1440-products-compact')
 for(const language of ['en','ar'])for(const width of [390,768,1440])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'});await page.evaluate(({language,theme})=>{const s=window.editorTest;s.locale.value=language;s.theme.value=theme;s.appearance()},{language,theme});await goTransfer(language);await inspect(width===768?xlsxBytes:csvBytes,width===768?'xlsx':'csv',language)
  check((await previewPane.innerText()).includes(labels[language].catalogTransfer.productResults.replace('{create}','0').replace('{update}','0').replace('{unchanged}','1').replace('{invalid}','0').replace('{conflicted}','0')),'Exact unchanged preview')
  check(await page.locator('[data-import-apply]').isDisabled(),'Explicit confirmation required');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'Correct direction');check((await transfer.locator('#catalog-preview-file').inputValue()).includes('merchant.'),'Source retained in memory for approved reupload')
  check(await page.evaluate(()=>!localStorage.length&&Object.values(sessionStorage).every(v=>!v.includes('Authored product')&&!v.includes('Known value'))),'Browser storage contains receipt IDs only')
  await screenshot(language+'-'+width+'-'+theme+'-review');if(theme==='light'&&width!==768){await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-viewport.png')});screens++}
 }
 check(JSON.stringify(await invariant())===JSON.stringify(before),'Review never modifies catalog/audits/inventory')
 await page.evaluate(()=>{const s=window.editorTest;s.locale.value='en';s.theme.value='light';s.appearance()});await page.setViewportSize({width:1440,height:1000});await goTransfer();await inspect();await page.locator('[data-import-confirm]').check();await page.locator('[data-import-apply]').click();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('1 unchanged'))
 check(JSON.stringify(await invariant())===JSON.stringify(before),'Unchanged application creates no catalog audit or rewrite');await screenshot('en-1440-unchanged-result');await resetReview()
 // Keep exports/templates accessible from the compact listing, retaining current-page semantics.
 await show('/dashboard/products?q=Listing+product');await controls.getByRole('checkbox',{name:labels.en.productBulk.selectPage,exact:true}).check()
 await transfer.getByRole('button',{name:labels.en.catalogImport.exports,exact:true}).click()
 for(const format of ['csv','xlsx']){
  await transfer.locator('#catalog-export-format').selectOption(format);const event=page.waitForEvent('download');await transfer.getByRole('button',{name:labels.en.catalogTransfer.export,exact:true}).click();check((await parseDownload(await event,format)).Products.length===25,'Exports exactly the selected page')
  const templateEvent=page.waitForEvent('download');await transfer.getByRole('button',{name:labels.en.catalogTransfer.template,exact:true}).click();check((await parseDownload(await templateEvent,format)).Products.length===0,'Template has no dummy product')
 }
 await transfer.getByRole('link',{name:labels.en.catalogImport.open,exact:true}).click();await transfer.locator('#catalog-preview-file').waitFor();await page.waitForFunction(()=>!document.querySelector('#catalog-preview-file')?.disabled)
 check(new URL(page.url()).searchParams.get('ids').split(',').length===25,'Dedicated view receives an explicit bounded selection')
 await page.evaluate(()=>window.editorTest.router.push('/dashboard/products/transfer?q=Authored+product'))
 await page.waitForFunction(()=>document.querySelector('#catalog-export-scope')?.textContent.includes('Filtered results (1)'))
 check(true,'Dedicated view refreshes counts after same-route query changes')
 await page.evaluate(()=>window.editorTest.router.push('/dashboard/products/transfer?q=Missing+catalog+fixture'))
 await page.waitForFunction(()=>document.querySelector('#catalog-export-scope')?.textContent.includes('Filtered results (0)'))
 check(true,'Navigation never retains a stale filtered count')
 const createSource=(count=1)=>{
  const t={...Object.fromEntries(Object.keys(TABLES).map(k=>[k,[]])),Guide:guideRows()}
  for(let n=0;n<count;n++) {t.Products.push({product_key:'new_'+n,title:'Merchant authored '+n,slug:'browser-import-'+randomUUID(),sku:'000'+randomUUID(),price:'29.95',selling_mode:'normal'});t.Variants.push({product_key:'new_'+n,entity_key:'option_'+n,name:'Default',code:'DEFAULT',sku:'000'+randomUUID(),is_active:true})}
  return t
 }
 const source=createSource(7),bytes=writeCsv(source)
 await transfer.locator('#catalog-import-warehouse').selectOption(f.warehouse);await inspect(bytes)
 check((await previewPane.innerText()).includes('7 new'),'Seven new products reviewed');await screenshot('en-1440-create-confirmation')
 await page.locator('[data-import-confirm]').check();loseBrowserResponse=true;await page.locator('[data-import-apply]').click();await transfer.getByRole('alert').waitFor();check(await page.locator('[data-import-status]').isEnabled(),'Unknown response keeps recovery available');await screenshot('en-1440-lost-response')
 await page.locator('[data-import-status]').click();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('5 succeeded'))
 check((await jobPane.innerText()).includes('2 pending'),'Exact partial commit report after lost response');await screenshot('en-1440-partial-results')
 await page.reload();await page.waitForFunction(()=>!!window.editorTest);await transfer.locator('#catalog-preview-file').waitFor();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('5 succeeded'));check(await page.locator('[data-import-apply]').isDisabled(),'Reload requires reupload, not retained source')
 await choose(bytes);await page.locator('[data-import-apply]').click();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('7 succeeded'));check((await jobPane.innerText()).includes('0 pending'),'Resume completes remaining products');await screenshot('en-1440-complete')
 for(const p of source.Products){const rows=(await rest.db.query('select is_published,stock_quantity,cost_price from public.products where slug=$1',[p.slug])).rows;check(rows.length===1&&!rows[0].is_published&&rows[0].stock_quantity===0&&Number(rows[0].cost_price)===0,'One Draft product, no stock/cost changes')}
 await resetReview();await transfer.locator('#catalog-import-warehouse').selectOption(f.warehouse);await choose(bytes);await transfer.getByRole('button',{name:labels.en.catalogTransfer.preview,exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('7 succeeded'));check((await jobPane.innerText()).includes('7 succeeded'),'Duplicate file returns completed receipt');check(await page.locator('[data-import-apply]').count()===0,'Completed import cannot repeat');await resetReview()
 const publication=createSource();publication.Products[0].is_published=true;await transfer.locator('#catalog-import-warehouse').selectOption(f.warehouse);await inspect(writeXlsx(publication),'xlsx');await page.locator('[data-import-confirm]').check();check(await page.locator('[data-import-apply]').isDisabled(),'Publication needs separate intent');await page.locator('[data-import-publish]').check();await screenshot('en-1440-publish-confirmation');await page.locator('[data-import-apply]').click();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('1 succeeded'));await resetReview()
 const invalid=createSource();invalid.Products[0].price='-1';await inspect(writeCsv(invalid));check(await jobPane.count()===0,'Invalid rows never stage approval');await screenshot('en-1440-invalid-row')
 const parsedStale=readCsv(csvBytes);const stale=Object.fromEntries(Object.entries(TABLES).map(([table,fields])=>[table,parsedStale[table].map(row=>Object.fromEntries(fields.map(field=>[field,semanticCell(row[field]||'').value])))]));stale.Guide=guideRows();stale.Products[0].title='Changed by import';await inspect(writeCsv(stale));await rest.db.query("update public.products set title='Concurrent administrator' where id=$1",[seed.id]);await page.locator('[data-import-confirm]').check();await page.locator('[data-import-apply]').click();await page.waitForFunction(()=>document.querySelector('[data-catalog-job]')?.textContent.includes('1 conflicted'));await screenshot('en-1440-conflict');await resetReview()
 await choose(Buffer.from('<html>invalid</html>'));await transfer.getByRole('button',{name:labels.en.catalogTransfer.preview,exact:true}).click();await transfer.getByRole('alert').waitFor();check((await transfer.getByRole('alert').innerText())===labels.en.catalogTransfer.structureError,'Malformed file error is understandable')
 await page.evaluate(()=>window.editorTest.actor.value='viewer');await page.waitForFunction(()=>!document.querySelector('#catalog-preview-file'));check(await page.locator('[data-import-apply]').count()===0,'Viewer sees no import mutation controls');check(await transfer.locator('#catalog-export-format').count()===1,'Viewer retains export access');await screenshot('en-1440-viewer-export')
 await page.evaluate(()=>window.editorTest.actor.value='editor');await transfer.locator('#catalog-preview-file').waitFor();await page.waitForFunction(()=>!document.querySelector('#catalog-preview-file')?.disabled);await rest.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.editor]);await choose(csvBytes);await transfer.getByRole('button',{name:labels.en.catalogTransfer.preview,exact:true}).click();await transfer.getByRole('alert').filter({hasText:labels.en.catalogTransfer.permission}).waitFor();check(true,'Revoked staff denied by server');await screenshot('en-1440-revoked')
 check(external.length===0,'No external requests');check(errors.length===0,'No unexpected browser errors: '+errors.join(';'))
 const report={assertions,screenshots:screens,errors,external,expectedLostResponses,downloads:'CSV/XLSX selected-page exports and templates',database:'Owned native PostgreSQL and PostgREST, real transfer/import/list/media handlers',limits:'Synthetic Auth verification and Nuxt shell. Real Vue components, Router and Chrome. Local acceptance only; no hosted or production access.'};await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
}catch(error){if(reviewPage){await writeFile(join(dir,'failure.json'),JSON.stringify({error:error.message,body:await reviewPage.locator('body').innerText(),rpcErrors:f?.controls.rpcErrors},null,2));await reviewPage.screenshot({path:join(dir,'failure.png'),fullPage:true})}throw error}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await empty?.close();await media?.close();await f?.close();await rest.close()}
