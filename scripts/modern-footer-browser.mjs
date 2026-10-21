// Actual Footer and Settings page against owned native PostgreSQL/PostgREST.
// Auth claims are synthetic. This never connects to hosted Auth or production.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript} from '@vue/compiler-sfc'
import {build} from 'esbuild'
import {createCatalogRestFixture} from '../tests/helpers/catalogRestFixture.mjs'
import {normalizeModernFooter} from '../app/utils/modernFooter.js'
const base=resolve('.'),dir=process.env.FOOTER_REVIEW_ARTIFACTS||'/private/tmp/elcomputer-modern-footer-browser'
await mkdir(dir,{recursive:true})
const {chromium}=await import(pathToFileURL(process.env.FOOTER_REVIEW_PLAYWRIGHT).href)
const f=await createCatalogRestFixture({afterCatalog:async db=>{
 for(const name of(await readdir(join(base,'supabase/migrations'))).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await db.exec(await readFile(join(base,'supabase/migrations',name),'utf8'))
}})
let server,browser,nuxt
try{
// The historical schema snapshot omits this hosted baseline table grant.
await f.db.exec('grant select on public.site_offer_cards to authenticated')
const links=[{id:'11111111-1111-4111-8111-111111111111',location:'footer',section_title:'Shop',label:'Browse products',url:'/search',sort_order:0,is_enabled:true},{id:'22222222-2222-4222-8222-222222222222',location:'footer',section_title:'Support',label:'Help center',url:'/help',sort_order:1,is_enabled:true}]
await f.db.exec("delete from public.site_settings; delete from public.site_links")
await f.db.query("insert into public.site_settings(key,site_name,footer_style,copyright_text,footer_phone) values('default','Independent Merchant','modern','Saved copyright','+123456')")
for(const row of links)await f.db.query('insert into public.site_links(id,location,section_title,label,url,sort_order,is_enabled) values($1,$2,$3,$4,$5,$6,$7)',Object.values(row))
const config=normalizeModernFooter({brand:{description:'Browse our saved products and contact our team.',description_ar:'تصفح المنتجات وتواصل مع فريقنا.',socials:[{label:'Facebook',platform:'facebook',url:'https://example.test/social'}]},columns:[{title:'Shop',title_ar:'تسوق',links:[{label:'All products',label_ar:'كل المنتجات',url:'/search'},{label:'New arrivals',label_ar:'وصل حديثًا',url:'/search?sort=new',badge:'New',badge_ar:'جديد'}]},{title:'Support',title_ar:'الدعم',links:[{label:'Help center',label_ar:'مركز المساعدة',url:'/help'},{label:'My account',label_ar:'حسابي',url:'/account'}]}],newsletter:{state:'disabled',description:'Receive store updates.',description_ar:'تابع أخبار المتجر.'},support:{hours:'Saved support hours',hours_ar:'ساعات الدعم المحفوظة',label:'help@merchant.example',url:'mailto:help@merchant.example'},apps:{enabled:true,title:'Store applications',title_ar:'تطبيقات المتجر',description:'Existing app links',items:[{platform:'apple',url:'https://example.test/app',image_url:'/fixture-app.svg'},{platform:'google',url:'https://example.test/play',image_url:'/fixture-play.svg'}]},payments:{enabled:true,items:[{method:'cash',label:'Cash',image_url:'/fixture-payment.svg'}]},bottom:{copyright:'Independent Merchant',copyright_ar:'متجر مستقل',show_year:true,links:[{label:'Privacy',label_ar:'الخصوصية',url:'/privacy'},{label:'Terms',label_ar:'الشروط',url:'/terms'}]}})
const components={Footer:'app/components/layout/Footer.vue',LayoutModernFooter:'app/components/layout/ModernFooter.vue',LayoutFooterLink:'app/components/layout/FooterLink.vue',BrandLogo:'app/components/BrandLogo.vue',DashboardModernFooterEditor:'app/components/dashboard/ModernFooterEditor.vue',DashboardFooterText:'app/components/dashboard/FooterText.vue',DashboardFooterLinks:'app/components/dashboard/FooterLinks.vue',Settings:'app/pages/dashboard/settings.vue'}
await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,reactive,computed,watch,onMounted,onBeforeUnmount,nextTick,Suspense} from '${base}/node_modules/vue/dist/vue.esm-bundler.js';
import {createI18n,useI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs';
import {PostgrestClient} from '${base}/node_modules/@supabase/postgrest-js/dist/index.mjs';
import {localizedPath} from '${base}/app/utils/appearance.js';
import en from '${base}/i18n/locales/en.json'; import ar from '${base}/i18n/locales/ar.json';
${Object.entries(components).map(([name,path])=>`import ${name} from '${base}/${path}';`).join('\n')}
const client=new PostgrestClient(${JSON.stringify(f.url)},{headers:{Authorization:${JSON.stringify('Bearer '+f.token('owner'))}}});
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}}),screen=ref('settings'),generation=ref(0),content=ref({settings:{},footerLinks:[]}),editable=ref(true);
const state=new Map(),logs=[],route=reactive({path:'/dashboard/settings',query:{tab:'footer'}});
const refresh=async()=>{content.value={settings:(await client.from('site_settings').select('*').eq('key','default').single()).data,footerLinks:(await client.from('site_links').select('*').order('sort_order')).data};};
Object.assign(globalThis,{ref,reactive,computed,watch,onMounted,onBeforeUnmount,useI18n,nextTick,definePageMeta:()=>{},useRuntimeConfig:()=>({public:{siteUrl:'https://merchant.example'}}),useSupabaseClient:()=>client,useSiteContent:async()=>({data:content}),useState:(key,fn)=>{if(!state.has(key))state.set(key,ref(fn()));return state.get(key)},useUiRoute:()=>route,useUiNavigation:()=>({uiNavigateTo:async()=>{}}),useUiLocale:()=>({uiLabel:v=>v,uiText:key=>key,intlLocale:computed(()=>i18n.global.locale.value==='ar'?'ar-EG':'en-US')}),useNuxtApp:()=>({$i18n:i18n.global}),useDashboardCache:()=>({getSnapshot:()=>null,isFresh:()=>false,setSnapshot:()=>{}}),useAdminAccess:()=>({hasPermission:key=>key==='settings.view'||editable.value&&key==='settings.edit',isOwner:ref(false)}),useAdminLogs:()=>({fetchAdminLogs:async()=>[],recordAdminLog:async(...args)=>logs.push(args)}),useAdminUploads:()=>({fetchGalleryImages:async()=>({items:[]}),deleteGalleryImage:async()=>{}}),useMediaErrors:()=>({mediaErrorMessage:()=>''}),refreshNuxtData:refresh});
const app=createApp({setup:()=>()=>h('div',{class:screen.value==='settings'?'dashboard':'storefront'},[h(Suspense,null,{default:()=>h(screen.value==='settings'?Settings:Footer,{key:generation.value})})])});
app.use(i18n);for(const[name,component]of Object.entries({${Object.keys(components).join(',')}}))app.component(name,component);
app.config.globalProperties.$uiLabel=v=>v;app.config.globalProperties.$uiMessage=v=>v;
app.component('Icon',{setup:()=>()=>h('span',{'aria-hidden':'true'},'◇')});
app.component('NuxtLinkLocale',{props:['to'],setup:(p,{slots})=>()=>h('a',{href:localizedPath(p.to,i18n.global.locale.value)},slots.default?.())});
app.component('DashboardMediaUploadField',{props:['modelValue','label','disabled'],emits:['update:modelValue'],setup:(p,{emit})=>()=>h('label',{class:'block text-sm'},[p.label,h('input',{value:p.modelValue,disabled:p.disabled,class:'mt-2 w-full rounded-lg border p-3',onInput:e=>emit('update:modelValue',e.target.value)})])});
for(const name of ['DashboardErpSettings','DashboardLiveChatSettings','AfterSalesCommunicationSettings','DashboardAfterSalesPolicies','DashboardMediaLibrary','DashboardPageIntro','DashboardSystemReset','UiPreferences'])app.component(name,{setup:()=>()=>null});
await refresh();app.mount('#app');
window.footerTest={client,logs,content,editable,show:async s=>{await refresh();screen.value=s;generation.value++;await nextTick()},appearance:(locale,color)=>{i18n.global.locale.value=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.lang=locale;document.documentElement.classList.toggle('dark',color==='dark')},set:async value=>{await client.from('site_settings').update(value).eq('key','default');await refresh();generation.value++;await nextTick()}};
`)
await build({entryPoints:[join(dir,'entry.js')],bundle:true,format:'esm',outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'import.meta.server':'false','import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'vue',setup(builder){builder.onLoad({filter:/\.vue$/},async({path})=>{let source=await readFile(path,'utf8');if(path.endsWith('/settings.vue'))source=source.replace('</script>',"onMounted(()=>{globalThis.footerSettingsPage={siteSettings,saveSiteSettings,isSettingsSectionDirty,settingsError,settingsSuccess};});\n</script>");const {descriptor}=parse(source,{filename:path});return {contents:compileScript(descriptor,{id:path,inlineTemplate:true}).content,loader:'js',resolveDir:dirname(path)}})}}]})
// Use built Tailwind/Dashboard styles and the exact current footer CSS.
const cssRoot=join(base,'.output/public/_nuxt'),css=(await Promise.all((await readdir(cssRoot)).filter(n=>n.endsWith('.css')).map(n=>readFile(join(cssRoot,n),'utf8')))).join('\n')+'\n'+await readFile(join(base,'app/assets/css/modern-footer.css'),'utf8')
server=createServer(async(req,res)=>{if(req.url.startsWith('/rest/v1/')){if(req.method!=='GET'){res.writeHead(405);res.end();return}const upstream=await fetch(f.url+req.url.replace('/rest/v1',''));res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'});res.end(await upstream.text());return}if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(dir,'bundle.js')))}else if(req.url.endsWith('.svg')){res.setHeader('content-type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="136" height="42"><rect width="136" height="42" rx="5" fill="#222"/><text x="10" y="27" fill="white" font-size="15">Fixture asset</text></svg>')}else{res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script type="module" src="/bundle.js"></script></body></html>')}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
browser=await chromium.launch({executablePath:process.env.FOOTER_REVIEW_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage(),errors=[],external=[],checks=[],httpErrors=[]
page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text())})
await page.route('**/*',route=>[origin,f.url].some(url=>route.request().url().startsWith(url))?route.continue():(external.push(route.request().url()),route.abort()))
const check=(v,label)=>{assert.ok(v,label);checks.push(label)}
await page.goto(origin);await page.waitForFunction(()=>window.footerSettingsPage)
await page.getByRole('button',{name:'Add link',exact:true}).first().waitFor()
check(await page.getByRole('heading',{name:'Brand and social profiles',exact:true}).isVisible(),'Modern editor loaded')
// Verify actual Dashboard save/validation/reload and independent draft state.
await page.evaluate(async config=>{const p=window.footerSettingsPage;p.siteSettings.footer_modern_config=config;p.siteSettings.site_name='Unsaved identity draft';await p.saveSiteSettings('footerSettings')},config)
check(await page.evaluate(()=>window.footerSettingsPage.settingsError.value)==='','Save succeeds')
assert.deepEqual((await f.db.query("select footer_modern_config config from public.site_settings where key='default'")).rows[0].config,config);check(true,'Every section and bilingual field persisted')
check((await f.db.query("select site_name from public.site_settings where key='default'")).rows[0].site_name==='Independent Merchant','Unrelated setting draft not persisted')
check(await page.evaluate(()=>window.footerSettingsPage.siteSettings.site_name)==='Unsaved identity draft','Other section draft retained')
await page.reload();await page.waitForFunction(()=>window.footerSettingsPage?.siteSettings.footer_modern_config)
check(await page.evaluate(()=>!window.footerSettingsPage.isSettingsSectionDirty('footerSettings')),'Reload restores clean saved state')
assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(window.footerSettingsPage.siteSettings.footer_modern_config))),config);check(true,'Every saved section reloads')
// Exercise actual controls, including natural text with spaces.
const description=page.getByText('Description · EN',{exact:true}).first().locator('textarea');await description.fill('A description with several words.');await page.getByRole('button',{name:/save footer settings/i,exact:true}).click()
await page.waitForFunction(()=>window.footerSettingsPage.settingsSuccess.value)
check((await f.db.query("select footer_modern_config->'brand'->>'description' description from public.site_settings where key='default'")).rows[0].description==='A description with several words.','Text input and save preserve spaces')
const nav=page.locator('section').filter({has:page.getByRole('heading',{name:'Navigation column 1',exact:true})}).last()
await nav.getByRole('button',{name:'Add link',exact:true}).click();const newRow=nav.locator('div.rounded-lg.border.bg-white').last();await newRow.getByText('Link label · EN',{exact:true}).locator('input').fill('Third link');await newRow.getByText('Destination',{exact:true}).locator('input').fill('/contact');await newRow.getByLabel('Visible',{exact:true}).uncheck();await newRow.getByRole('button',{name:'Move up'}).click()
await page.getByRole('button',{name:/save footer settings/i,exact:true}).click();await page.waitForFunction(()=>!window.footerSettingsPage.isSettingsSectionDirty('footerSettings'))
let saved=(await f.db.query("select footer_modern_config config from public.site_settings where key='default'")).rows[0].config
check(saved.columns[0].links[1].label==='Third link'&&!saved.columns[0].links[1].enabled,'Add/reorder/toggle persisted')
await nav.locator('div.rounded-lg.border.bg-white').nth(1).getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('button',{name:/save footer settings/i,exact:true}).click();await page.waitForFunction(()=>!window.footerSettingsPage.isSettingsSectionDirty('footerSettings'));check((await f.db.query("select jsonb_array_length(footer_modern_config->'columns'->0->'links') n from public.site_settings where key='default'")).rows[0].n===2,'Remove persists')
await page.evaluate(async()=>{const p=window.footerSettingsPage;p.siteSettings.footer_modern_config.columns[0].links[0].url='javascript:alert(1)';await p.saveSiteSettings('footerSettings')})
check(!!await page.evaluate(()=>window.footerSettingsPage.settingsError.value),'Unsafe URL blocks save and retains draft')
check((await f.db.query("select footer_modern_config->'columns'->0->'links'->0->>'url' url from public.site_settings where key='default'")).rows[0].url==='/search','Rejected change never persists')
await page.evaluate(()=>{window.footerTest.editable.value=false});check(await description.isDisabled(),'Settings viewer cannot edit Modern fields');await page.evaluate(()=>{window.footerTest.editable.value=true})
const beforeDenied=(await f.db.query("select footer_modern_config config from public.site_settings where key='default'")).rows[0].config;await f.request('/site_settings?key=eq.default',{actor:'viewer',method:'PATCH',body:{footer_modern_config:null}});assert.deepEqual((await f.db.query("select footer_modern_config config from public.site_settings where key='default'")).rows[0].config,beforeDenied);check(true,'Existing RLS rejects non-editor mutation')
await page.evaluate(async config=>{await window.footerTest.set({footer_modern_config:config});await window.footerTest.show('footer')},config)
for(const locale of ['en','ar'])for(const width of [1440,900,390])for(const color of ['light','dark']){
 await page.setViewportSize({width,height:1050});await page.evaluate(({locale,color})=>window.footerTest.appearance(locale,color),{locale,color});await page.locator('footer.store-footer-modern').waitFor()
 const grid=await page.locator('.store-footer-modern-main').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)
 check(grid===(width>=1200?4:width>=640?2:1),`${locale}/${width}/${color} column count`)
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${locale}/${width}/${color} no overflow`)
 check(await page.locator('input[type=email]').isDisabled(),`${locale}/${width}/${color} newsletter disabled`)
 check(await page.locator('.store-footer-modern-payments').count()===0,'Disabled checkout methods have no logos')
 check((await page.locator('.store-footer-modern-group a').first().getAttribute('href')).startsWith(locale==='ar'?'/ar/':'/search'),'Localized internal destinations')
 check(await page.locator('.store-footer-modern-group a').first().evaluate(el=>getComputedStyle(el).color===getComputedStyle(el.parentElement).color),'Link contrast inherits current theme');await page.screenshot({path:join(dir,`${locale}-${width}-${color}.png`),fullPage:true,animations:'disabled'})
}
await page.evaluate(async()=>{await window.footerTest.set({footer_style:'classic'});await window.footerTest.show('footer')});await page.locator('footer.store-footer').waitFor();check((await page.locator('footer').innerText()).includes('Saved copyright'),'Classic still uses its saved values')
// Section visibility, approved method gating, and payment ordering on disposable data only.
await page.evaluate(async config=>{await window.footerTest.set({footer_style:'modern',footer_modern_config:config,payment_cash_enabled:true});await window.footerTest.show('footer')},config)
check(await page.locator('.store-footer-modern-payments img').count()===1,'Enabled method can display configured logo')
for(const width of [1440,900,390]){await page.setViewportSize({width,height:1050});await page.evaluate(()=>window.footerTest.appearance('en','light'));const positions=await page.locator('.store-footer-modern-utility-grid > section').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));check(width===1440?positions.every(top=>top===positions[0]):positions[0]<positions[1]&&positions[1]<positions[2],width+' three utility sections match reference flow');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' utility strip has no overflow');await page.screenshot({path:join(dir,'three-utility-'+width+'.png'),fullPage:true,animations:'disabled'})}
// Verify the actual Nuxt production output renders and hydrates this footer.
await f.db.query("update public.site_settings set footer_modern_config=$1,payment_cash_enabled=false where key='default'",[JSON.stringify({...config,apps:{...config.apps,enabled:false}})])
const portProbe=createServer();await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));const nuxtOrigin='http://127.0.0.1:'+port
nuxt=spawn(process.execPath,[join(base,'.output/server/index.mjs')],{cwd:base,env:{PATH:process.env.PATH,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_PUBLIC_SUPABASE_URL:origin,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-public-key',NUXT_PUBLIC_SITE_URL:nuxtOrigin},stdio:['ignore','ignore','pipe']});const runtimeLog=[];nuxt.stderr.on('data',b=>runtimeLog.push(b))
let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(nuxtOrigin+'/api/storefront/content');if(r.ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}check(ready,'Built Nuxt runtime ready')
const ssrPage=await browser.newPage(),hydration=[];ssrPage.on('console',m=>{if(/hydration/i.test(m.text()))hydration.push(m.text())});ssrPage.on('pageerror',e=>hydration.push(e.message));await ssrPage.route('**/*',route=>[nuxtOrigin,origin].some(url=>route.request().url().startsWith(url))&&route.request().method()==='GET'?route.continue():route.abort())
for(const locale of ['en','ar']){const path=locale==='ar'?'/ar':'/';const response=await fetch(nuxtOrigin+path);const html=await response.text();check(response.status===200&&html.includes('store-footer-modern')&&html.includes(locale==='ar'?'كل المنتجات':'All products'),locale+' built SSR contains localized footer');await ssrPage.goto(nuxtOrigin+path);await ssrPage.locator('footer.store-footer-modern').waitFor();await ssrPage.waitForTimeout(250);check(await ssrPage.locator('.store-footer-modern-group a').first().getAttribute('href')===(locale==='ar'?'/ar/search':'/search'),locale+' hydrated destination');await ssrPage.screenshot({path:join(dir,'nuxt-ssr-'+locale+'.png'),fullPage:true,animations:'disabled'})}
check(hydration.length===0,'Actual Nuxt output has no hydration errors: '+hydration.join('; '));await ssrPage.close();await writeFile(join(dir,'nuxt-runtime.log'),Buffer.concat(runtimeLog));
check(external.length===0,'No external/provider traffic');check(errors.length===0,'No Vue/browser warnings: '+errors.join('; ')+' '+JSON.stringify(httpErrors))
const result={result:'PASS',assertions:checks.length,screens:17,checks,errors,external,evidence:'actual Settings save/reload, Footer components, native disposable PostgREST/RLS; synthetic Auth; media selection adapter'}
await writeFile(join(dir,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await browser?.close();if(nuxt&&nuxt.exitCode===null){nuxt.kill('SIGTERM');await new Promise(resolve=>nuxt.once('close',resolve))};if(server)await new Promise(resolve=>server.close(resolve));await f.close()}
