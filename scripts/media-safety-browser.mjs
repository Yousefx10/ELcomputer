// Actual shared media components, upload/gallery routes, filesystem and native
// SQL. Hosted Auth and the surrounding Nuxt/Settings shell are fixtures.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createServer, request as httpRequest } from 'node:http'
import { resolve, join } from 'node:path'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createEmailNativeDatabase, emailNativeAvailable } from '../tests/helpers/emailNativeDatabase.mjs'
import { createMediaFixture, pngImage } from '../tests/helpers/mediaFixture.mjs'
import { pathToFileURL } from 'node:url'
assert.ok(emailNativeAvailable,'Disposable native PostgreSQL tools required')
const {chromium}=await import(pathToFileURL(process.env.MEDIA_REVIEW_PLAYWRIGHT||'/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const base=resolve(new URL('..',import.meta.url).pathname),dir=process.env.MEDIA_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-media-browser'
await mkdir(dir,{recursive:true})
const f=await createMediaFixture({database:await createEmailNativeDatabase()})
let browser,server
try{
  await f.addFile('products/used.png');await f.addFile('products/unused.png');await f.addFile('products/gallery/gallery.png');await f.addFile('settings/site-logo/logo.png');await f.addFile('private/confidential.png')
  await f.save(f.body({image_url:'/uploads/products/used.png'}))
  const components={Field:'app/components/dashboard/MediaUploadField.vue',Library:'app/components/dashboard/MediaLibrary.vue',Toggle:'app/components/dashboard/FileViewToggle.vue',Details:'app/components/dashboard/FileDetailsPanel.vue'}
  let extraCss=''
  for(const[name,file]of Object.entries(components)){
    const{descriptor}=parse(await readFile(join(base,file),'utf8'))
    await writeFile(join(dir,name+'.js'),compileScript(descriptor,{id:'media-'+name,inlineTemplate:true}).content)
    for(const style of descriptor.styles)extraCss+=compileStyle({source:style.content,filename:file,id:'data-v-media-'+name,scoped:style.scoped}).code
  }
  await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,reactive,computed,onMounted,onUnmounted,onBeforeUnmount,watch,nextTick,useId,resolveComponent} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {ofetch} from '${base}/node_modules/ofetch/dist/index.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useAdminUploads} from '${base}/app/composables/useAdminUploads.js'
import {useMediaErrors} from '${base}/app/composables/useMediaErrors.js'
import en from '${base}/i18n/locales/en.json';import ar from '${base}/i18n/locales/ar.json'
${Object.keys(components).map(n=>`import ${n} from './${n}.js'`).join('\n')}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}}),actor=ref('editor'),theme=ref('light'),view=ref('field'),value=ref(''),generation=ref(0)
Object.assign(globalThis,{ref,reactive,computed,onMounted,onUnmounted,onBeforeUnmount,watch,nextTick,useId,resolveComponent,useUiLocale,useAdminUploads,useMediaErrors,useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useAdminLogs:()=>({getAdminAuthHeaders:async()=>({authorization:'Bearer '+actor.value})}),$fetch:ofetch.create({retry:0})})
const Shell={setup(){const images=ref([]),selected=ref(null),search=ref(''),loading=ref(false),error=ref(''),deleting=ref(false),total=ref(0),sections=ref(0);const{fetchGalleryImages,deleteGalleryImage}=useAdminUploads();const{mediaErrorMessage}=useMediaErrors();
const load=async()=>{loading.value=true;error.value='';try{const r=await fetchGalleryImages({q:search.value});images.value=r.items;total.value=r.pagination.totalItems;sections.value=r.totalSections}catch(e){images.value=[];selected.value=null;error.value=mediaErrorMessage(e,'load')}finally{loading.value=false}}
const remove=async image=>{if(deleting.value)return;deleting.value=true;error.value='';try{await deleteGalleryImage(image.publicPath);selected.value=null;await load()}catch(e){error.value=mediaErrorMessage(e,'delete')}finally{deleting.value=false}};onMounted(load);watch(search,load);return()=>h(Library,{images:images.value,totalItems:total.value,totalSections:sections.value,loaded:true,loading:loading.value,error:error.value,canEdit:actor.value==='owner',deleting:deleting.value,search:search.value,'onUpdate:search':v=>search.value=v,selectedImage:selected.value,'onUpdate:selectedImage':v=>selected.value=v,onRefresh:load,onDelete:remove})}}
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)};watch([theme,i18n.global.locale],appearance)
const app=createApp({render:()=>h('main',{class:'dashboard-modern mx-auto max-w-6xl p-4'},[view.value==='field'?h(Field,{key:generation.value,section:'products',label:i18n.global.t('application.productImage'),modelValue:value.value,'onUpdate:modelValue':v=>value.value=v}):h(Shell,{key:generation.value}),h('output',{'data-testid':'value'},value.value)])});app.use(i18n);const ui=useUiLocale();app.config.globalProperties.$uiMessage=ui.uiMessage;app.config.globalProperties.$uiLabel=ui.uiLabel;app.component('DashboardMediaLibrary',Library);app.component('DashboardFileViewToggle',Toggle);app.component('DashboardFileDetailsPanel',Details);app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}});app.mount('#app');appearance();window.mediaTest={actor,theme,locale:i18n.global.locale,value,appearance,async show(v){view.value=v;value.value='';generation.value++;await nextTick()}}
`)
  await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'process.env.NODE_ENV':'"test"','__VUE_OPTIONS_API__':'true','__VUE_PROD_DEVTOOLS__':'false','__VUE_PROD_HYDRATION_MISMATCH_DETAILS__':'false'}})
  const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(n=>n.endsWith('.css')).map(n=>readFile(join(base,'.output/public/_nuxt',n),'utf8')))).join('\n')+extraCss
  server=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/')||req.url.startsWith('/uploads/')){const proxy=httpRequest(f.url+req.url,{method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});proxy.on('error',()=>{res.writeHead(502);res.end()});req.pipe(proxy);return}
    res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(dir,'bundle.js')):`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>`)
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];let assertions=0,screens=0
  const check=(v,m)=>{assert.ok(v,m);assertions++}
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/server responded with a status of (400|403|409)\b/.test(m.text()))errors.push(m.text())})
  await page.route('**/*',async r=>{if(!r.request().url().startsWith(url+'/')){external.push(r.request().url());await r.abort();return}await r.continue()})
  await page.goto(url);await page.waitForFunction(()=>!!window.mediaTest)
  const labels=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile(join(base,'i18n/locales/'+l+'.json'),'utf8'))])))
  const show=async(view,actor='editor')=>{await page.evaluate(async({view,actor})=>{window.mediaTest.actor.value=actor;await window.mediaTest.show(view)},{view,actor})}
  const picker=()=>page.locator('dialog[open]').first()
  for(const language of ['en','ar'])for(const width of [390,768,1440])for(const theme of ['light','dark','system']){
    await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'});await page.evaluate(({language,theme})=>{const t=window.mediaTest;t.locale.value=language;t.theme.value=theme;t.appearance()},{language,theme})
    await show('field');await page.getByRole('button',{name:labels[language].common.selectFromLibrary,exact:true}).click();await picker().locator('.file-card').first().waitFor()
    check(await picker().locator('.file-surface').evaluate(n=>{const style=getComputedStyle(n),theme=getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();const probe=document.createElement('span');probe.style.backgroundColor=theme;document.body.append(probe);const expected=getComputedStyle(probe).backgroundColor;probe.remove();return !document.documentElement.classList.contains('dark')||style.backgroundColor===expected}),'Readable dark library surface');check(!(await page.locator('body').innerText()).includes('application.productImage'),'Image label translated');check(await picker().locator('.file-card').count()===3,'Product editor scoped library');check(!(await picker().innerText()).includes('logo.png'),'No Settings media');check(!(await page.locator('body').innerText()).includes('confidential'),'No confidential image');check(await page.locator('html').getAttribute('dir')===(language==='ar'?'rtl':'ltr'),'Correct direction');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')
    await picker().locator('.file-card').filter({hasText:'gallery.png'}).click();await picker().getByRole('button',{name:labels[language].common.useImage,exact:true}).click();check(await page.getByTestId('value').innerText()==='/uploads/products/gallery/gallery.png','Existing gallery selection');check(await page.locator('main img').evaluate(i=>i.complete&&i.naturalWidth>0),'Image preview remains');await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-field.png'),fullPage:true});screens++
    await show('library','owner');await page.locator('.file-card').first().waitFor();check(await page.locator('.file-card').count()===4,'Owner public image library');await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-library.png'),fullPage:true});screens++
  }
  for(const language of ['en','ar']){
    await page.evaluate(language=>window.mediaTest.locale.value=language,language);await show('field')
    await page.locator('input[type=file]').setInputFiles({name:'valid.png',mimeType:'image/png',buffer:pngImage()});await page.waitForFunction(()=>window.mediaTest.value.value.startsWith('/uploads/products/'));check(await page.locator('main img').evaluate(i=>i.complete&&i.naturalWidth>0),'New upload preview');check(await page.locator('input[type=file]').getAttribute('accept')==='image/jpeg,image/png,image/webp,image/gif,image/avif','Raster picker formats')
    await page.locator('input[type=file]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"/>')});await page.getByRole('alert').waitFor();check(await page.getByRole('alert').innerText()===labels[language].mediaSafety.svg,'Natural translated SVG error')
    await page.locator('input[type=file]').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('<script>alert(1)</script>')});await page.waitForFunction(expected=>document.querySelector('[role=alert]')?.innerText===expected,labels[language].mediaSafety.invalid);check(await page.getByRole('alert').innerText()===labels[language].mediaSafety.invalid,'Actual content error translated')
    await show('library','owner');await page.locator('.file-card').filter({has:page.locator('p[title="used.png"]')}).click();await page.getByRole('button',{name:labels[language].common.deleteImage,exact:true}).click();await page.getByRole('alert').waitFor();check((await page.getByRole('alert').innerText()).includes(labels[language].mediaSafety.inUse),'Referenced deletion error translated');check(await page.locator('.file-card').filter({has:page.locator('p[title="used.png"]')}).count()===1,'Referenced file preserved')
    const unused='browser-unused-'+language+'.png';await f.addFile('products/'+unused);await show('library','owner');await page.locator('.file-card').filter({hasText:unused}).click();await page.getByRole('button',{name:labels[language].common.deleteImage,exact:true}).click();await page.locator('.file-card').filter({hasText:unused}).waitFor({state:'detached'});check(true,'Unused media deleted')
    await show('field','owner');await page.getByRole('button',{name:labels[language].common.selectFromLibrary,exact:true}).click();await picker().locator('.file-card').filter({hasText:'logo.png'}).click();await page.evaluate(()=>window.mediaTest.actor.value='editor');await picker().getByRole('button',{name:labels[language].common.refreshMedia,exact:true}).click();await picker().locator('.file-card').filter({hasText:'logo.png'}).waitFor({state:'detached'});await picker().locator('.file-surface[aria-busy=\"false\"]').waitFor();check(await picker().getByRole('button',{name:labels[language].common.useImage,exact:true}).isDisabled(),'Stale selection cleared after scope refresh');check(!(await picker().innerText()).includes('logo.png'),'Old Settings selection removed');await picker().getByRole('button',{name:labels[language].common.close,exact:true}).click()
    await show('field','disabled');await page.getByRole('button',{name:labels[language].common.selectFromLibrary,exact:true}).click();await picker().getByRole('alert').waitFor();check((await picker().getByRole('alert').innerText()).includes(labels[language].mediaSafety.permission),'Revoked access translated');check(await picker().locator('.file-card').count()===0,'Revoked staff get no images');await page.getByRole('button',{name:labels[language].common.close,exact:true}).click()
  }
  check(errors.length===0,'No unexpected browser errors: '+errors.join(';'));check(external.length===0,'No external requests')
  const report={assertions,screenshots:screens,errors,external,limits:'Actual shared media UI/HTTP/filesystem/native SQL; hosted Auth, Nuxt shell and Settings orchestration are fixtures.'};await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await f.close()}
