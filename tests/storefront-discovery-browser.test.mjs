import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
const {chromium,webkit}=await import(process.env.COD_REVIEW_PLAYWRIGHT)
const helper=`import {createApp,h,Suspense,ref,shallowRef,reactive,computed,watch,onMounted,onBeforeUnmount,nextTick,resolveComponent} from 'vue';
import {createI18n,useI18n} from 'vue-i18n';import Home from './app/pages/index.vue';import Hero from './app/components/cards/HeroCard.vue';import Categories from './app/components/cards/TopCategories.vue';import Banner from './app/components/cards/Banner.vue';import Social from './app/components/layout/FooterSocialIcon.vue';import Payments from './app/components/layout/FooterPayments.vue';import Continuation from './app/components/CatalogContinuation.vue';import {useCatalogContinuation} from './app/composables/useCatalogContinuation.js';
import en from './i18n/locales/en.json';import ar from './i18n/locales/ar.json';
const opt=window.__options,locale=opt.locale,mode=ref('home'),state=new Map(),leave=[];
const content=ref({settings:{site_name:'Synthetic fixture',hero_enabled:true,hero_layout_mode:opt.mode,hero_static_banner_id:'b',hero_rotation_seconds:60,homepage_reviews_enabled:false,banner_ad_1_enabled:true,banner_ad_1_image_url:'/banner.svg',banner_ad_2_enabled:true,banner_ad_2_image_url:'/banner.svg',footer_modern_config:{version:1,payments:{enabled:true,items:[{id:'card',method:'card',label:'CARD',image_url:'/card.svg',enabled:true},{id:'off',method:'instapay',label:'Inactive',image_url:'/card.svg',enabled:true}]}}},heroBanners:[{id:'a',image_url:'/hero.svg',link_url:'/shop',presentation:{mobile_image_url:'/mobile.svg',title_en:'Synthetic offer',title_ar:'عرض تجريبي',body_en:'Authored fixture text.',body_ar:'نص تجريبي.',cta_en:'Shop',cta_ar:'تسوّق'}},{id:'b',image_url:'/static.svg',link_url:'/shop',presentation:{title_en:'Static fixture',title_ar:'بانر ثابت'}}]});
const cats=[{id:'c',name:'Synthetic category',name_ar:'قسم تجريبي',slug:'synthetic',displayImageUrl:'/category.svg'}];
Object.assign(globalThis,{ref,shallowRef,reactive,computed,watch,onMounted,onBeforeUnmount,nextTick,resolveComponent,useI18n,useState:(k,init)=>{if(!state.has(k))state.set(k,ref(init()));return state.get(k)},useSiteContent:()=>({data:content}),useCategoryLocale:()=>({categoryName:r=>locale==='ar'?r.name_ar:r.name}),useUiLocale:()=>({uiLabel:v=>v}),useSupabaseClient:()=>({}),useSupabaseUser:()=>ref(null),useRuntimeConfig:()=>({public:{siteUrl:'https://fixture.invalid'}}),usePageSeo:()=>{},useAsyncData:()=>({data:ref({latestImage:'/hero.svg',topCategories:cats,featuredProducts:[],topSellerProducts:[],categorySections:[],featuredBrands:[]}),pending:ref(false),error:ref(null)}),usePurchaseAccess:()=>({purchasingEnabled:ref(true),capabilities:ref({card:{available:true},purchase:{paymentMethods:['card','cash']},manualTransfer:{available:false},express:[]})}),onBeforeRouteLeave:fn=>leave.push(fn)});
const key=ref('first'),enabled=ref(true),initial=ref({key:'first',page:1,pages:4,products:Array.from({length:12},(_,i)=>({id:'p'+i,slug:'product-'+i}))}),requests=[],pending=[];let fail=false,delay=false;
const Catalog={setup(){const c=reactive(useCatalogContinuation({key,initial,enabled,fetchPage:async(page,signal)=>{requests.push({key:key.value,page});if(delay)await new Promise(r=>pending.push(r));if(signal.aborted)throw Error('aborted');if(fail)throw Error('fixture failure');return {page,pages:4,products:Array.from({length:12},(_,i)=>({id:'p'+((page-1)*11+i),slug:'product-'+((page-1)*11+i)}))}}}));window.__catalog=c;return()=>h('div',[...c.products.map(p=>h('article',{key:p.id,class:'catalog-row',style:'height:95px'},[h('a',{href:'/fixture-detail',onClick:e=>{e.preventDefault();leave.forEach(f=>f());history.pushState({},'','/fixture-detail');mode.value='detail'}},p.slug)])),h(Continuation,{enabled:enabled.value,hasMore:c.hasMore,bounded:c.bounded,loading:c.loading,failed:c.failed,next:'/shop?page='+(c.page+1),onLoad:c.loadMore})])}};
const app=createApp({setup(){return()=>h('div',{class:'storefront'},[h(Suspense,{key:mode.value},{default:()=>mode.value==='home'?h(Home):mode.value==='catalog'?h(Catalog):h('p','Synthetic detail')}),h('footer',[h(Social,{platform:'facebook'}),h(Social,{platform:'instagram'}),h(Social,{platform:'x'}),h(Payments,{settings:content.value.settings})])])}});app.use(createI18n({legacy:false,locale,messages:{en,ar}}));
for(const [name,c] of Object.entries({CardsHeroCard:Hero,TopCategories:Categories,CardsBanner:Banner,LayoutFooterPayments:Payments}))app.component(name,c);
for(const name of ['OfferSlider','HomeCustomerReviews','NpsSurvey'])app.component(name,{render:()=>null});
app.component('Icon',{render:()=>h('span',{'aria-hidden':'true'})});app.component('NuxtLinkLocale',{props:['to'],setup(p,{slots}){return()=>h('a',{href:typeof p.to==='string'?p.to:p.to?.path},slots.default?.())}});app.config.globalProperties.$uiLabel=v=>v;app.mount('#app');
window.__fixture={content,mode,key,initial,enabled,requests,pending,nextTick,fail:v=>fail=v,delay:v=>delay=v};window.addEventListener('popstate',()=>{mode.value=location.pathname==='/fixture-detail'?'detail':'catalog'});`
const compiled=await build({stdin:{contents:helper,resolveDir:resolve('.'),sourcefile:'discovery-fixture.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','import.meta.server':'false','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'vue',setup(b){b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]})
const css=(await Promise.all(['storefront','modern-footer'].map(n=>readFile('app/assets/css/'+n+'.css','utf8')))).join('\n')
let options
const server=createServer((req,res)=>{
 if(req.url==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(compiled.outputFiles[0].text);return}
 if(req.url?.endsWith('.svg')){res.setHeader('content-type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="720"><rect width="1440" height="720" fill="#cbd5e1"/><circle cx="1000" cy="300" r="150" fill="#334155"/></svg>');return}
 res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="'+options.locale+'" dir="'+(options.locale==='ar'?'rtl':'ltr')+'" class="'+(options.dark?'dark':'')+'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}'+css+'</style><div id="app"></div><script>window.__options='+JSON.stringify(options)+'</script><script src="/fixture.js"></script></html>')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
if(process.env.PAYMENT_REVIEW_ARTIFACTS)await mkdir(process.env.PAYMENT_REVIEW_ARTIFACTS,{recursive:true})
try{for(const [name,type]of [['chromium',chromium],['webkit',webkit]])await test(name+' actual homepage and catalog continuation',{timeout:180000},async t=>{
 const browser=await type.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})})
 try{
  for(const mode of ['carousel','banner','both'])for(const width of [390,768,1440])for(const locale of ['en','ar'])await t.test(mode+' '+width+' '+locale,async()=>{
   options={mode,locale,dark:locale==='ar'};const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(external.push(route.request().url()),route.abort()))
   try{await page.goto(origin);await page.locator('.store-hero').waitFor();const hero=await page.locator('.store-hero').boundingBox();assert.ok(hero.height>=270);assert.equal(await page.locator('.store-hero-side').count(),mode==='both'?1:0);assert.equal(await page.locator('.store-hero-controls').count(),mode==='banner'?0:1)
    assert.equal(await page.locator('.store-hero-image').getAttribute('src'),mode==='banner'?'/static.svg':'/hero.svg')
    const circle=await page.locator('.store-category-image').evaluate(el=>({radius:getComputedStyle(el).borderRadius,overflow:getComputedStyle(el).overflow}));assert.equal(circle.radius,'50%');assert.equal(circle.overflow,'hidden')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);assert.deepEqual(external,[])
    if(width===390&&mode!=='banner')assert.ok((await page.locator('.store-hero-image').evaluate(el=>el.currentSrc)).endsWith('/mobile.svg'))
    if(width===390&&process.env.PAYMENT_REVIEW_ARTIFACTS)await page.screenshot({path:resolve(process.env.PAYMENT_REVIEW_ARTIFACTS,name+'-'+mode+'-'+locale+'.png'),fullPage:true})
   }finally{await context.close()}
  })
  await t.test('automatic append, deduplication, failure/retry, filters, cancellation and browser Back',async()=>{
   options={mode:'both',locale:'en',dark:false};const context=await browser.newContext({viewport:{width:390,height:850}}),page=await context.newPage()
   try{await page.goto(origin);await page.locator('.store-hero').waitFor();await page.evaluate(()=>window.__fixture.mode.value='catalog');await page.locator('.catalog-row').first().waitFor();assert.equal(await page.locator('.catalog-row').count(),12)
    await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForFunction(()=>window.__catalog.page===2);assert.equal(await page.locator('.catalog-row').count(),23)
    await page.evaluate(()=>window.__fixture.fail(true));await page.evaluate(()=>window.__catalog.loadMore());await page.getByRole('alert').waitFor();assert.equal(await page.locator('.catalog-row').count(),23)
    await page.evaluate(()=>window.__fixture.fail(false));await page.getByRole('button',{name:'Load more',exact:true}).click();await page.waitForFunction(()=>window.__catalog.page===3);assert.equal(await page.locator('.catalog-row').count(),34)
    await page.locator('.catalog-row a').nth(20).click();await page.getByText('Synthetic detail',{exact:true}).waitFor();await page.goBack();await page.waitForFunction(()=>window.__catalog.page===3);assert.equal(await page.locator('.catalog-row').count(),34)
    await page.evaluate(()=>{const f=window.__fixture;f.key.value='filtered';f.initial.value={key:'filtered',page:1,pages:3,products:[{id:'filtered',slug:'filtered'}]}});await page.waitForFunction(()=>window.__catalog.products.length===1)
    await page.evaluate(()=>{window.__fixture.delay(true);window.__catalog.loadMore()});await page.waitForFunction(()=>window.__catalog.loading);await page.evaluate(()=>{const f=window.__fixture;f.key.value='last';f.initial.value={key:'last',page:1,pages:1,products:[{id:'last',slug:'last'}]};f.pending.splice(0).forEach(fn=>fn())});await page.waitForFunction(()=>window.__catalog.products[0]?.id==='last');assert.equal(await page.locator('.catalog-row').count(),1)
   }finally{await context.close()}
  })
 }finally{await browser.close()}
})}finally{await new Promise(r=>server.close(r))}
