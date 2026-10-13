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
import {seedListing} from '../tests/helpers/productListFixture.mjs'
import {nativeWaitFor} from '../tests/helpers/emailNativeDatabase.mjs'
const base=resolve(new URL('..',import.meta.url).pathname)
const dir=process.env.PRODUCT_LIST_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-product-list-browser'
await mkdir(dir,{recursive:true})
const {chromium}=await import(pathToFileURL(process.env.PRODUCT_SAVE_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const rest=await createCatalogRestFixture();let f,media,browser,server,empty
try{
 const migrationDir=join(base,'supabase/migrations');for(const name of(await readdir(migrationDir)).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await rest.db.exec(await readFile(join(migrationDir,name),'utf8'))
 // Schema reference omits hosted baseline grants; match certified fixture table access.
 await rest.db.exec('grant select on public.commerce_warehouses,public.commerce_crm_accounts to authenticated')
 f=await createProductSaveHttpFixture({database:rest.db,closeDatabase:false});Object.assign(rest.actors,f.actors)
 media=await createMediaFixture({fixture:f})
 empty=await createProductSaveHttpFixture();await empty.db.exec('delete from public.categories;delete from public.brands')
 await nativeWaitFor(async()=>(await rest.request('/specification_definitions?select=id',{actor:'owner'})).status===200)
 const seed=await f.save(f.body({title:'Authored product',is_published:false}));const snapshot=await f.snapshot(seed.id)
 const definitions=(await rest.db.query('select id from public.specification_definitions order by name limit 2')).rows
 assert.equal(definitions.length,2)
 const specs=[];for(let i=0;i<2;i++)specs.push((await rest.db.query("insert into public.product_specifications(product_id,definition_id,label,value,sort_order) select $1,id,name,$2,$3 from public.specification_definitions where id=$4 returning id",[seed.id,'Known value '+i,i,definitions[i].id])).rows[0].id)
 const gallery=[];for(let i=0;i<2;i++){await media.addFile('products/gallery/saved-'+i+'.png');gallery.push((await rest.db.query("insert into public.product_images(product_id,variant_id,image_url,alt_text,sort_order) values($1,$2,$3,$4,$5) returning id",[seed.id,snapshot.variants[0].id,'/uploads/products/gallery/saved-'+i+'.png','Known alt '+i,i])).rows[0].id)}
 const listingSeed=await seedListing(f,360)
 await media.addFile('products/list-thumbnail.png');await rest.db.query("update public.products set image_url='/uploads/products/list-thumbnail.png' where title like 'Listing product %'")
 const components={Listing:'app/pages/dashboard/products/index.vue',ListFilter:'app/components/dashboard/products/ListFilter.vue',Add:'app/pages/dashboard/products/add.vue',Edit:'app/pages/dashboard/products/edit/[id].vue',Variants:'app/components/dashboard/products/VariantsEditor.vue',SellingMode:'app/components/dashboard/products/SellingModeFields.vue',Warranty:'app/components/dashboard/products/WarrantyFields.vue',Specifications:'app/components/dashboard/products/SpecificationEditor.vue',Seo:'app/components/dashboard/SeoFields.vue',PageIntro:'app/components/dashboard/PageIntro.vue',MediaField:'app/components/dashboard/MediaUploadField.vue',MediaLibrary:'app/components/dashboard/MediaLibrary.vue'}
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
const router=createRouter({history:createWebHistory(),routes:[{path:'/dashboard/products',component:Listing},{path:'/ar/dashboard/products',component:Listing},{path:'/dashboard/products/add',component:Add},{path:'/dashboard/products/edit/:id',component:Edit},{path:'/ar/dashboard/products/add',component:Add},{path:'/ar/dashboard/products/edit/:id',component:Edit},{path:'/:pathMatch(.*)*',component:Dummy}]})
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
window.editorTest={config,actor,theme,erp,locale:i18n.global.locale,state,router,appearance,failSpecification:()=>failSpecification=true,failLookup:value=>failLookup=value,holdNextList:()=>delayedList=true,emptyMode:value=>emptyMode=value,async show(path){await router.push(path);generation.value++;await nextTick()}}
`)
 await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],plugins:[{name:'compiled-list-filter',setup(b){b.onResolve({filter:/ListFilter\.vue$/},()=>({path:join(dir,'ListFilter.js')}))}}],define:{'process.env.NODE_ENV':'"test"','import.meta.client':'true','__VUE_OPTIONS_API__':'true','__VUE_PROD_DEVTOOLS__':'false','__VUE_PROD_HYDRATION_MISMATCH_DETAILS__':'false'}})
 const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(n=>n.endsWith('.css')).map(n=>readFile(join(base,'.output/public/_nuxt',n),'utf8')))).join('\n')+componentCss
 server=createServer(async(req,res)=>{if(req.url.startsWith('/api/admin-gallery')||req.url.startsWith('/api/admin-uploads')){const proxy=httpRequest(media.url+req.url,{method:req.method,headers:{...req.headers,host:new URL(media.url).host}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});proxy.on('error',()=>{res.statusCode=503;res.end()});req.pipe(proxy);return}if(req.url.startsWith('/uploads/')){const response=await fetch(media.url+req.url);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return}res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(dir,'bundle.js')):'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],external=[];let assertions=0,screens=0,failList=false,oversizeList=false
 const check=(value,message)=>{assert.ok(value,message);assertions++}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/server responded with a status of (400|401|403|409|503)\b/.test(m.text()))errors.push(m.text())})
 const listRequests=[];page.on('request',r=>{if(r.url().startsWith(f.url+'/api/admin-products/list'))listRequests.push(r.url())})
 await page.route('**/*',async route=>{
  if(![url,f.url,rest.url,media.url,empty.url].some(origin=>route.request().url().startsWith(origin+'/'))){external.push(route.request().url());await route.abort();return}
  if(route.request().url().startsWith(f.url+'/api/admin-products/list')&&failList){failList=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({statusCode:503,statusMessage:'Fixture listing outage'})});return}
  if(route.request().url().startsWith(f.url+'/api/admin-products/list')&&oversizeList){oversizeList=false;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:Array.from({length:26},(_,i)=>({id:String(i)})),total:26,page:1,page_size:25,catalog_total:26})});return}
  await route.continue()
 })
 const labels=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile(join(base,'i18n/locales/'+l+'.json'),'utf8'))])))
 const waitList=async()=>{try{await page.locator('table tbody tr').first().waitFor();await page.waitForFunction(()=>document.querySelector('[aria-busy]')?.getAttribute('aria-busy')==='false')}catch(error){await writeFile(join(dir,'failure.json'),JSON.stringify({url:page.url(),body:await page.locator('body').innerText(),errors,requests:listRequests,rpcErrors:f.controls.rpcErrors},null,2));await page.screenshot({path:join(dir,'failure.png')});throw error}}
 const show=async path=>{await page.evaluate(path=>window.editorTest.show(path),path);await waitList()}
 const screenshot=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true});screens++}
 await page.goto(url+'/dashboard/products?q=Listing+product');await page.waitForFunction(()=>!!window.editorTest);await waitList()
 for(const language of ['en','ar'])for(const width of [390,768,1440])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'})
  await page.evaluate(({language,theme})=>{const s=window.editorTest;s.locale.value=language;s.theme.value=theme;s.appearance()},{language,theme})
  await show((language==='ar'?'/ar':'')+'/dashboard/products?q=Listing+product')
  check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'Correct EN/AR direction')
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')
  check(await page.locator('table tbody tr').count()===25,'Only one bounded page renders')
  check(await page.locator('#product-search').inputValue()==='Listing product','Search initialized from URL')
  check(!(await page.locator('body').innerText()).includes('productList.'),'Listing messages translated')
  check((await page.locator('table').innerText()).includes('LIST-PARENT-'),'SKU is visible')
  check(await page.locator('thead').isVisible()===(width>=1024),'Mobile uses compact rows')
  await screenshot(`${language}-${width}-${theme}-listing`);if(width===390&&theme==='light'||width===1440&&theme==='dark'){await page.screenshot({path:join(dir,`${language}-${width}-${theme}-viewport.png`)});screens++}
 }
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{window.editorTest.locale.value='en';window.editorTest.theme.value='light';window.editorTest.appearance()})
 const listPath='/dashboard/products?'+new URLSearchParams({q:'Listing product',status:'drafts',category:f.category,brand:f.brand,mode:'coming_soon',stock:'out_of_stock',sort:'price_desc',page:'2'})
 await show(listPath)
 for(const [selector,value] of [['#product-status','drafts'],['#product-filter-category',f.category],['#product-filter-brand',f.brand],['#product-mode','coming_soon'],['#product-stock','out_of_stock'],['#product-sort','price_desc']])check(await page.locator(selector).inputValue()===value,'All URL filters hydrate')
 check(new URL(page.url()).searchParams.get('page')==='2','Filtered page is preserved')
 const firstId=await page.locator('table tbody tr').first().getAttribute('data-product-id')
 await page.locator('table').getByRole('link',{name:labels.en.productList.edit,exact:true}).first().click()
 await page.locator('#product-title').waitFor();await page.waitForFunction(()=>!!document.querySelector('form button[type=submit]:not(:disabled)'))
 check(new URL(page.url()).searchParams.get('returnTo')===listPath,'Editor carries the exact listing context')
 await page.getByRole('link',{name:labels.en.common.back,exact:true}).click();await waitList()
 check(new URL(page.url()).pathname+new URL(page.url()).search===listPath,'Editor Back restores all filters and page')
 await page.locator('table').getByRole('link',{name:labels.en.productList.edit,exact:true}).first().click();await page.locator('#product-title').waitFor()
 await page.evaluate(()=>history.back());await waitList();check(new URL(page.url()).searchParams.get('page')==='2','Browser Back preserves page')
 await page.evaluate(()=>history.forward());await page.locator('#product-title').waitFor();check(page.url().includes('/edit/'+firstId),'Browser Forward reopens the product')
 await page.waitForFunction(()=>!!document.querySelector('form button[type=submit]:not(:disabled)'))
 const originalTitle=await page.locator('#product-title').inputValue();await page.locator('#product-title').fill(originalTitle+' updated')
 await page.locator('form').first().locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-product-save-state]')?.innerText.includes('Saved'))
 await page.getByRole('link',{name:labels.en.common.back,exact:true}).click();await waitList()
 check((await page.locator('table').innerText()).includes(originalTitle+' updated'),'Returning after a save revalidates current data')
 check(new URL(page.url()).searchParams.get('page')==='2','Save and return keeps the page')
 await page.getByRole('button',{name:labels.en.common.previous,exact:true}).click();await waitList();check(new URL(page.url()).searchParams.get('page')===null,'Previous page updates the URL')
 await page.evaluate(()=>history.back());await waitList();check(new URL(page.url()).searchParams.get('page')==='2','History restores pagination')
 await page.locator('#product-sort').selectOption('price_asc');await waitList();check(new URL(page.url()).searchParams.get('page')===null,'Sorting resets to the first page')
 // Actual Add form, command transaction and post-create route retain context.
 await show(listPath);await page.getByRole('link',{name:labels.en.common.addProduct,exact:true}).click();await page.locator('#product-title').waitFor();await page.waitForFunction(()=>!!document.querySelector('form button[type=submit]:not(:disabled)'))
 await page.locator('#product-title').fill('Authored browser draft');await page.locator('#product-price').fill('9.99');await page.locator('#product-primary_warehouse_id').selectOption(f.warehouse)
 const before=(await f.counts()).products;await page.locator('form button[type=submit]').click();await page.waitForURL('**/dashboard/products/edit/**');await page.locator('#product-title').waitFor()
 check((await f.counts()).products===before+1,'Create writes one draft through the existing atomic API')
 check(new URL(page.url()).searchParams.get('returnTo')===listPath,'Create-to-edit keeps listing context')
 const createdId=new URL(page.url()).pathname.split('/').at(-1);check((await f.snapshot(createdId)).product.is_published===false,'Creation remains draft-first')
 await page.getByRole('link',{name:labels.en.common.back,exact:true}).click();await waitList();check(new URL(page.url()).searchParams.get('page')==='2','New product Back retains filtered page')
 // Ordinary requests remain cancellable. One controlled transport ignores abort
 // so the request-generation guard must reject its genuinely older HTTP result.
 await show('/dashboard/products?q=Listing+product');const requestsBefore=listRequests.length
 await page.locator('#product-search').fill('x');await page.locator('#product-search').fill('xy');await page.locator('#product-search').fill('product 119');await waitList()
 check(listRequests.length===requestsBefore+1,'Fast typing produces one debounced request')
 check(await page.locator('table tbody tr').count()===1,'Search returns one authoritative match')
 await page.evaluate(()=>window.editorTest.holdNextList());await page.locator('#product-search').fill('VARIANT-SKU-117');await page.waitForFunction(()=>typeof window.releaseStaleList==='function')
 await page.locator('#product-search').fill('product 118');await waitList();await page.evaluate(()=>{window.releaseStaleList();window.releaseStaleList=null});await page.waitForTimeout(80)
 check((await page.locator('table').innerText()).includes('Listing product 118'),'Late stale result cannot replace the current query')
 await page.locator('#product-search').fill('not-present');await page.getByRole('heading',{name:labels.en.productList.noSearch,exact:true}).waitFor();check(await page.locator('table').count()===0,'No-match search is separate from an empty catalog');await screenshot('en-1440-no-search')
 await show('/dashboard/products?q=Listing+product');await page.locator('#product-mode').selectOption('normal');await page.locator('#product-filter-category').selectOption(listingSeed.c2);await page.getByRole('heading',{name:labels.en.productList.noSearch,exact:true}).waitFor()
 await page.locator('#product-search').fill('');await page.getByRole('heading',{name:labels.en.productList.noFilters,exact:true}).waitFor();check(await page.getByRole('button',{name:labels.en.productList.clearFilters,exact:true}).count()===2,'Filtered no-results offers clear controls')
 failList=true;await page.getByRole('button',{name:labels.en.productList.refresh,exact:true}).click();await page.getByRole('alert').filter({hasText:labels.en.productList.loadFailed}).waitFor();check(await page.getByRole('heading',{name:labels.en.common.noProductsYet,exact:true}).count()===0,'Request failure never claims the catalog is empty');await screenshot('en-1440-request-failed')
 await page.getByRole('button',{name:labels.en.productList.retry,exact:true}).click();await page.getByRole('heading',{name:labels.en.productList.noFilters,exact:true}).waitFor()
 oversizeList=true;await page.getByRole('button',{name:labels.en.productList.refresh,exact:true}).click();await page.getByRole('alert').filter({hasText:labels.en.productList.loadFailed}).waitFor();check(await page.locator('table').count()===0,'Unexpected oversized response cannot flood the interface')
 for(const language of ['en','ar']){
  await page.evaluate(language=>{window.editorTest.locale.value=language;window.editorTest.emptyMode(true);window.editorTest.appearance()},language)
  await page.evaluate(path=>window.editorTest.show(path),(language==='ar'?'/ar':'')+'/dashboard/products');await page.getByRole('heading',{name:labels[language].common.noProductsYet,exact:true}).waitFor()
  check(await page.locator('#product-filter-category option').count()===1,'Fresh category filter is empty');check(await page.locator('#product-filter-brand option').count()===1,'Fresh brand filter is empty')
  check(await page.getByRole('link',{name:labels[language].common.addProduct,exact:true}).count()===2,'Empty catalog has a create link')
  await page.setViewportSize({width:390,height:1000});await screenshot(language+'-390-empty-catalog')
 }
 await page.evaluate(()=>{window.editorTest.emptyMode(false);window.editorTest.locale.value='ar';window.editorTest.actor.value='owner';window.editorTest.appearance()})
 await show('/ar/dashboard/products?q='+encodeURIComponent('حاسوب'));check((await page.locator('table').innerText()).includes('حاسوب عربي'),'Arabic title search shows exact authored content')
 await page.locator('#product-search').fill('VARIANT-SKU-113');await waitList();check((await page.locator('table').innerText()).includes('Listing product 113'),'Arabic UI searches option SKUs')
 check(new URL(page.url()).pathname==='/ar/dashboard/products','Arabic filter navigation retains the locale prefix')
 await page.evaluate(()=>{window.editorTest.locale.value='en';window.editorTest.actor.value='viewer';window.editorTest.appearance()});await show('/dashboard/products?q=Listing+product')
 check(await page.locator('table').getByRole('link').count()===0,'Viewer rows have no edit or inventory actions');check(await page.getByRole('link',{name:labels.en.common.addProduct,exact:true}).count()===0,'Viewer has no create access');await screenshot('en-390-viewer')
 await page.evaluate(()=>window.editorTest.actor.value='customer');await page.getByRole('alert').filter({hasText:labels.en.productList.permission}).waitFor();check(await page.locator('table').count()===0,'Customer cannot browse drafts or staff rows')
 await page.evaluate(()=>window.editorTest.actor.value='editor');await waitList();await rest.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.editor]);await page.getByRole('button',{name:labels.en.productList.refresh,exact:true}).click();await page.getByRole('alert').filter({hasText:labels.en.productList.permission}).waitFor();check(await page.locator('table').count()===0,'Revoked staff receives no cached rows')
 check(errors.length===0,'No unexpected browser errors: '+errors.join(';'));check(external.length===0,'No external browser requests')
 const report={assertions,screenshots:screens,errors,external,database:'Actual owned native PostgreSQL, PostgREST and product/list/media HTTP handlers',router:'Actual Vue Router and Chrome history',limits:'Auth verification/claims and Nuxt/ERP shell are synthetic. One deliberate delayed transport ignores abort to prove generation protection. Secondary navigation shell is a fixture; editors, forms and listings are actual components. No hosted or production acceptance.'}
 await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await empty?.close();await media?.close();await f?.close();await rest.close()}
