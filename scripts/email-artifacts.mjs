// Read-only public build and real Vue SSR canary review. No provider/database calls.
import assert from 'node:assert/strict'
import { readdir,readFile,writeFile } from 'node:fs/promises'
import { resolve,join } from 'node:path'
import { build } from 'esbuild'
import { parse,compileScript } from '@vue/compiler-sfc'
import { createSSRApp,ref,reactive,computed,onMounted,watch,h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createI18n } from 'vue-i18n'
const canaries=['email-fixture-private-api-key-canary-over-32-characters','email-fixture-private-webhook-canary-over-32-characters','email-fixture-master-over-32-characters','email-fixture-worker-over-32-characters','browser-replacement-private-api-key-over-32-characters']
let publicFiles=0,publicBytes=0,ssrCases=0,requests=0
const visit=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await visit(path);else{const value=await readFile(path);publicFiles++;publicBytes+=value.length;for(const secret of [...canaries,'emailWorkerSecret','credentialsEncryptionKey','webhook_token_encrypted'])assert.ok(!value.includes(secret),'Private field/canary in public '+path)}}}
await visit(resolve('.output/public'))
const {descriptor}=parse(await readFile('app/pages/dashboard/email.vue','utf8')),source=compileScript(descriptor,{id:'email-ssr',inlineTemplate:true}).content
const compiled=await build({stdin:{contents:source,resolveDir:resolve('app/pages/dashboard'),loader:'js'},bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'same-vue-runtime',setup(builder){builder.onResolve({filter:/^vue$/},()=>({path:import.meta.resolve('vue'),external:true}))}}]})
const Email=(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
const messages={en:JSON.parse(await readFile('i18n/locales/en.json','utf8')),ar:JSON.parse(await readFile('i18n/locales/ar.json','utf8'))},route=reactive({query:{tab:'settings'}}),i18n=createI18n({legacy:false,locale:'en',messages})
Object.assign(globalThis,{ref,reactive,computed,onMounted,watch,definePageMeta:()=>{},useI18n:()=>i18n.global,useUiLocale:()=>({uiMessage:x=>x}),useUiRoute:()=>route,useSupportClient:()=>({request:()=>{requests++;throw Error('SSR must not fetch private email data.')}}),useAdminAccess:()=>({hasPermission:()=>true})})
for(const lang of ['en','ar'])for(const tab of ['settings','templates','send','history','events','preferences']){
 i18n.global.locale.value=lang;route.query.tab=tab
 const app=createSSRApp(Email);app.use(i18n);app.component('NuxtLinkLocale',{props:['to'],setup:(props,{slots})=>()=>h('a',{href:props.to},slots.default?.())})
 const html=await renderToString(app);for(const secret of canaries)assert.ok(!html.includes(secret),'Secret in SSR');assert.ok(!html.includes('emailFoundation.'),'Untranslated SSR label');ssrCases++
}
assert.equal(requests,0)
const report={publicFiles,publicBytes,ssrCases,privateSSRRequests:requests,secretsExposed:0,realProviderCalls:0};await writeFile('/private/tmp/email-artifact-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
