import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {prepareProductSave} from '../server/utils/productSave.js'
const migration='20261103140000_modern_product_options_accessories.sql'

test('native Modern SKU catalog, unchanged old payment snapshots and curated accessories', {skip:!emailNativeAvailable,timeout:240000}, async t=>{
 const f=await paymentFirstFixture({stopBefore:migration})
 const sql=await readFile('supabase/migrations/'+migration,'utf8')
 const ddl=sql.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')
 const scalar=async(sql,args=[])=>(await f.db.query(sql,args)).rows[0]
 const command=async(c,id,ids,revision=0,request=randomUUID(),actor=f.actors.owner)=>(await c.query('select public.catalog_save_product_presentation($1,$2,$3,$4,$5) v',[actor,id,request,revision,JSON.stringify({videos:[],related:[],compatible:ids})])).rows[0].v
 const prepare=async(product,variant,quantity=1)=>{
  const actor=await f.user(),cart=randomUUID(),order={first_name:'Owned',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'card',locale:'en'}
  const items=[{product_id:product,variant_id:variant,quantity}],revision=randomUUID()
  const review=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items])
  const result=await f.rpc('commerce_prepare_payment_checkout',[actor.id,cart,review.quoteId,order,items,revision])
  return {actor,cart,order,items,revision,review,session:result.checkout}
 }
 try{
  const old=await f.prepare(),oldSnapshot=await scalar('select snapshot from private.payment_checkout_sessions where id=$1',[old.session.id])
  const before=(await f.db.query('select id,to_jsonb(p) value from public.products p order by id')).rows
  const beforeVariants=(await f.db.query('select id,to_jsonb(v) value from public.product_variants v order by id')).rows
  const original=(await scalar("select pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure) value")).value
  await t.test('DDL transaction rollback restores function, view and columns without touching old rows',async()=>{
   await f.db.query('begin');await f.db.query(ddl);await f.db.query('rollback')
   assert.equal((await scalar("select count(*)::int value from information_schema.columns where table_name='product_variants' and column_name='option_values'")).value,0)
   assert.equal((await scalar("select pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure) value")).value,original)
   assert.deepEqual((await f.db.query('select id,to_jsonb(p) value from public.products p order by id')).rows,before)
  })
  await f.db.query(sql)
  await t.test('additive installation preserves catalog, all existing fields and a real pre-migration private snapshot',async()=>{
   assert.deepEqual((await f.db.query('select id,to_jsonb(p) value from public.products p order by id')).rows,before)
   assert.deepEqual((await f.db.query("select id,to_jsonb(v)-'sale_price'-'option_values' value from public.product_variants v order by id")).rows,beforeVariants)
   assert.deepEqual(await scalar('select snapshot from private.payment_checkout_sessions where id=$1',[old.session.id]),oldSnapshot)
  })
  const rows=[
   {name:'Black Red',code:'BLACK_RED',sku:'BKR-'+randomUUID(),color_name:'Black',color_hex:'#111111',sale_price:'150.25',option_values:{color:'Black',switch:'Red'}},
   {name:'Black Blue',code:'BLACK_BLUE',sku:'BKB-'+randomUUID(),color_name:'Black',color_hex:'#111111',sale_price:null,option_values:{color:'Black',switch:'Blue'}},
   {name:'White Red',code:'WHITE_RED',sku:'WHR-'+randomUUID(),color_name:'White',color_hex:'#FFFFFF',sale_price:'175.00',option_values:{color:'White',switch:'Red'}}
  ]
  const created=await f.save(f.body({is_published:true,variants:rows})),snapshot=await f.snapshot(created.id)
  const chosen=snapshot.variants.find(v=>v.code==='BLACK_RED'),inherited=snapshot.variants.find(v=>v.code==='BLACK_BLUE')
  await t.test('existing revision-protected product save stores real dimensional SKUs and optional prices',async()=>{
   assert.equal(snapshot.variants.length,3);assert.deepEqual(chosen.option_values,{color:'Black',switch:'Red'});assert.equal(Number(chosen.sale_price),150.25)
   assert.equal(inherited.sale_price,null);assert.ok(snapshot.variants.every(v=>v.stock_quantity===0&&Number(v.cost_price)===0))
   const read=await f.db.connect('anon')
   const publicRows=(await read.query('select * from public.storefront_product_variants where product_id=$1',[created.id])).rows
   assert.equal(publicRows.length,3);assert.ok(publicRows.every(v=>!Object.hasOwn(v,'cost_price')))
   await assert.rejects(read.query('select catalog_private.define_product_variants_before_modern($1,$2,$3)',[created.id,'[]',f.actors.owner]),e=>e.code==='42501')
  })
  await t.test('duplicate combinations, inconsistent dimensions and invalid prices roll back the entire save',async()=>{
   const counts=await f.counts(),saved=await f.snapshot(created.id)
   for(const variants of [
    rows.map((v,i)=>({...v,id:snapshot.variants.find(x=>x.code===v.code).id,...(i===1?{option_values:rows[0].option_values}:{})})),
    rows.map((v,i)=>({...v,id:snapshot.variants.find(x=>x.code===v.code).id,...(i===1?{option_values:{model:'Wrong dimensions'}}:{})})),
    rows.map((v,i)=>({...v,id:snapshot.variants.find(x=>x.code===v.code).id,...(i===1?{sale_price:'-1'}:{})}))
   ])await assert.rejects(f.save(f.body({slug:saved.product.slug,is_published:true,expected_revision:saved.revision,variants}),{operation:'update',id:created.id}))
   assert.deepEqual(await f.snapshot(created.id),saved);assert.deepEqual(await f.counts(),counts)
  })
  await t.test('CARD/COD review takes the selected server price, ignores parent copies and keeps the COD fee',async()=>{
   const s=await prepare(created.id,chosen.id,2)
   assert.equal(Number(s.review.orderValue),300.50)
   const cod=await f.rpc('commerce_checkout_quote',[s.actor.id,randomUUID(),{...s.order,payment_method:'cash'},s.items])
   assert.equal(Number(cod.orderValue),300.50);assert.equal(Number(cod.paymentFee),10)
   assert.equal(cod.lines[0].variantId,chosen.id);assert.deepEqual(cod.lines[0].variantOptions,{color:'Black',switch:'Red'})
   const inheritedQuote=await f.rpc('commerce_checkout_quote',[s.actor.id,randomUUID(),s.order,[{product_id:created.id,variant_id:inherited.id,quantity:1}]])
   assert.equal(Number(inheritedQuote.orderValue),125.50)
   await assert.rejects(f.rpc('commerce_checkout_quote',[s.actor.id,randomUUID(),s.order,[{product_id:created.id,variant_id:randomUUID(),quantity:1}]]))
  })
  await t.test('stock tracking still blocks unreceived units; sell-without-stock is explicit',async()=>{
   const actor=await f.user(),order={first_name:'Owned',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'cash'},items=[{product_id:created.id,variant_id:chosen.id,quantity:1}]
   await f.db.query("update public.site_settings set inventory_tracking_required=true,allow_out_of_stock_purchases=false where key='default'")
   await assert.rejects(f.rpc('commerce_checkout_quote',[actor.id,randomUUID(),order,items]))
   await f.db.query("update public.site_settings set inventory_tracking_required=false where key='default'")
   assert.equal(Number((await f.rpc('commerce_checkout_quote',[actor.id,randomUUID(),order,items])).orderValue),150.25)
  })
  await t.test('curated recommendations expose actual SKU price bounds with no private costs',async()=>{
   const parent=await f.save(f.body({is_published:true}))
   await command(f.db,parent.id,[created.id])
   const item=(await f.rpc('get_product_presentation',[parent.id])).compatible[0]
   assert.equal(Number(item.price),125.50);assert.equal(Number(item.max_price),175);assert.equal(Object.hasOwn(item,'cost_price'),false)
  })
  await t.test('a native COD order retains the exact SKU/options and remains unpaid',async()=>{
   const actor=await f.user(),cart=randomUUID(),order={first_name:'Owned',email:actor.email,phone:'01012345678',street_address:'Fixture street',city:f.city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:f.company,payment_method:'cash'},items=[{product_id:created.id,variant_id:chosen.id,quantity:1}]
   const quote=await f.rpc('commerce_checkout_quote',[actor.id,cart,order,items])
   await f.rpc('commerce_checkout_command',[actor.id,cart,quote.quoteId,order,items])
   const item=await scalar('select i.*,o.payment_status from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.checkout_cart_id=$1',[cart])
   assert.equal(item.variant_id,chosen.id);assert.deepEqual(item.variant_options,{color:'Black',switch:'Red'});assert.equal(Number(item.unit_price),150.25);assert.notEqual(item.payment_status,'paid')
  })
  await t.test('new verified native payment freezes the selected SKU, attributes and price across later edits',async()=>{
   const s=await prepare(created.id,chosen.id),a=await f.claim(s),loaded=await f.snapshot(created.id)
   const changed=loaded.variants.map(v=>({...v,...(v.id===chosen.id?{sale_price:999,option_values:{color:'Black',switch:'Brown'}}:{})}))
   await f.save(f.body({slug:loaded.product.slug,price:'500',is_published:true,expected_revision:loaded.revision,variants:changed}),{operation:'update',id:created.id})
   await f.store(a,'881001');await f.callback(a,{provider:'881001',id:'881002'})
   const item=await scalar('select i.* from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.checkout_session_id=$1',[s.session.id])
   assert.equal(item.variant_id,chosen.id);assert.equal(item.variant_sku,chosen.sku);assert.equal(Number(item.unit_price),150.25);assert.deepEqual(item.variant_options,{color:'Black',switch:'Red'})
   await f.callback(a,{provider:'881001',id:'881002'})
   assert.equal((await scalar('select count(*)::int value from public.customer_orders where checkout_session_id=$1',[s.session.id])).value,1)
  })
  await t.test('old pre-migration prepaid snapshot still settles at its original price with no invented attributes',async()=>{
   await f.db.query('update public.product_variants set option_values=$1,sale_price=777 where id=$2',[JSON.stringify({model:'New future option'}),f.variant])
   const a=await f.claim(old);await f.store(a,'882001');await f.callback(a,{provider:'882001',id:'882002'})
   const item=await scalar('select i.* from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.checkout_session_id=$1',[old.session.id])
   assert.equal(Number(item.unit_price),100.35);assert.deepEqual(item.variant_options,{})
   assert.deepEqual(await scalar('select snapshot from private.payment_checkout_sessions where id=$1',[old.session.id]),oldSnapshot)
  })
  await t.test('independent stale editorial saves terminate with PT409 and keep the winner',async()=>{
   const saved=await f.snapshot(created.id),input=prepareProductSave(f.body({slug:saved.product.slug,expected_revision:saved.revision,variants:saved.variants}),'update')
   const args=[f.actors.owner,input.p_request_id,input.p_operation,created.id,input.p_expected_revision,JSON.stringify(input.p_payload),JSON.stringify(input.p_variants)]
   const a=await f.db.connect(),b=await f.db.connect(),call=(c,values)=>c.query('select public.catalog_save_product($1,$2,$3,$4,$5,$6,$7) v',values)
   await a.query('begin');await call(a,args)
   const losing=call(b,args.map((v,i)=>i===1?randomUUID():v)).then(()=>null,e=>e)
   await a.query('commit');assert.equal((await losing).code,'PT409')
  })
  await t.test('older editor payloads preserve omitted new merchandising fields',async()=>{
   const saved=await f.snapshot(created.id),variants=saved.variants.map(({id,name,code,sku,color_name,color_hex})=>({id,name,code,sku,color_name,color_hex}))
   await f.save(f.body({slug:saved.product.slug,expected_revision:saved.revision,variants}),{operation:'update',id:created.id})
   const next=await f.snapshot(created.id)
   for(const row of next.variants){const prior=saved.variants.find(v=>v.id===row.id);assert.equal(row.sale_price,prior.sale_price);assert.deepEqual(row.option_values,prior.option_values)}
  })
  await t.test('curated order, receipts, draft privacy, self/duplicate/cycle guards and stable HTTP conflicts',async()=>{
   const products=[];for(let i=0;i<5;i++)products.push(await f.save(f.body({is_published:i!==4})))
   const [a,b,c]=products.map(p=>p.id),request=randomUUID()
   assert.equal((await command(f.db,a,[c,b,products[4].id],0,request)).revision,1)
   assert.equal((await command(f.db,a,[c,b,products[4].id],0,request)).replayed,true)
   assert.deepEqual((await f.rpc('get_product_presentation',[a])).compatible.map(p=>p.id),[c,b])
   await assert.rejects(command(f.db,a,[],0),e=>e.code==='PT409')
   for(const ids of [[a],[b,b],[randomUUID()]])await assert.rejects(command(f.db,a,ids,1))
   await command(f.db,b,[c]);await assert.rejects(command(f.db,c,[a]),e=>e.code==='22023')
   await assert.rejects(command(f.db,c,[],0,randomUUID(),f.actors.viewer),e=>e.code==='42501')
   const aClient=await f.db.connect(),bClient=await f.db.connect(),d=products[3].id,e=products[4].id
   await aClient.query('begin');await command(aClient,d,[e])
   const losing=command(bClient,e,[d]).then(()=>null,error=>error)
   await aClient.query('commit');assert.equal((await losing).code,'22023')
  })
 }finally{await f.close()}
})
