import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { normalizeTariff, tariffReadiness, tariffDiff } from '../app/utils/shippingTariffs.js'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

const supplied = JSON.parse(await readFile('docs/operations/shipping-tariffs/last-mile-owner-draft-v1.json'))
const document = () => structuredClone(supplied)

test('owner tariff contains six exact rates and explicit unresolved commercial terms', () => {
  const d = normalizeTariff(document())
  assert.deepEqual(d.zones.map(z => z.base_price), ['60.00','65.00','75.00','85.00','95.00','105.00'])
  assert.ok(d.zones.every(z => z.additional_kg_price === '5.00'))
  assert.equal(d.base_weight_kg, '2.000'); assert.equal(d.volumetric_divisor, 5000)
  assert.equal(d.vat_percent, '14.00'); assert.equal(d.cod_percent, '0.50'); assert.equal(d.insurance_percent, '0.70')
  assert.equal(d.failed_delivery_percent, '50.00'); assert.equal(d.invoice_days, 14)
  assert.equal(d.effective_from, null); assert.equal(d.product_confirmed, false); assert.equal(d.insurance_enabled, false)
  assert.equal(d.extra_weight_rounding, 'unverified'); assert.equal(d.automatic_annual_increase, false)
  assert.equal(d.mappings.length, 382); assert.ok(d.mappings.every(m => m.review_state === 'unverified'))
  assert.equal(d.mappings.filter(m => m.candidate_zone_ids.length > 1).length, 93)
  assert.equal(d.mappings.find(m => m.provider_city_id === 367).zone_id, 2)
  assert.deepEqual(d.mappings.find(m => m.provider_city_id === 98).candidate_zone_ids, [])
  assert.equal(tariffReadiness(d).checkout_eligible, false)
})

test('decimal configuration is exact, bounded, complete and never silently merged', () => {
  const d = document(); d.zones[0].base_price = '0.1'
  assert.equal(normalizeTariff(d).zones[0].base_price, '0.10')
  for (const value of ['-1', '1e2', 'NaN', '0.001', ' 5', 0.5]) {
    const x = document(); x.zones[0].base_price = value; assert.throws(() => normalizeTariff(x))
  }
  for (const mutate of [x => { delete x.cod_percent }, x => { x.secret = 'rejected' }, x => { x.zones[1].id = 1 }, x => { x.mappings.push(x.mappings[0]) }, x => { x.effective_from = '2026-02-30' }, x => { x.vat_percent = '100.01' }, x => { x.automatic_annual_increase = true }, x => { x.provider = 'unknown-adapter' }]) {
    const x = document(); mutate(x); assert.throws(() => normalizeTariff(x))
  }
  const old = document(), changed = document(); changed.effective_from = '2027-01-05'
  assert.deepEqual(tariffDiff(old, changed), [{ field:'effective_from', before:null, after:'2027-01-05' }])
})

test('verification requires explicit terms, exact current aliases and cached service/coverage', () => {
  const d = document(); d.product_id = 77; d.product_confirmed = d.validity_confirmed = d.surcharges_confirmed = true
  d.effective_from = '2027-03-14'; d.extra_weight_rounding = 'pro_rata'; d.vat_scope = 'freight_only'; d.cod_basis = 'collected_amount'; d.failed_delivery_basis = 'freight_ex_vat'
  d.mappings = [{ ...d.mappings[0], zone_id:1, review_state:'confirmed' }]
  const context = { products:[{id:77}], cities:[{id:d.mappings[0].provider_city_id}], aliases:d.mappings }
  assert.equal(tariffReadiness(d, context).can_verify, true)
  assert.equal(tariffReadiness(d, context).checkout_eligible, false)
  assert.ok(tariffReadiness(d, {...context,aliases:[]}).issues.includes('mappings_not_matched'))
  assert.ok(tariffReadiness(d, {...context,aliases:[...context.aliases,{...d.mappings[0],provider_city_id:999999}]}).issues.includes('mappings_not_matched'))
  assert.ok(tariffReadiness(d, {...context,cities:[]}).issues.includes('cities_not_cached'))
  assert.ok(tariffReadiness(d, {...context,products:[]}).issues.includes('product_not_cached'))
  d.mappings[0].review_state = 'excluded'
  assert.ok(tariffReadiness(d, context).issues.includes('no_confirmed_areas'))
})

test('tariff SQL, actual HTTP RBAC, revisions, replay and reset retention', { skip:!emailNativeAvailable, timeout:180000 }, async t => {
  const f = await createCodCheckoutFixture({ routes:[
    ['get','/api/admin-shipping/companies/:id/tariffs','server/api/admin-shipping/companies/[id]/tariffs.get.js'],
    ['post','/api/admin-shipping/companies/:id/tariffs','server/api/admin-shipping/companies/[id]/tariffs.post.js']
  ] })
  const company=randomUUID(), other=randomUUID(), manual=randomUUID(), id=randomUUID()
  const path='/api/admin-shipping/companies/'+company+'/tariffs'
  const call=(body,actor='owner')=>f.call(path,{method:'POST',body,actor})
  const command=(d=document(), extra={})=>({action:'save',tariff_id:id,command_id:randomUUID(),expected_revision:0,document:d,...extra})
  const count=async()=>(await f.db.query('select (select count(*)::int from private.shipping_tariffs) versions,(select count(*)::int from private.shipping_tariff_revisions) revisions')).rows[0]
  const read=async()=>(await f.call(path,{actor:'owner'})).body
  try {
    await f.db.query("insert into public.commerce_shipping_companies(id,name,provider) values($1,'Synthetic carrier','pdc'),($2,'Other carrier','pdc'),($3,'Manual carrier','manual')",[company,other,manual])
    const before=(await f.db.query("select to_jsonb(s) data from public.shipping_provider_settings s where id='pdc'")).rows[0].data
    await t.test('new migration seeds no business tariffs and preserves reset coverage',async()=>{
      assert.deepEqual(await count(),{versions:0,revisions:0})
      await f.db.query('select catalog_private.reset_assert_coverage()')
      await f.db.query('create table private.unreviewed_tariff_test(id int)')
      await assert.rejects(()=>f.db.query('select catalog_private.reset_assert_coverage()'),/Unrecognized/)
      await f.db.query('drop table private.unreviewed_tariff_test')
    })
    await t.test('HTTP routes preserve active-staff permission checks and private caching',async()=>{
      for(const actor of [null,'invalid','customer','viewer','disabled']){
        const expected=!actor||actor==='invalid'?401:403
        assert.equal((await f.call(path,{actor})).response.status,expected)
        assert.equal((await call(command(),actor)).response.status,expected)
      }
      await f.db.query("update public.admin_users set permissions=permissions||'{\"settings.edit\":true}' where id=$1",[f.actors.editor])
      assert.equal((await f.call(path,{actor:'editor'})).response.status,403)
      const denied=await f.client.rpc('shipping_tariff_read',{p_admin:f.actors.editor,p_company:company})
      assert.equal(denied.error.code,'42501')
      await f.db.query("update public.admin_users set permissions=permissions||'{\"settings.view\":true}' where id=$1",[f.actors.editor])
      const r=await f.call(path,{actor:'editor'});assert.equal(r.response.status,200,JSON.stringify(r.body))
      assert.equal(r.response.headers.get('cache-control'),'private, no-store')
      assert.equal(JSON.stringify(r.body).includes('encrypted'),false)
      assert.equal((await f.call('/api/admin-shipping/companies/'+manual+'/tariffs',{actor:'owner'})).response.status,400)
    })
    let saved
    await t.test('preview has zero writes; explicit draft save is durable and idempotent',async()=>{
      const preview=await call({...command(),action:'preview'})
      assert.equal(preview.response.status,200,JSON.stringify(preview.body));assert.equal(preview.body.readiness.can_verify,false)
      assert.equal(preview.body.checkout_eligible,false);assert.deepEqual(await count(),{versions:0,revisions:0})
      saved=command();const result=await call(saved);assert.equal(result.response.status,200,JSON.stringify(result.body))
      const replay=await call(saved);assert.equal(replay.response.status,200,JSON.stringify(replay.body));assert.equal(replay.body.replayed,true)
      assert.deepEqual(await count(),{versions:1,revisions:1})
      assert.equal((await call({...saved,document:{...saved.document,title:'Different request'}})).response.status,409)
      assert.equal((await read()).selected.document.effective_from,null)
    })
    await t.test('concurrent saves use real revision locking; history retains the original rates',async()=>{
      const d=document();d.zones[0].base_price='61.00'
      const results=await Promise.all([call(command(d,{expected_revision:1})),call(command({...d,title:'Competing change'},{expected_revision:1}))])
      assert.deepEqual(results.map(r=>r.response.status).sort(),[200,409])
      assert.deepEqual(await count(),{versions:1,revisions:2})
      const historic=await f.call(path+'?tariff='+id+'&revision=1',{actor:'owner'})
      assert.equal(historic.body.selected.document.zones[0].base_price,'60.00')
      assert.equal(historic.body.selected.viewed_revision,1)
      const wrongCompany=await f.call('/api/admin-shipping/companies/'+other+'/tariffs?tariff='+id,{actor:'owner'})
      assert.equal(wrongCompany.response.status,400)
    })
    await t.test('unverified terms cannot freeze a version, including direct service RPC',async()=>{
      assert.equal((await call(command(document(),{action:'verify',expected_revision:2}))).response.status,400)
      assert.deepEqual(await count(),{versions:1,revisions:2})
      for(const role of ['anon','authenticated','service_role']){
        const db=await f.db.connect(role)
        try { await assert.rejects(()=>db.query('select * from private.shipping_tariffs'));if(role!=='service_role')await assert.rejects(()=>db.query('select public.shipping_tariff_read($1,$2)',[f.actors.owner,company])) }
        finally{await db.end()}
      }
    })
    await t.test('explicit verification freezes configuration without changing checkout or operational settings',async()=>{
      const d=document();d.mappings=[{...d.mappings[0],zone_id:1,review_state:'confirmed'}]
      d.product_id=77;d.product_confirmed=d.validity_confirmed=d.surcharges_confirmed=true
      d.effective_from='2027-03-14';d.extra_weight_rounding='ceil_kg';d.vat_scope='freight_only';d.cod_basis='collected_amount';d.failed_delivery_basis='freight_ex_vat'
      await f.db.query("update public.shipping_provider_settings set products_cache='[{\"id\":77,\"name\":\"Synthetic service\"}]',cities_cache='[{\"id\":1,\"name\":\"Synthetic city\"}]' where id='pdc'")
      const verified=command(d,{action:'verify',expected_revision:2})
      const result=await call(verified);assert.equal(result.response.status,200,JSON.stringify(result.body));assert.equal(result.body.status,'verified');assert.equal(result.body.checkout_eligible,false)
      assert.equal((await call(verified)).body.replayed,true)
      assert.equal((await call(command(d,{expected_revision:3}))).response.status,409)
      const next=command({...d,title:'Next version',validity_confirmed:false},{tariff_id:randomUUID()})
      assert.equal((await call(next)).response.status,200)
      const versions=(await read()).versions;assert.deepEqual(versions.map(v=>[v.version,v.status]),[[2,'draft'],[1,'verified']])
      const after=(await f.db.query("select to_jsonb(s) data from public.shipping_provider_settings s where id='pdc'")).rows[0].data
      delete before.products_cache;delete before.cities_cache;delete after.products_cache;delete after.cities_cache
      assert.deepEqual(after,before)
      assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
      const controls=(await f.db.query('select checkout_enabled,checkout_governorates from public.commerce_shipping_companies where id=$1',[company])).rows[0]
      assert.deepEqual(controls,{checkout_enabled:false,checkout_governorates:[]})
      const prior=await count();await f.db.query('delete from public.commerce_shipping_companies where id=$1',[company]);assert.deepEqual(await count(),prior)
      await f.db.query('select catalog_private.reset_assert_coverage()')
    })
  } finally { await f.close() }
})
