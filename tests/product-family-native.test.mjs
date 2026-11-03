import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { paymentFirstFixture } from './helpers/paymentFirstFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { validProductFamily, familyChoices } from '../app/utils/productFamily.js'
const migration='20261104010000_linked_product_presentation.sql'
test('linked standalone products reuse existing presentation authority and protect commerce', {skip:!emailNativeAvailable,timeout:240000},async t=>{
 const f=await paymentFirstFixture({stopBefore:migration}),q=async(sql,args=[])=>(await f.db.query(sql,args)).rows
 const save=async(id,family,{revision=0,request=randomUUID(),actor=f.actors.owner,client=f.db,extra={}}={})=>(await client.query('select public.catalog_save_product_presentation($1,$2,$3,$4,$5) v',[actor,id,request,revision,JSON.stringify({videos:[],related:[],compatible:[],family,...extra})])).rows[0].v
 try{
  const prepared=await f.prepare(),snapshot=await q('select snapshot from private.payment_checkout_sessions where id=$1',[prepared.session.id])
  const pre=await q("select pg_get_functiondef('public.catalog_save_product_presentation(uuid,uuid,uuid,bigint,jsonb)'::regprocedure) definition")
  const sql=await readFile('supabase/migrations/'+migration,'utf8')
  await t.test('DDL rollback leaves original function and catalog untouched',async()=>{await f.db.query('begin');await f.db.query(sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''));await f.db.query('rollback');assert.deepEqual(await q("select pg_get_functiondef('public.catalog_save_product_presentation(uuid,uuid,uuid,bigint,jsonb)'::regprocedure) definition"),pre)})
  await f.db.query(sql)
  const ids=[];for(const name of ['Black','White','Silver']){const p=await f.save(f.body({title:'Owned '+name,is_published:true}));ids.push(p.id)}
  const family={id:randomUUID(),axes:[{key:'color',label:'Color',label_ar:'اللون'}],members:ids.map((id,i)=>({product_id:id,values:{color:['Black','White','Silver'][i]},values_ar:{},color_hex:['#111111','#ffffff','#999999'][i]}))}
  const catalogBefore=await q('select id,to_jsonb(p) data from public.products p order by id'),variantsBefore=await q('select id,to_jsonb(p) data from public.product_variants p order by id')
  await t.test('one command links independently purchasable products with exact retry and audit',async()=>{
   const request=randomUUID();assert.equal((await save(ids[0],family,{request})).revision,1);assert.equal((await save(ids[0],family,{request})).replayed,true)
   const rows=await q('select content,revision from catalog_private.product_presentations where product_id=any($1) order by product_id',[ids]);assert.equal(rows.length,3);assert.ok(rows.every(r=>r.revision==='1'&&JSON.stringify(r.content.family)===JSON.stringify(rows[0].content.family)))
   assert.equal((await q('select count(*)::int n from catalog_private.product_presentation_receipts where request_id=$1',[request]))[0].n,1)
   await assert.rejects(save(ids[0],{...family,id:randomUUID()},{request}),e=>e.code==='22023')
  })
  await t.test('anon/customer/read-only/disabled editors cannot manage family or private helper',async()=>{
   for(const role of ['anon','authenticated','service_role']){const c=await f.db.connect(role);await assert.rejects(c.query('select catalog_private.sync_product_family($1,$2)',[ids[0],family]),e=>e.code==='42501');if(role!=='service_role')await assert.rejects(save(ids[0],family,{client:c,revision:1}),e=>e.code==='42501');await assert.rejects(c.query('select * from catalog_private.product_presentations'),e=>e.code==='42501')}
   for(const actor of ['customer','viewer','disabled'])if(f.actors[actor])await assert.rejects(save(ids[0],family,{actor:f.actors[actor],revision:1}),e=>e.code==='42501')
  })
  await t.test('duplicate members/combinations, unknown dimensions and foreign groups are rejected atomically',async()=>{
   for(const wrong of [ {...family,members:[family.members[0],family.members[0]]}, {...family,members:family.members.map(m=>({...m,values:{color:'Same'}}))}, {...family,axes:[{key:'evil',label:'Bad',label_ar:''}]}, {...family,members:family.members.slice(1)}, {...family,members:[...family.members,{...family.members[0],product_id:randomUUID()}]} ])await assert.rejects(save(ids[0],wrong,{revision:1}),e=>e.code==='22023')
   const other=(await f.save(f.body({is_published:true}))).id
   await assert.rejects(save(other,{...family,members:[...family.members,{product_id:other,values:{color:'Blue'},values_ar:{}}]}),e=>e.code==='22023')
   const category=randomUUID();await f.db.query("insert into public.categories(id,name,slug) values($1::uuid,'Unrelated',$2)",[category,category]);await f.db.query('update public.products set category_id=$1 where id=$2',[category,other])
   await assert.rejects(save(ids[0],{...family,members:[family.members[0],{product_id:other,values:{color:'Blue'},values_ar:{}}]},{revision:1}),e=>e.code==='22023')
  })
  await t.test('reorder propagates, keeps other presentation content, and makes stale saves conflict',async()=>{
   const editor=(await f.db.query('select public.catalog_product_presentation($1,$2) v',[f.actors.owner,ids[1]])).rows[0].v
   await save(ids[1],family,{revision:1,extra:{related:[f.product]}})
   const reordered={...family,members:[...family.members].reverse()};await save(ids[0],reordered,{revision:1})
   const row=(await q('select content,revision from catalog_private.product_presentations where product_id=$1',[ids[1]]))[0];assert.deepEqual(row.content.related,[f.product]);assert.equal(row.content.family.members[0].product_id,ids[2]);assert.equal(row.revision,'3')
   await assert.rejects(save(ids[1],family,{revision:Number(editor.revision)}),e=>e.code==='PT409')
  })
  await t.test('public output contains only canonical published members, no private fields',async()=>{
   await f.db.query('update public.products set is_published=false where id=$1',[ids[2]])
   const anon=await f.db.connect('anon');const result=(await anon.query('select public.get_product_presentation($1) v',[ids[0]])).rows[0].v
   assert.equal(result.family.members.length,2);assert.ok(result.family.members.every(row=>row.slug&&row.title&&!Object.hasOwn(row,'sku')&&!Object.hasOwn(row,'cost_price')))
   assert.equal((await anon.query('select public.get_product_presentation($1) v',[ids[2]])).rows[0].v,null)
   await f.db.query('update public.products set is_published=true where id=$1',[ids[2]])
  })
  await t.test('unlink clears only this association, preserving remaining family and identity',async()=>{
   await save(ids[0],null,{revision:2});assert.equal((await q('select content from catalog_private.product_presentations where product_id=$1',[ids[0]]))[0].content.family,null)
   const rows=await q('select content from catalog_private.product_presentations where product_id=any($1)',[ids.slice(1)]);assert.ok(rows.every(r=>r.content.family.members.length===2))
   const rev=(await q('select revision from catalog_private.product_presentations where product_id=$1',[ids[1]]))[0].revision;await save(ids[1],null,{revision:Number(rev)});assert.ok((await q('select content from catalog_private.product_presentations where product_id=any($1)',[ids])).every(r=>r.content.family===null))
   assert.deepEqual(await q('select id,to_jsonb(p) data from public.products p where id=any($1) order by id',[ids]),catalogBefore.filter(r=>ids.includes(r.id)))
   assert.deepEqual(await q('select id,to_jsonb(p) data from public.product_variants p where product_id=any($1) order by id',[ids]),variantsBefore.filter(r=>ids.includes(r.data.product_id)))
   assert.deepEqual(await q('select snapshot from private.payment_checkout_sessions where id=$1',[prepared.session.id]),snapshot)
  })
 }finally{await f.close()}
})
test('family validation and multidimensional links never invent combinations',()=>{
 const a=randomUUID(),b=randomUUID();const family={id:randomUUID(),axes:[{key:'capacity',label:'Capacity',label_ar:''},{key:'version',label:'Version',label_ar:''}],members:[{product_id:a,values:{capacity:'16 GB',version:'V1'},values_ar:{}},{product_id:b,values:{capacity:'32 GB',version:'V2'},values_ar:{}}]}
 assert.equal(validProductFamily(family),true);assert.equal(familyChoices(family,a,'capacity').length,1);assert.equal(validProductFamily({...family,members:[...family.members,family.members[0]]}),false)
})
