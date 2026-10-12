// Actual Vue content reader, homepage, hero, navbar, topbar, footer and login.
// Read-only fixtures; no Auth call, provider, database URL or external traffic.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'
const { chromium } = await import(pathToFileURL('/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const base=resolve('.'),dir='/private/tmp/elcomputer-neutral-storefront-browser'
await mkdir(dir,{recursive:true})
await writeFile(join(dir,'entry.js'),`
import {createApp,h,ref,computed,watch,onMounted,onBeforeUnmount,nextTick,Suspense,resolveComponent} from 'vue';
import {createI18n} from 'vue-i18n';
import {useSiteContent} from '${join(base,'app/composables/useSiteContent.js')}';
import Home from '${join(base,'app/pages/index.vue')}';import Footer from '${join(base,'app/components/layout/Footer.vue')}';import TopBar from '${join(base,'app/components/layout/TopBar.vue')}';import NavBar from '${join(base,'app/components/layout/NavBar.vue')}';import Hero from '${join(base,'app/components/cards/HeroCard.vue')}';import BrandLogo from '${join(base,'app/components/BrandLogo.vue')}';import Login from '${join(base,'app/pages/login.vue')}';
import en from '${join(base,'i18n/locales/en.json')}';import ar from '${join(base,'i18n/locales/ar.json')}';
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}}),scenario=ref('absent'),generation=ref(0),screen=ref('home'),theme=ref('light'),calls=[],cache=new Map();
const saved={key:'default',site_name:'Saved Merchant',site_logo_url:'/fixture-logo.svg',footer_email:'saved@merchant.example',footer_phone:'01000000001',footer_address:'Saved address',footer_cta_title:'Saved promotion',footer_cta_subtitle:'Saved supporting text',footer_cta_button_label:'Saved button',footer_cta_button_url:'/search',hero_enabled:true,seo_site_url:'https://saved.example'};
const results=table=>{
 if(scenario.value==='error')return {data:null,error:{code:'503'}};
 if(table==='site_settings')return {data:scenario.value==='saved'?saved:scenario.value==='empty'?{...saved,site_name:'Fresh Store',site_logo_url:'',footer_email:'',footer_phone:'',footer_address:'',footer_cta_title:'',footer_cta_subtitle:'',footer_cta_button_label:'',hero_enabled:true}:null,error:null};
 const rows=scenario.value==='saved'?({site_hero_banners:[{id:'saved-hero',image_url:'/fixture-hero.svg',is_enabled:true}],site_top_bar_messages:[{id:'saved-message',text:'Saved announcement',is_enabled:true}],site_links:[{id:'saved-link',location:'footer',section_title:'Saved group',label:'Saved link',url:'/help',is_enabled:true}]}[table]||[]):[];
 return {data:rows,error:null};
};
const client={from:table=>{calls.push(table);const query={select:()=>query,eq:()=>query,order:()=>query,maybeSingle:()=>query,then:fn=>Promise.resolve(results(table)).then(fn)};return query}};
const asyncData=async(key,handler,options={})=>{if(!cache.has(key)){let data,error=null;try{data=await handler()}catch(caught){error=caught;data=options.default?.()||null}cache.set(key,{data:ref(data),pending:ref(false),error:ref(error)})}return cache.get(key)};
Object.assign(globalThis,{ref,computed,watch,onMounted,onBeforeUnmount,nextTick,resolveComponent,useSiteContent,useSupabaseClient:()=>client,useSupabaseUser:()=>ref(null),useAsyncData:asyncData,useRuntimeConfig:()=>({public:{siteUrl:'',supabase:{}}}),usePageSeo:()=>{},definePageMeta:()=>{},useHead:()=>{},useRoute:()=>({path:'/',query:{}}),useUiRoute:()=>({path:screen.value==='login'?'/login':'/',query:{}}),useI18n:()=>i18n.global,useUiNavigation:()=>({uiNavigateTo:()=>{}}),useUiLocale:()=>({uiLabel:s=>s,intlLocale:computed(()=>i18n.global.locale.value==='ar'?'ar-EG':'en-US')}),useCategoryLocale:()=>({categoryName:c=>c.name}),useCart:()=>({itemCount:ref(0),subtotal:ref(0),loadCart:()=>{}})});
const render=()=>h(Suspense,{key:generation.value},{default:()=>h('main',[...(screen.value==='login'?[h(Login)]:[h(TopBar),h(NavBar),h(Home),h(Footer)])]),fallback:()=>h('p','Loading')});
const app=createApp({render});app.use(i18n);app.config.globalProperties.$uiLabel=s=>s;
app.component('BrandLogo',BrandLogo);app.component('CardsHeroCard',Hero);
app.component('NuxtLinkLocale',{props:['to'],setup(p,{slots,attrs}){return()=>h('a',{...attrs,href:typeof p.to==='string'?p.to:p.to?.path||'/'},slots.default?.())}});
app.component('NuxtLink',{props:['to'],setup(p,{slots,attrs}){return()=>h('a',{...attrs,href:typeof p.to==='string'?p.to:p.to?.path||'/'},slots.default?.())}});
app.component('Icon',{setup(){return()=>h('span',{'aria-hidden':true})}});
for(const name of ['UiPreferences','LayoutSearchBar','HomeCustomerReviews','NpsSurvey','LayoutPageLoading','HomeProductSection','CardsBanner'])app.component(name,{setup(){return()=>null}});
app.mount('#app');
window.neutralTest={calls,show:async(value,page='home')=>{scenario.value=value;screen.value=page;cache.clear();generation.value++;await nextTick()},appearance:(locale,color)=>{i18n.global.locale.value=locale;theme.value=color;document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',color==='dark')}};
`)
await build({entryPoints:[join(dir,'entry.js')],bundle:true,outfile:join(dir,'bundle.js'),alias:{'~':join(base,'app')},nodePaths:[join(base,'node_modules')],define:{'import.meta.server':'false','import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'actual-vue',setup(builder){builder.onLoad({filter:/\.vue$/},async({path})=>{const {descriptor}=parse(await readFile(path,'utf8'),{filename:path});return{contents:compileScript(descriptor,{id:path,inlineTemplate:true}).content,loader:'js',resolveDir:dirname(path)}})}}]})
const css=(await Promise.all((await readdir('.output/public/_nuxt')).filter(file=>file.endsWith('.css')).map(file=>readFile(join('.output/public/_nuxt',file),'utf8')))).join('\n')
const server=createServer(async(req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(dir,'bundle.js')))}
 else if(req.url?.endsWith('.svg')){res.setHeader('content-type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="520"><rect width="1400" height="520" fill="#ccc"/></svg>')}
 else{res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>')}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const url='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}),page=await browser.newPage(),errors=[],external=[]
let assertions=0,screens=0
const check=(value,message)=>{assert.ok(value,message);assertions++}
page.on('pageerror',error=>{errors.push(error.message);console.log('browser fixture error:',error.message)});page.on('console',message=>{if(['error','warning'].includes(message.type())){errors.push(message.text());console.log('browser fixture console:',message.text())}})
await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():(external.push(route.request().url()),route.abort()))
try{
 await page.goto(url)
 for(const locale of ['en','ar'])for(const width of [1440,390])for(const color of ['light','dark'])for(const scenario of ['absent','empty','error','saved']){
  await page.setViewportSize({width,height:1000});await page.evaluate(({locale,color,scenario})=>{window.neutralTest.appearance(locale,color);return window.neutralTest.show(scenario)},{locale,color,scenario})
  await page.locator('footer').waitFor();const text=await page.locator('main').innerText()
  check(!/info@elcomputer|01505121684|Pretty Cool|Purchase your fav|ELCOMPUTER/.test(text),'No original merchant copy')
  check(await page.locator('[src*="placehold"],[src*="setup-hero"],[src*="dashboard-logo"]').count()===0,'No merchant placeholder images')
  check(await page.locator('.store-hero').count()===(scenario==='saved'?1:0),'Only configured hero renders')
  check(await page.locator('.store-topbar p').innerText()===(scenario==='saved'?'Saved announcement':''),'Empty announcements stay empty')
  check(text.includes('saved@merchant.example')===(scenario==='saved'),'Saved contact preserved, absent contact empty')
  check(text.includes('Saved promotion')===(scenario==='saved'),'Saved CTA preserved, absent CTA empty')
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Responsive layout')
  await page.screenshot({path:join(dir,[locale,width,color,scenario].join('-')+'.png'),fullPage:true});screens++
 }
 for(const locale of ['en','ar']){
  await page.evaluate(locale=>{window.neutralTest.appearance(locale,'light');return window.neutralTest.show('absent','login')},locale)
  await page.locator('.auth-page').waitFor();check(await page.locator('[src*="dashboard-logo"]').count()===0,'Neutral login branding')
 }
 check(errors.length===0,'No browser errors: '+errors.join('; '));check(external.length===0,'No external traffic')
 const calls=await page.evaluate(()=>window.neutralTest.calls)
 check(calls.every(table=>!table.startsWith('admin_')&&!table.startsWith('installation_')),'No private/bootstrap requests')
 const result={result:'pass',assertions,screens,errors,external,source:'actual Vue components and content reader; owned read-only Supabase contract'}
 await writeFile(join(dir,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
