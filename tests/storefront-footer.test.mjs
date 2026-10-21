import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { normalizeModernFooter, resolveModernFooter, validateModernFooter, footerUrl, footerText, visibleFooterPayments } from '../app/utils/modernFooter.js'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('additive footer configuration preserves values, Settings RLS and nested image references', async () => {
  const db = await createResetDatabase({ stopBefore: '20261021190000' })
  try {
    await db.exec("insert into public.site_settings(key,footer_style,footer_modern_card_title) values('footer-test','modern','Saved legacy title')")
    await db.exec(read('supabase/migrations/20261021190000_modern_footer_configuration.sql'))
    const before = (await db.query("select footer_style,footer_modern_card_title,footer_modern_config from public.site_settings where key='footer-test'")).rows[0]
    assert.deepEqual(before,{footer_style:'modern',footer_modern_card_title:'Saved legacy title',footer_modern_config:null})
    const config = normalizeModernFooter({brand:{logo_url:'/uploads/settings/footer/kept.png'}})
    await db.query("update public.site_settings set footer_modern_config=$1 where key='footer-test'",[JSON.stringify(config)])
    assert.deepEqual((await db.query("select footer_modern_config from public.site_settings where key='footer-test'")).rows[0].footer_modern_config,config)
    assert.deepEqual((await db.query('select * from catalog_private.media_references($1::jsonb)',[JSON.stringify({footer_modern_config:config})])).rows.map(Object.values).flat(),['/uploads/settings/footer/kept.png'])
    for(const value of [[],{}, {version:2}, {version:1,large:'x'.repeat(66000)}]) await assert.rejects(()=>db.query("update public.site_settings set footer_modern_config=$1 where key='footer-test'",[JSON.stringify(value)]))
    await db.exec('set role anon')
    assert.equal((await db.query("select footer_modern_config->>'version' version from public.site_settings where key='footer-test'")).rows[0].version,'1')
    await assert.rejects(()=>db.exec("update public.site_settings set footer_modern_config=null where key='footer-test'"))
    await db.exec('reset role; set role authenticated')
    await assert.rejects(()=>db.query("update public.site_settings set footer_modern_config=null where key='footer-test' returning id"))
    await db.exec('reset role')
  } finally { await db.close() }
})

test('legacy menus inherit without writes, missing optional services stay hidden', () => {
  const settings={site_name:'Independent store',footer_phone:'+123456',footer_modern_card_text:'Saved description',copyright_text:'Saved copyright'}
  const links=[{id:'a',section_title:'Help',label:'Help',url:'/help'},{id:'b',section_title:'Shop',label:'Shop',url:'/search'},{id:'c',section_title:'Legal',label:'Privacy',url:'/privacy'}]
  const config=resolveModernFooter(settings,links)
  assert.equal(config.brand.description,'Saved description')
  assert.deepEqual(config.columns.map(c=>c.links.length),[1,2])
  assert.equal(config.support.url,'tel:+123456')
  assert.equal(config.newsletter.state,'hidden');assert.equal(config.apps.enabled,false);assert.equal(config.payments.enabled,false)
  assert.equal(resolveModernFooter({...settings,footer_modern_config:normalizeModernFooter({})},links).columns[0].links.length,0,'Explicit empty configuration stays empty')
  assert.equal(settings.footer_modern_config,undefined)
})

test('URL validation rejects executable, ambiguous and placeholder links', () => {
  for(const value of ['javascript:alert(1)','data:text/html,foo','//evil.example','/\\evil','https://u:p@example.test','https://example.test/\nfoo','#','?','https://example.test/%0afoo'])assert.equal(footerUrl(value),'',value)
  for(const value of ['/help','/ar/search?q=mouse','https://store.example/policy'])assert.equal(footerUrl(value),value)
  assert.equal(footerUrl('tel:+123456','contact'),'tel:+123456');assert.equal(footerUrl('mailto:help@store.example','contact'),'mailto:help@store.example')
  assert.equal(footerUrl('/help','external'),'')
  assert.equal(footerUrl('/help','contact'),'/help')
  const config=normalizeModernFooter({columns:[{links:[{label:'Help',url:'javascript:alert(1)'}]}]})
  assert.equal(validateModernFooter(config),'links');config.columns[0].links[0].url='/help';assert.equal(validateModernFooter(config),'')
})

test('presentation toggles never enable payments; localization and ordering survive serialization', () => {
  const config=normalizeModernFooter({payments:{enabled:true,items:[{id:'paypal',method:'paypal',label:'PayPal',image_url:'/images/paypal.png'},{id:'card',method:'card',label:'Card',image_url:'/images/card.png'}]},newsletter:{state:'enabled'},columns:[{title:'Shop',title_ar:'Arabic shop',links:[{id:'two',url:'/help',label:'Two',badge:'New'},{id:'one',url:'/search',label:'One',enabled:false}]}]})
  assert.deepEqual(visibleFooterPayments(config,{}),[])
  assert.deepEqual(visibleFooterPayments(config,{payment_card_enabled:true}).map(x=>x.id),['card'])
  assert.equal(config.newsletter.state,'hidden')
  assert.equal(footerText(config.columns[0],'title','ar'),'Arabic shop')
  assert.deepEqual(normalizeModernFooter(JSON.parse(JSON.stringify(config))),config)
  assert.deepEqual(config.columns[0].links.map(x=>x.id),['two','one'])
})

test('Classic template and selectors stay identical to the accepted checkout', () => {
  const old=execFileSync('git',['show','89743fa:app/components/layout/Footer.vue'],{encoding:'utf8'})
  const classic=s=>s.slice(s.indexOf('  <footer v-else'),s.indexOf('</template>'))
  assert.equal(classic(read('app/components/layout/Footer.vue')),classic(old))
  const oldCss=execFileSync('git',['show','89743fa:app/assets/css/storefront.css'],{encoding:'utf8'})
  assert.equal(read('app/assets/css/storefront.css'),oldCss.split('\n').filter(line=>!line.includes('.store-footer-modern')).join('\n'))
  const settings=read('app/pages/dashboard/settings.vue')
  assert.match(settings,/saveSiteSettings\('footerSettings'\)/)
  assert.match(settings,/JSON\.stringify\(normalizedSettings\[field\]\)/)
})
