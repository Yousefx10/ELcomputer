// Public build + real Vue SSR checks; no credentials, providers or database access.
import './email-artifacts.mjs'
import assert from 'node:assert/strict'
import { readFile,writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { parse,compileScript } from '@vue/compiler-sfc'
import { createSSRApp,h,onBeforeUnmount } from 'vue'
import { renderToString } from '@vue/server-renderer'
const base=JSON.parse(await readFile('/private/tmp/email-artifact-report.json','utf8')),components={}
for(const [name,path] of Object.entries({Settings:'app/components/after-sales/CommunicationSettings.vue',History:'app/components/after-sales/Communications.vue',Detail:'app/components/after-sales/Detail.vue',Page:'app/pages/dashboard/after-sales/index.vue'})){
 const {descriptor}=parse(await readFile(path,'utf8')),source=compileScript(descriptor,{id:'communication-ssr-'+name,inlineTemplate:true}).content
 const result=await build({stdin:{contents:source,resolveDir:resolve(path,'..'),loader:'js'},bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'same-vue',setup(b){b.onResolve({filter:/^vue$/},()=>({path:import.meta.resolve('vue'),external:true}))}}]})
 components[name]=(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default
}
let requests=0,cases=0,allowed=false
Object.assign(globalThis,{onBeforeUnmount,useHead:fn=>fn(),useUiLocale:()=>({intlLocale:{value:'en'}}),useAdminAccess:()=>({hasPermission:()=>allowed}),useSupportClient:()=>({request:()=>{requests++;throw Error('SSR requested private Claim data.')}})})
useUiRoute().query.tab='communications'
for(const language of ['en','ar'])for(const role of ['customer','viewer','owner'])for(const [name,component] of Object.entries(components)){
 useI18n().locale.value=language;allowed=role!=='customer'
 const app=createSSRApp({render:()=>h(component,{id:'11111111-1111-4111-8111-111111111111',claimId:'11111111-1111-4111-8111-111111111111',staff:role!=='customer'})})
 // Use the same i18n instance exposed by the existing artifact harness.
 const {createI18n}=await import('vue-i18n');app.use(createI18n({legacy:false,locale:language,messages:{[language]:JSON.parse(await readFile('i18n/locales/'+language+'.json','utf8'))}}))
 app.component('AfterSalesCommunicationSettings',components.Settings);app.component('AfterSalesCommunications',components.History);for(const name of ['AccountItemWarranty','AfterSalesEvidencePicker','AfterSalesReverseLogistics','AfterSalesTimeline'])app.component(name,{render:()=>null});app.component('AfterSalesCenter',{render:()=>h('div','Claims')});app.component('NuxtLinkLocale',{props:['to'],setup:(p,{slots})=>()=>h('a',{href:p.to},slots.default?.())});app.component('Icon',{render:()=>h('span')})
 const html=await renderToString(app)
 for(const secret of ['purchase-contact@email.example.invalid','claims-fixture-private-brevo-key-over-32-characters','BROWSER-COMMUNICATION-PRIVATE-NOTE','work_token','template_snapshot'])assert.ok(!html.includes(secret),name+' exposed '+secret)
 assert.ok(!/\b(?:claims|claimCommunications)\.[A-Za-z]/.test(html),'Untranslated SSR '+name)
 cases++
}
assert.equal(requests,0)
const report={...base,claimSSRCases:cases,totalSSRCases:base.ssrCases+cases,privateSSRRequests:requests};await writeFile('/private/tmp/claim-communication-artifact-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
