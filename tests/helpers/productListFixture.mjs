import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
export async function seedListing(f, count=34) {
 const rows=[]; const c2=randomUUID(), b2=randomUUID()
 await f.db.query("insert into public.categories(id,name,name_ar,slug) values($1,'Other category','فئة أخرى','other-list-category')",[c2])
 await f.db.query("insert into public.brands(id,name,slug) values($1,'Other brand','other-list-brand')",[b2])
 await f.db.query("update public.categories set name_ar='فئة محفوظة' where id=$1",[f.category])
 for(let i=0;i<count;i++) {
  const mode=['normal','coming_soon','preorder'][i%3]
  const body=f.body({title:i===0?'ح laptop حاسوب عربي':`Listing product ${String(i).padStart(3,'0')}`,sku:i===1?'00001-Exact-Case':`LIST-PARENT-${i}`,price:mode==='preorder'?10+i:i,category_id:i%3===0?null:i%2?f.category:c2,brand_id:i%4===0?null:i%2?f.brand:b2,selling_mode:mode,is_published:i%2===0,variants:[{name:'Default',code:`CODE_${i}`,sku:`VARIANT-SKU-${i}`} ]})
  const saved=await f.save(body);const loaded=await f.snapshot(saved.id)
  await f.db.query("update public.products set created_at='2026-01-01'::timestamptz + ($2::int % 4)*interval '1 day' where id=$1",[saved.id,i])
  const row={...loaded.product,created_at:(await f.db.query('select created_at from public.products where id=$1',[saved.id])).rows[0].created_at,available_quantity:0,option_count:1,variant_id:loaded.variants[0].id}
  if(i%5===0){const receipt=await f.client.rpc('commerce_create_procurement_order',{p_supplier_id:f.supplier,p_warehouse_id:f.warehouse,p_invoice_number:`LIST-${i}`,p_notes:null,p_paid_amount:0,p_items:[{product_id:saved.id,variant_id:row.variant_id,quantity:2,unit_cost:35}]});assert.equal(receipt.error,null);row.available_quantity=2}
  rows.push(row)
 }
 return {rows,c2,b2}
}
