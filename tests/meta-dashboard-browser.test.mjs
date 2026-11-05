import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
const {chromium,webkit}=await import(process.env.COD_REVIEW_PLAYWRIGHT)
const helper=`import {createApp,h,ref,computed,onMounted,onBeforeUnmount} from 'vue';import Page from './app/pages/dashboard/marketing.vue';
const adminUser=ref({role:window.__fixture.viewer?'staff':'owner',is_active:true,permissions:{'settings.view':true}});let invalidate;
Object.assign(globalThis,{ref,computed,onMounted,onBeforeUnmount,definePageMeta:()=>{},useAdminAccess:()=>({adminUser}),useCustomerScope:()=>({onInvalidate:f=>invalidate=f}),useSupportClient:()=>({request:async(path,options={})=>{window.__requests.push({path,...options});if(options.method==='PATCH'){if(window.__failure)throw Error('fixture failure');return {...options.body.config,revision:1,tokenSet:true}}return {settings:{enabled:false,capiEnabled:false,pixelId:'123456789',graphVersion:'v26.0',testEventCode:'',tokenSet:true,revision:0},diagnostics:{counts:{},recent:[]}}}})});
const app=createApp({render:()=>h(Page)});app.config.globalProperties.$t=k=>k.split('.').reduce((o,x)=>o?.[x],window.__fixture.messages)||k;app.mount('#app');window.__invalidate=()=>invalidate();`
const output=await build({stdin:{contents:helper,sourcefile:'dashboard-fixture.js',resolveDir:resolve('.')},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'vue',setup(b){b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,loader:'js',resolveDir:dirname(path)}))}}]})
const cssDir=process.env.CHECKOUT_REVIEW_CSS_DIR||'../../release-a/source/.output/public/_nuxt',css=(await Promise.all((await readdir(cssDir)).filter(x=>x.endsWith('.css')).map(x=>readFile(cssDir+'/'+x,'utf8')))).join('\n'),messages=Object.fromEntries(await Promise.all(['en','ar'].map(async lang=>[lang,JSON.parse(await readFile('i18n/locales/'+lang+'.json','utf8'))])))
let fixture
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html;charset=utf-8');res.end(req.url==='/fixture.js'?output.outputFiles[0].text:'<!doctype html><html lang="'+fixture.lang+'" dir="'+(fixture.lang==='ar'?'rtl':'ltr')+'" class="'+(fixture.dark?'dark':'')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script>window.__requests=[];window.__fixture='+JSON.stringify(fixture)+'</script><script src="/fixture.js"></script></body></html>')})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
try{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]])await test(engine+' protected Meta Dashboard',{timeout:60000},async t=>{
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})})
 try{
  for(const lang of ['en','ar'])for(const width of [390,1440])await t.test(lang+' '+width+' private token, failed save and account change',async()=>{
   fixture={lang,messages:messages[lang],dark:width===390};const page=await browser.newPage({viewport:{width,height:900}}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()))
   await page.goto(origin);await page.locator('input[type=password]').waitFor();assert.equal(await page.locator('input[type=password]').inputValue(),'');assert.equal(await page.locator('form').evaluate(f=>f.checkValidity()),true)
   await page.locator('input[type=password]').fill('LOCAL_BROWSER_TOKEN_NO_PROVIDER');await page.evaluate(()=>window.__failure=true);await page.getByRole('button',{name:messages[lang].common.save,exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('input[type=password]').inputValue(),'LOCAL_BROWSER_TOKEN_NO_PROVIDER')
   await page.evaluate(()=>window.__failure=false);await page.getByRole('button',{name:messages[lang].common.save,exact:true}).click();await page.getByRole('status').waitFor();assert.equal(await page.locator('input[type=password]').inputValue(),'')
   assert.ok((await page.evaluate(()=>window.__requests)).filter(x=>x.method==='PATCH').every(x=>x.retry===0&&x.body.revision===0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await page.evaluate(()=>window.__invalidate());assert.equal(await page.locator('form').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await page.close()
  })
  await t.test('settings viewer cannot submit changes',async()=>{fixture={lang:'en',messages:messages.en,viewer:true};const page=await browser.newPage();await page.goto(origin);await page.locator('input[type=password]').waitFor();assert.equal(await page.getByRole('button',{name:messages.en.common.save,exact:true}).isDisabled(),true);await page.close()})
 }finally{await browser.close()}
})}finally{await new Promise(r=>server.close(r))}
