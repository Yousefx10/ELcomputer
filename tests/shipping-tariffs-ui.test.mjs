import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

test('actual tariff manager import, review, save recovery and EN/AR forms', { skip:!process.env.PDC_REVIEW_PLAYWRIGHT, timeout:90000 }, async t => {
  const { chromium } = await import(process.env.PDC_REVIEW_PLAYWRIGHT)
  const source = await readFile('app/components/dashboard/commerce/ShippingTariffManager.vue','utf8')
  const component = compileScript(parse(source).descriptor,{id:'tariff-fixture',inlineTemplate:true}).content.replace('export default','const Component =')
  const locales = Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile('i18n/locales/'+l+'.json','utf8'))])))
  const supplied = JSON.parse(await readFile('docs/operations/shipping-tariffs/last-mile-owner-draft-v1.json'))
  const prefix = `import {ref,computed,watch,toRaw,onMounted,onBeforeUnmount,createApp} from 'vue';
    import {normalizeTariff as norm,tariffDiff as diff,tariffReadiness as readiness} from './app/utils/shippingTariffs.js';
    const fixture=window.__fixture;window.__requests=[];window.__writes=0;const receipts=new Map();
    const translate=k=>{const v=k.split('.').reduce((p,n)=>p?.[n],${JSON.stringify(locales)}[fixture.locale]);if(typeof v!=='string')throw Error('Missing translation '+k);return v};
    const useI18n=()=>({locale:ref(fixture.locale),t:translate});const onBeforeRouteLeave=fn=>{window.__leave=fn};const onBeforeRouteUpdate=()=>{};
    const useSupportClient=()=>({request:async(path,options)=>{
      if(!path.endsWith('/tariffs')||options.retry!==0)throw Error('Unexpected request');
      const body=options.body?JSON.parse(JSON.stringify(options.body)):null;window.__requests.push(body||{action:'read'});
      if(!body){if(fixture.loadError)throw Error('Synthetic load failure');return {versions:fixture.record?[{...fixture.record,title:fixture.record.document.title}]:[],selected:fixture.record,history:[],context:fixture.context}}
      if(body.action==='preview'){const d=norm(body.document);return {document:d,diff:diff(fixture.record?.document||{},d),readiness:readiness(d,fixture.context),checkout_eligible:false}}
      if(body.action==='save'||body.action==='verify'){
        if(!receipts.has(body.command_id)){fixture.record={id:body.tariff_id,version:1,revision:1,viewed_revision:1,status:'draft',document:body.document};window.__writes++;receipts.set(body.command_id,{id:body.tariff_id,revision:1,status:'draft'})}
        if(fixture.loseSave&&!fixture.lost){fixture.lost=true;throw Error('Synthetic lost acknowledgement')};return receipts.get(body.command_id)
      }throw Error('Unexpected action')
    }});`
  const suffix = `createApp(Component,{company:{id:'00000000-0000-4000-8000-000000000001',name:'Synthetic carrier'}}).mount('#app');`
  const bundle = await build({stdin:{contents:prefix+'\n'+component+';\n'+suffix,resolveDir:resolve('.')},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}})
  let scenario
  const server = createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:`<!doctype html><html lang="${scenario.locale}" dir="${scenario.locale==='ar'?'rtl':'ltr'}"><head><style>body{margin:8px}*{box-sizing:border-box}.overflow-x-auto{overflow-x:auto}table{width:100%}button{min-height:40px}</style></head><body><div id="app"></div><script>window.__fixture=${JSON.stringify(scenario).replaceAll('<','\\u003c')}</script><script src="/fixture.js"></script></body></html>`)})
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
  const base = locale=>({locale,record:null,context:{aliases:supplied.mappings.map(m=>({provider_city_id:m.provider_city_id,governorate:m.governorate,city:m.city,city_arabic:m.city_arabic})),cities:[],products:[]}})
  let browser
  const pages=[]
  try {
    browser=await chromium.launch({headless:true,channel:'chrome'})
    const open=async locale=>{const page=await browser.newPage({viewport:{width:locale==='ar'?390:1100,height:900}});pages.push(page);page.setDefaultTimeout(7000);await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());await page.goto(origin);await page.getByRole('button',{name:locales[locale].shippingTariffs.save,exact:true}).waitFor();return page}
    const importDraft=async(page,locale)=>{
      await page.locator('input[type=file]').setInputFiles({name:'tariff.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(supplied))})
      await page.locator('[data-tariff-preview]').waitFor();assert.equal(await page.evaluate(()=>window.__writes),0)
      await page.getByRole('button',{name:locales[locale].shippingTariffs.usePreview,exact:true}).click()
    }
    await t.test('EN/AR import previews do not persist or invent effective dates',async()=>{
      for(const locale of ['en','ar']){
        scenario=base(locale);const page=await open(locale),errors=[];page.on('pageerror',e=>errors.push(e.message))
        await importDraft(page,locale)
        assert.equal(await page.getByLabel(locales[locale].shippingTariffs.from,{exact:true}).inputValue(),'')
        assert.equal(await page.getByLabel(locales[locale].shippingTariffs.base+' 1',{exact:true}).inputValue(),'60.00')
        assert.equal(await page.getByRole('button',{name:locales[locale].shippingTariffs.verify,exact:true}).isDisabled(),true)
        assert.equal(await page.getByLabel(locales[locale].shippingTariffs.insuranceSelected,{exact:true}).isChecked(),false)
        assert.deepEqual(await page.evaluate(()=>window.__requests.map(r=>r.action)),['read','preview'])
        assert.deepEqual(errors,[]);await page.close()
      }
    })
    await t.test('one explicit save creates a draft and reads its retained version',async()=>{
      scenario=base('en');const page=await open('en');await importDraft(page,'en')
      await page.getByRole('button',{name:locales.en.shippingTariffs.save,exact:true}).click()
      await page.waitForFunction(()=>window.__requests.length===4)
      assert.equal(await page.evaluate(()=>window.__writes),1)
      assert.deepEqual(await page.evaluate(()=>window.__requests.map(r=>r.action)),['read','preview','save','read'])
      await page.close()
    })
    await t.test('lost acknowledgement preserves the exact command and locks edits until recovery',async()=>{
      scenario={...base('en'),loseSave:true};const page=await open('en');await importDraft(page,'en')
      await page.getByRole('button',{name:locales.en.shippingTariffs.save,exact:true}).click()
      await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel(locales.en.shippingTariffs.name,{exact:true}).isDisabled(),true)
      await page.getByRole('button',{name:locales.en.shippingTariffs.recoverSave,exact:true}).click()
      await page.waitForFunction(()=>window.__requests.length===5)
      const requests=await page.evaluate(()=>window.__requests);assert.deepEqual(requests[2],requests[3]);assert.equal(await page.evaluate(()=>window.__writes),1)
      await page.close()
    })
    await t.test('city review is bounded and selecting a candidate never confirms other cities',async()=>{
      scenario=base('ar');const page=await open('ar');await importDraft(page,'ar')
      await page.getByText(locales.ar.shippingTariffs.mappings,{exact:false}).first().click()
      const first=page.getByRole('combobox',{name:locales.ar.shippingTariffs.zone+' 1',exact:true});await first.selectOption('1')
      assert.equal(await page.getByRole('combobox',{name:locales.ar.shippingTariffs.review+' 1',exact:true}).inputValue(),'unverified')
      assert.equal(await page.getByRole('combobox',{name:locales.ar.shippingTariffs.review+' 2',exact:true}).inputValue(),'unverified')
      assert.equal(await page.locator('select[aria-label]').count(),50)
      assert.equal(await page.evaluate(()=>window.__writes),0);await page.close()
    })
  } finally { for(const p of pages) await p.close().catch(()=>{});await browser?.close();await new Promise(r=>server.close(r)) }
})
