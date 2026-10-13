// Actual Vue Router transitions, product/specification/media components, product
// HTTP commands, PostgREST RLS, filesystem and native disposable SQL. Auth is synthetic.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer,request as httpRequest} from 'node:http'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript,compileStyle} from '@vue/compiler-sfc'
import {build} from 'esbuild'
import {createCatalogRestFixture} from '../tests/helpers/catalogRestFixture.mjs'
import {createProductSaveHttpFixture} from '../tests/helpers/productSaveHttpFixture.mjs'
import {createMediaFixture,pngImage} from '../tests/helpers/mediaFixture.mjs'
import {nativeWaitFor} from '../tests/helpers/emailNativeDatabase.mjs'
const base=resolve(new URL('..',import.meta.url).pathname)
const dir=process.env.PRODUCT_EDITOR_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-product-editor-browser'
await mkdir(dir,{recursive:true})
const {chromium}=await import(pathToFileURL(process.env.PRODUCT_SAVE_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const rest=await createCatalogRestFixture();let f,media,browser,server
try{
 const migrationDir=join(base,'supabase/migrations');for(const name of(await readdir(migrationDir)).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await rest.db.exec(await readFile(join(migrationDir,name),'utf8'))
 // Schema reference omits hosted baseline grants; match certified fixture table access.
 await rest.db.exec('grant select on public.commerce_warehouses,public.commerce_crm_accounts to authenticated')
 f=await createProductSaveHttpFixture({database:rest.db,closeDatabase:false});Object.assign(rest.actors,f.actors)
 media=await createMediaFixture({fixture:f})
 await nativeWaitFor(async()=>(await rest.request('/specification_definitions?select=id',{actor:'owner'})).status===200)
 const seed=await f.save(f.body({title:'Authored product',is_published:false}));const snapshot=await f.snapshot(seed.id)
 const definitions=(await rest.db.query('select id from public.specification_definitions order by name limit 2')).rows
 assert.equal(definitions.length,2)
 const specs=[];for(let i=0;i<2;i++)specs.push((await rest.db.query("insert into public.product_specifications(product_id,definition_id,label,value,sort_order) select $1,id,name,$2,$3 from public.specification_definitions where id=$4 returning id",[seed.id,'Known value '+i,i,definitions[i].id])).rows[0].id)
 const gallery=[];for(let i=0;i<2;i++){await media.addFile('products/gallery/saved-'+i+'.png');gallery.push((await rest.db.query("insert into public.product_images(product_id,variant_id,image_url,alt_text,sort_order) values($1,$2,$3,$4,$5) returning id",[seed.id,snapshot.variants[0].id,'/uploads/products/gallery/saved-'+i+'.png','Known alt '+i,i])).rows[0].id)}
 const components={Add:'app/pages/dashboard/products/add.vue',Edit:'app/pages/dashboard/products/edit/[id].vue',Variants:'app/components/dashboard/products/VariantsEditor.vue',SellingMode:'app/components/dashboard/products/SellingModeFields.vue',Warranty:'app/components/dashboard/products/WarrantyFields.vue',Specifications:'app/components/dashboard/products/SpecificationEditor.vue',Seo:'app/components/dashboard/SeoFields.vue',PageIntro:'app/components/dashboard/PageIntro.vue',MediaField:'app/components/dashboard/MediaUploadField.vue',MediaLibrary:'app/components/dashboard/MediaLibrary.vue'}
 let componentCss='';for(const[name,file]of Object.entries(components)){const{descriptor}=parse(await readFile(join(base,file),'utf8'));await writeFile(join(dir,name+'.js'),compileScript(descriptor,{id:'editor-'+name,inlineTemplate:true}).content);for(const style of descriptor.styles)componentCss+=compileStyle({source:style.content,filename:file,id:'data-v-editor-'+name,scoped:style.scoped}).code}
 const config={url:f.url,media:media.url,rest:rest.url,actors:f.actors,tokens:Object.fromEntries(['owner','editor','viewer','disabled','customer'].map(a=>[a,rest.token(a)])),product:seed.id,warehouse:f.warehouse,gallery,specs}
 await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,Suspense,resolveComponent,useId} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createRouter,createWebHistory,RouterView,useRoute,useRouter} from '${base}/node_modules/vue-router/dist/vue-router.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {PostgrestClient} from '${base}/node_modules/@supabase/postgrest-js/dist/index.mjs'
import {ofetch} from '${base}/node_modules/ofetch/dist/index.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useProductSave} from '${base}/app/composables/useProductSave.js'
import {useProductEditor} from '${base}/app/composables/useProductEditor.js'
import {useProductSection} from '${base}/app/composables/useProductSection.js'
import {useAdminUploads} from '${base}/app/composables/useAdminUploads.js'
import {useMediaErrors} from '${base}/app/composables/useMediaErrors.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
${Object.keys(components).map(name=>"import "+name+" from './"+name+".js'").join('\n')}
const config=${JSON.stringify(config)}
const state=new Map(),useState=(key,create)=>{if(!state.has(key))state.set(key,ref(create()));return state.get(key)}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}}),actor=ref('owner'),theme=ref('light'),erp=ref({mode:'built_in'}),generation=ref(0),invalidations=[]
const adminUser=computed(()=>({id:config.actors[actor.value]}))
const permissions=key=>actor.value==='owner'||actor.value==='editor'&&['products.view','products.add','products.edit'].includes(key)||actor.value==='viewer'&&key==='products.view'
let failSpecification=false,failLookup=false
const supabase={from(table){return new PostgrestClient(config.rest,{headers:{Authorization:'Bearer '+config.tokens[actor.value]},fetch:async(...args)=>{if(failSpecification&&table==='product_specifications'&&args[1]?.method==='PATCH'){failSpecification=false;return new Response(JSON.stringify({code:'23514',message:'Fixture validation failure'}),{status:400,headers:{'content-type':'application/json'}})}if(failLookup&&table==='commerce_warehouses')return new Response(JSON.stringify({code:'PGRST',message:'Fixture lookup failure'}),{status:503,headers:{'content-type':'application/json'}});return fetch(...args)}}).from(table)}}
const Dummy={render:()=>h('div',{'data-prerequisite':true},[h('p','Existing management route fixture'),h('a',{href:'/dashboard/products/add',onClick:e=>{e.preventDefault();router.push('/dashboard/products/add')}},'Return to product')])}
const router=createRouter({history:createWebHistory(),routes:[{path:'/dashboard/products/add',component:Add},{path:'/dashboard/products/edit/:id',component:Edit},{path:'/ar/dashboard/products/add',component:Add},{path:'/ar/dashboard/products/edit/:id',component:Edit},{path:'/:pathMatch(.*)*',component:Dummy}]})
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}
watch([theme,i18n.global.locale],appearance);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',appearance)
Object.assign(globalThis,{ref,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,resolveComponent,useId,useState,useUiLocale,useProductSave,useProductEditor,useProductSection,useAdminUploads,useMediaErrors,definePageMeta(){},useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useUiRoute:()=>router.currentRoute.value,useRouter,useSupabaseClient:()=>supabase,useNuxtData:()=>({data:erp}),useSiteContent:()=>({data:ref({settings:{}})}),useRuntimeConfig:()=>({public:{siteUrl:'https://fixture.example.invalid'}}),useDashboardLayout:()=>({dashboardLayout:ref('standard')}),
 useAdminAccess:()=>({adminUser,hasPermission:permissions}),useAdminLogs:()=>({getAdminAuthHeaders:async()=>({authorization:'Bearer '+actor.value}),recordAdminLog:async()=>{}}),
 useDashboardCache:()=>({getSnapshot:()=>null,isFresh:()=>false,setSnapshot(){},invalidate:p=>invalidations.push(p)}),
 useAsyncData:async(_key,loader)=>{const data=ref(null),error=ref(null),pending=ref(false);const refresh=async()=>{pending.value=true;try{data.value=await loader();error.value=null}catch(e){error.value=e}finally{pending.value=false}};await refresh();return{data,error,pending,refresh}},
 useUiNavigation:()=>({uiNavigateTo:to=>router.push(to)}),$fetch:(path,options)=>ofetch((path.startsWith('/api/admin-gallery')||path.startsWith('/api/admin-uploads')?'':config.url)+path,{...options,retry:0})})
const app=createApp({render:()=>h('div',{class:'dashboard-modern p-4'},h(RouterView,null,{default:({Component,route})=>h(Suspense,null,{default:()=>h(Component,{key:route.path+generation.value})})}))})
app.use(i18n);app.use(router);const ui=useUiLocale();app.config.globalProperties.$uiLabel=ui.uiLabel;app.config.globalProperties.$uiMessage=ui.uiMessage
for(const[name,component]of Object.entries({DashboardProductsVariantsEditor:Variants,DashboardProductsSellingModeFields:SellingMode,DashboardProductsWarrantyFields:Warranty,DashboardProductsSpecificationEditor:Specifications,DashboardPageIntro:PageIntro,DashboardSeoFields:Seo,DashboardMediaUploadField:MediaField,DashboardMediaLibrary:MediaLibrary}))app.component(name,component)
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}})
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots,attrs}){return()=>h('a',{...attrs,href:props.to,onClick:e=>{if(attrs.onClick)attrs.onClick(e);if(!e.defaultPrevented){e.preventDefault();router.push(props.to)}}},slots.default?.())}})
router.isReady().then(()=>{app.mount('#app');appearance()})
window.editorTest={config,actor,theme,erp,locale:i18n.global.locale,state,router,appearance,failSpecification:()=>failSpecification=true,failLookup:value=>failLookup=value,async show(path){await router.push(path);generation.value++;await nextTick()}}
`)
 await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'process.env.NODE_ENV':'"test"','import.meta.client':'true','__VUE_OPTIONS_API__':'true','__VUE_PROD_DEVTOOLS__':'false','__VUE_PROD_HYDRATION_MISMATCH_DETAILS__':'false'}})
 const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(n=>n.endsWith('.css')).map(n=>readFile(join(base,'.output/public/_nuxt',n),'utf8')))).join('\n')+componentCss
 server=createServer(async(req,res)=>{if(req.url.startsWith('/api/admin-gallery')||req.url.startsWith('/api/admin-uploads')){const proxy=httpRequest(media.url+req.url,{method:req.method,headers:{...req.headers,host:new URL(media.url).host}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});proxy.on('error',()=>{res.statusCode=503;res.end()});req.pipe(proxy);return}if(req.url.startsWith('/uploads/')){const response=await fetch(media.url+req.url);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return}res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(dir,'bundle.js')):'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],external=[],expectedNetworkErrors=[];let assertions=0,screens=0,loseSectionResponse=false,failSnapshot=false,holdUpload=false,releaseUpload=null
 const check=(value,message)=>{assert.ok(value,message);assertions++}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('net::ERR_FAILED')){expectedNetworkErrors.push(m.text());return}if(m.type()==='error'&&!/server responded with a status of (400|401|403|409|503)\b/.test(m.text()))errors.push(m.text())})
 await page.route('**/*',async route=>{if(![url,f.url,rest.url,media.url].some(origin=>route.request().url().startsWith(origin+'/'))){external.push(route.request().url());await route.abort();return}if(holdUpload&&route.request().url().startsWith(url+'/api/admin-uploads')){holdUpload=false;await new Promise(resolve=>releaseUpload=resolve);await route.continue();return}if(loseSectionResponse&&route.request().url().startsWith(rest.url+'/product_images')&&route.request().method()==='PATCH'){loseSectionResponse=false;await route.fetch();await route.abort('failed');return}if(failSnapshot&&route.request().url().startsWith(f.url+'/api/admin-products/')&&route.request().method()==='GET'){failSnapshot=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({statusCode:503,statusMessage:'Fixture snapshot outage'})});return}await route.continue()})
 const labels=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile(join(base,'i18n/locales/'+l+'.json'),'utf8'))])))
 const editPath='/dashboard/products/edit/'+seed.id
 const show=async path=>{await page.evaluate(path=>window.editorTest.show(path),path);await page.locator('form fieldset').first().waitFor();await page.waitForFunction(()=>!!document.querySelector('form button[type=submit]:not(:disabled)'))}
 const main=()=>page.locator('form').first(),save=()=>main().locator('button[type=submit]')
 const saved=async()=>page.waitForFunction(()=>document.querySelector('[data-product-save-state]')?.innerText.includes(window.editorTest.locale.value==='ar'?'تم الحفظ':'Saved'))
 await page.goto(url+'/dashboard/products/add');await page.waitForFunction(()=>!!window.editorTest)
 for(const language of['en','ar'])for(const width of[390,768,1440])for(const theme of['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'});await page.evaluate(({language,theme})=>{const s=window.editorTest;s.locale.value=language;s.theme.value=theme;s.appearance()},{language,theme})
  for(const path of['/dashboard/products/add',editPath]){await show(path);check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'Locale direction');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow');check(!(await page.locator('body').innerText()).includes('productEditor.'),'Editor messages translated');await page.screenshot({path:join(dir,`${language}-${width}-${theme}-${path.includes('edit')?'edit':'add'}.png`),fullPage:true});screens++}
 }
 await page.evaluate(()=>{window.editorTest.locale.value='en';window.editorTest.theme.value='light'})
 await show('/dashboard/products/add');check(await page.getByText(labels.en.productEditor.draft,{exact:true}).count()===1,'New form starts Draft')
 await page.locator('#product-title').fill('Unsaved authored title')
 page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:labels.en.common.back,exact:true}).click();check(await page.locator('#product-title').inputValue()==='Unsaved authored title','Cancelled editor link preserves input');check(page.url().endsWith('/dashboard/products/add'),'Cancelled link stays in editor')
 page.once('dialog',d=>d.dismiss());await page.evaluate(()=>window.editorTest.router.push('/dashboard/products'));check(page.url().endsWith('/dashboard/products/add'),'Cancelled route transition stays')
 const unload=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented});check(unload,'Browser unload is protected while dirty')
 const nativeDialog=page.waitForEvent('dialog',{timeout:5000});const refresh=page.evaluate(()=>location.reload()).catch(()=>{})
 const warning=await nativeDialog;check(warning.type()==='beforeunload','Native refresh warning is supported');await warning.dismiss();await refresh
 check(await page.locator('#product-title').inputValue()==='Unsaved authored title','Cancelled refresh preserves input')
 const closeDialog=page.waitForEvent('dialog',{timeout:5000});const closeAttempt=page.close({runBeforeUnload:true})
 const closing=await closeDialog;check(closing.type()==='beforeunload','Native tab-close warning is supported');await closing.dismiss();await closeAttempt
 check(!page.isClosed(),'Cancelled tab close keeps the editor')
 page.once('dialog',d=>d.accept());await page.getByRole('link',{name:labels.en.common.back,exact:true}).click();await page.locator('[data-prerequisite]').waitFor();check(page.url().endsWith('/dashboard/products'),'Deliberate discard leaves')
 // Real history back/forward with active router guard.
 await show('/dashboard/products/add');await page.locator('#product-title').fill('History draft');page.once('dialog',d=>d.dismiss());await page.evaluate(()=>history.back());await page.waitForTimeout(100);check(page.url().endsWith('/dashboard/products/add'),'Back cancellation restores current route');page.once('dialog',d=>d.accept());await page.evaluate(()=>history.back());await page.locator('[data-prerequisite]').waitFor();await page.evaluate(()=>history.forward());await page.locator('#product-title').waitFor();check(await page.locator('#product-title').inputValue()==='','Confirmed history discard clears draft')
 // Existing prerequisites remain optional; fresh lookups and in-memory restoration.
 await rest.db.exec('update public.products set category_id=null,brand_id=null');await rest.db.exec('delete from public.categories');await rest.db.exec('delete from public.brands');await show('/dashboard/products/add');await page.locator('#product-title').fill('Retained input');await page.locator('#product-price').fill('100.25');await page.getByRole('link',{name:labels.en.productEditor.createCategory,exact:true}).click();await page.locator('[data-prerequisite]').waitFor();check(page.url().endsWith('/dashboard/products/categories'),'Contextual category route opens');await page.getByRole('link',{name:'Return to product',exact:true}).click();await page.locator('#product-title').waitFor();await page.waitForFunction(()=>!document.querySelector('#product-title').disabled);check(await page.locator('#product-title').inputValue()==='Retained input','Prerequisite visit restores typed details');check(await page.locator('#product-price').inputValue()==='100.25','Prerequisite visit restores price')
 await page.locator('#product-slug').fill('browser-editor-'+crypto.randomUUID());await page.locator('#product-primary_warehouse_id').selectOption(f.warehouse);await save().click();await page.waitForURL('**/dashboard/products/edit/*');check(!(await rest.db.query("select is_published from public.products where slug like 'browser-editor-%'")).rows[0].is_published,'Created product is a draft in actual SQL');check(!await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented}),'No warning after successful create')
 // No active warehouse: retain input, explain the requirement, create nothing.
 await rest.db.exec('update public.commerce_warehouses set is_active=false');await show('/dashboard/products/add')
 await page.locator('#product-title').fill('Empty warehouse draft');await page.locator('#product-price').fill('50.00')
 check(await page.getByText(labels.en.productEditor.noWarehouse,{exact:false}).count()===1,'Missing warehouse explained')
 check(await page.getByRole('link',{name:labels.en.productEditor.createWarehouse,exact:true}).count()===1,'Existing warehouse creation link shown')
 const beforeEmpty=await f.counts();await save().click();await page.locator('#product-primary_warehouse_id-error').waitFor();check((await f.counts()).products===beforeEmpty.products,'Missing warehouse creates no partial product')
 check(await page.locator('#product-title').inputValue()==='Empty warehouse draft','Missing prerequisite retains authored input')
 page.once('dialog',d=>d.accept());await page.evaluate(()=>window.editorTest.router.push('/dashboard/products'));await rest.db.exec('update public.commerce_warehouses set is_active=true')
 // Explicit visibility and saving main details keeps unrelated section drafts.
 await show(editPath);await page.locator('[data-specification-save-state]').waitFor();await page.locator('input[aria-label="Specification 1 value"]').waitFor()
 await page.getByRole('button',{name:labels.en.common.storeVisibility,exact:true}).click();await save().click();await saved();check((await f.snapshot(seed.id)).product.is_published,true,'Explicit publication saved');check(page.url().endsWith(editPath),'Main save stays in editor')
 const alt=page.getByPlaceholder(labels.en.common.altText,{exact:true});await alt.nth(1).fill('Unsaved gallery A');await alt.nth(2).fill('Unsaved gallery B')
 await page.locator('input[aria-label="Specification 1 value"]').fill('Unsaved spec A');await page.locator('input[aria-label="Specification 2 value"]').fill('Unsaved spec B')
 await page.locator('#product-title').fill('Saved main title');await save().click();await saved();check(await alt.nth(1).inputValue()==='Unsaved gallery A','Core save keeps gallery draft');check(await page.locator('input[aria-label="Specification 2 value"]').inputValue()==='Unsaved spec B','Core save keeps spec draft')
 const imageRow=page.locator('select[id="image-variant-'+gallery[0]+'"]').locator('xpath=../..').locator('xpath=..');await imageRow.getByRole('button',{name:labels.en.common.save,exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-gallery-save-state]')?.innerText.includes('Unsaved changes'));check((await rest.db.query('select alt_text from public.product_images where id=$1',[gallery[0]])).rows[0].alt_text==='Unsaved gallery A','Gallery row saved');check(await alt.nth(2).inputValue()==='Unsaved gallery B','Other gallery draft retained')
 const specRow=page.locator('input[aria-label="Specification 1 value"]').locator('xpath=../..');await page.evaluate(()=>window.editorTest.failSpecification());await specRow.getByRole('button',{name:labels.en.common.save,exact:true}).click();await page.getByText(labels.en.productEditor.sectionFailed,{exact:true}).waitFor();check(await page.locator('input[aria-label="Specification 1 value"]').inputValue()==='Unsaved spec A','Failed spec input retained');check((await f.snapshot(seed.id)).product.title==='Saved main title','Main save survives section failure');check((await rest.db.query('select alt_text from public.product_images where id=$1',[gallery[0]])).rows[0].alt_text==='Unsaved gallery A','Gallery save survives section failure')
 await specRow.getByRole('button',{name:labels.en.common.save,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-specification-save-state]').closest('section').querySelector('fieldset').disabled && !document.querySelector('[data-specification-save-state]').innerText.includes('Save failed'));check((await rest.db.query('select value from public.product_specifications where id=$1',[specs[0]])).rows[0].value==='Unsaved spec A','Spec retry saves');check(await page.locator('input[aria-label="Specification 2 value"]').inputValue()==='Unsaved spec B','Other spec row retained')
 await rest.db.query('update public.product_images set alt_text=$1 where id=$2',['Another administrator alt',gallery[1]]);const imageRow2=page.locator('select[id="image-variant-'+gallery[1]+'"]').locator('xpath=../../..');await imageRow2.getByRole('button',{name:labels.en.common.save,exact:true}).click();await page.getByText(labels.en.productEditor.sectionConflict,{exact:true}).waitFor();check(await alt.nth(2).inputValue()==='Unsaved gallery B','Stale gallery input retained');check((await rest.db.query('select alt_text from public.product_images where id=$1',[gallery[1]])).rows[0].alt_text==='Another administrator alt','Gallery CAS preserves other admin')
 await rest.db.query('update public.product_specifications set value=$1 where id=$2',['Another administrator spec',specs[1]]);const specRow2=page.locator('input[aria-label="Specification 2 value"]').locator('xpath=../..');await specRow2.getByRole('button',{name:labels.en.common.save,exact:true}).click();await page.locator('[aria-labelledby=product-specification-editor-heading]').getByText(labels.en.productEditor.sectionConflict,{exact:true}).waitFor();check((await rest.db.query('select value from public.product_specifications where id=$1',[specs[1]])).rows[0].value==='Another administrator spec','Spec CAS preserves other admin')
 page.once('dialog',d=>d.dismiss());await page.evaluate(()=>window.editorTest.router.push('/dashboard/products'));check(page.url().endsWith(editPath),'Section drafts protect route leave')
 page.once('dialog',d=>d.accept());await page.evaluate(()=>window.editorTest.router.push('/dashboard/products'));await page.locator('[data-prerequisite]').waitFor();await show(editPath);check(!await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented}),'Fresh editor is clean')
 // Pending main/SEO/gallery uploads cannot race section saves or route departure.
 for(const [index,name]of [[0,'main'],[1,'seo']]){
  holdUpload=true;releaseUpload=null;await main().locator('input[type=file]').nth(index).setInputFiles({name:'authored-'+name+'.png',mimeType:'image/png',buffer:pngImage()})
  await nativeWaitFor(async()=>typeof releaseUpload==='function');check(await save().isDisabled(),name+' upload blocks core save')
  const writes=f.controls.writes;await main().evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));check(f.controls.writes===writes,'No core command before '+name+' upload completes')
  check(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented}),name+' upload protects browser unload')
  const beforeUrl=page.url();await page.evaluate(()=>window.editorTest.router.push('/dashboard/products'));check(page.url()===beforeUrl,name+' upload blocks route departure')
  releaseUpload();await page.waitForFunction(()=>!document.querySelector('form button[type=submit]').disabled);await save().click();await saved()
  const uploaded=(await f.snapshot(seed.id)).product[name==='main'?'image_url':'seo_image_url'];check(uploaded.startsWith('/uploads/products/'),name+' uploaded URL is retained in the saved product')
 }
 holdUpload=true;releaseUpload=null
 const gallerySection=page.locator('[data-gallery-save-state]').locator('xpath=..')
 await gallerySection.locator('input[type=file]').nth(1).setInputFiles({name:'authored-gallery.png',mimeType:'image/png',buffer:pngImage()});await nativeWaitFor(async()=>typeof releaseUpload==='function')
 const uploadingRow=page.locator('select[id="image-variant-'+gallery[0]+'"]').locator('xpath=../../..');check(await uploadingRow.getByRole('button',{name:labels.en.common.save,exact:true}).isDisabled(),'Gallery upload blocks row save')
 releaseUpload();await page.waitForFunction(()=>!document.querySelector('[data-gallery-save-state]').closest('section').querySelector('fieldset').disabled)
 await uploadingRow.getByRole('button',{name:labels.en.common.save,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-gallery-save-state]').closest('section').querySelector('fieldset').disabled)
 check((await rest.db.query('select image_url from public.product_images where id=$1',[gallery[0]])).rows[0].image_url.startsWith('/uploads/products/gallery/'),'Gallery uploaded URL survives its save')
 // A lost section acknowledgement cannot produce an automatic duplicate retry.
 await page.getByPlaceholder(labels.en.common.altText,{exact:true}).nth(1).fill('Unconfirmed gallery text');loseSectionResponse=true
 const unknownRow=page.locator('select[id="image-variant-'+gallery[0]+'"]').locator('xpath=../../..');await unknownRow.getByRole('button',{name:labels.en.common.save,exact:true}).click()
 await page.getByText(labels.en.productEditor.sectionUnknown,{exact:true}).waitFor();check(await unknownRow.getByRole('button',{name:labels.en.common.save,exact:true}).isDisabled(),'Unknown section blocks resubmission')
 check((await rest.db.query('select alt_text from public.product_images where id=$1',[gallery[0]])).rows[0].alt_text==='Unconfirmed gallery text','Lost section response committed exactly one update')
 const reloadGallery=page.locator('[data-gallery-save-state]').locator('xpath=..').getByRole('button',{name:labels.en.productSave.reload,exact:true})
 page.once('dialog',d=>d.dismiss());await reloadGallery.click();check(await page.getByPlaceholder(labels.en.common.altText,{exact:true}).nth(1).inputValue()==='Unconfirmed gallery text','Section reload cancellation retains input')
 page.once('dialog',d=>d.accept());await reloadGallery.click();await page.waitForFunction(()=>!document.querySelector('[data-gallery-save-state]').closest('section').querySelector('fieldset').disabled);check(await unknownRow.getByRole('button',{name:labels.en.common.save,exact:true}).isDisabled(),'Reload reconciles the saved section baseline')
 // Confirmed core writes survive a failed refresh without unmounting sections.
 await page.locator('input[aria-label="Specification 2 value"]').fill('Retained refresh failure spec');await page.locator('#product-title').fill('Known core save');failSnapshot=true;await save().click();await page.getByText(labels.en.productEditor.refreshFailed,{exact:true}).waitFor()
 check((await f.snapshot(seed.id)).product.title==='Known core save','Core save remains committed after refresh failure');check(await page.locator('input[aria-label="Specification 2 value"]').inputValue()==='Retained refresh failure spec','Refresh failure preserves section input');check(await save().isDisabled(),'Further core save waits for current snapshot')
 page.once('dialog',d=>d.accept());await main().getByRole('button',{name:labels.en.productSave.reload,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#product-title').disabled)
 check(await page.locator('input[aria-label="Specification 2 value"]').inputValue()==='Retained refresh failure spec','Core reload preserves independent section input')
 page.once('dialog',d=>d.accept());await page.evaluate(()=>window.editorTest.router.push('/dashboard/products'));await show(editPath)
 // Returning from prerequisites retains the loaded revision, not a newer authority.
 await page.locator('#product-title').fill('Retained edit draft');await page.getByRole('link',{name:labels.en.productEditor.createCategory,exact:true}).click();await page.locator('[data-prerequisite]').waitFor()
 await rest.db.query('update public.products set title=$1 where id=$2',['Concurrent prerequisite edit',seed.id]);await show(editPath)
 check(await page.locator('#product-title').inputValue()==='Retained edit draft','Edit prerequisite visit restores input')
 await save().click();await page.getByText(labels.en.productSave.errors.conflict,{exact:true}).waitFor();check((await f.snapshot(seed.id)).product.title==='Concurrent prerequisite edit','Retained stale revision cannot overwrite another admin')
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:labels.en.productSave.reload,exact:true}).click();check(await page.locator('#product-title').inputValue()==='Retained edit draft','Conflict reload cancellation keeps restored draft')
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:labels.en.productSave.reload,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[role=alert]'))
 // Access and ERP controls use existing form permissions; server enforcement is tested separately.
 await page.evaluate(()=>window.editorTest.actor.value='viewer');check(await save().isDisabled(),'Viewer save disabled');check(await page.locator('#product-title').isDisabled(),'Viewer fields disabled');check(await page.locator('section fieldset').first().evaluate(field=>field.disabled),'Viewer section controls disabled')
 await page.evaluate(()=>{window.editorTest.actor.value='owner';window.editorTest.erp.value={mode:'daftra'}});check(await page.locator('#product-primary_warehouse_id').isDisabled(),'Daftra warehouse edit disabled')
 // Existing legacy deletion remains deliberate and does not prompt after its successful write.
 const legacy=crypto.randomUUID();await rest.db.exec("select set_config('app.serialized_inventory_write','on',false)")
 await rest.db.query("insert into public.products(id,title,slug,price,is_serialized,is_published,stock_quantity) values($1,'Historical legacy fixture',$2,5,false,false,0)",[legacy,'legacy-'+legacy]);await rest.db.exec("select set_config('app.serialized_inventory_write','off',false)")
 await page.evaluate(()=>{window.editorTest.actor.value='owner';window.editorTest.erp.value={mode:'built_in'}});await show('/dashboard/products/edit/'+legacy);await page.locator('#product-title').fill('Deliberately discarded legacy edit')
 let deleteDialogs=0;const acceptDelete=dialog=>{deleteDialogs++;dialog.accept()};page.on('dialog',acceptDelete)
 await main().getByRole('button',{name:labels.en.common.deleteProduct,exact:true}).click();await page.waitForURL('**/dashboard/products');page.off('dialog',acceptDelete)
 check(deleteDialogs===1,'Successful deliberate deletion has no later discard prompt');check((await rest.db.query('select id from public.products where id=$1',[legacy])).rows.length===0,'Confirmed legacy delete removed only its selected record')
 check(expectedNetworkErrors.length===1,'Only one deliberately lost section response');check(errors.length===0,'No unexpected browser errors: '+errors.join(';'));check(external.length===0,'No external requests')
 const report={assertions,screenshots:screens,errors,external,deliberatelyDroppedResponses:1,expectedNetworkErrors:expectedNetworkErrors.length,database:'actual native PostgreSQL and PostgREST',router:'actual browser history and Vue Router',limits:'Synthetic Auth verification/claims and surrounding Nuxt/ERP state; prerequisite pages are fixtures. No hosted or production acceptance.'};await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await media?.close();await f?.close();await rest.close()}
