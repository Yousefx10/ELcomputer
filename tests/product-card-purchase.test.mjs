import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { productCardPurchase, readProductCardVariants, productCardVariantFields } from '../app/utils/productCardPurchase.js'
import { allowsCartBackorder } from '../app/utils/backorder.js'
const id=randomUUID(), optionId=randomUUID()
const product={id,is_serialized:true,is_published:true,selling_mode:'normal',stock_quantity:0,price:25}
const option={id:optionId,product_id:id,is_active:true,name:'Default',stock_quantity:1}

test('one active reference, including Default or a single named configuration, uses its real variant stock',()=>{
 for(const name of ['Default','Blue']){
  const result=productCardPurchase(product,{},[{...option,name}]);assert.equal(result.kind,'direct');assert.equal(result.variant.id,optionId);assert.equal(result.stock,1)
 }
})
test('multiple active configurations remain Options even if just one is in stock',()=>{
 assert.equal(productCardPurchase(product,{},[option,{...option,id:randomUUID(),stock_quantity:0}]).kind,'options')
 assert.equal(productCardPurchase({...product,is_serialized:false,variants:[option]},{}).kind,'options')
})
test('missing metadata cannot guess a variant; empty active options are unavailable',()=>{
 assert.equal(productCardPurchase(product,{},null).kind,'options');assert.equal(productCardPurchase(product,{},[]).kind,'unavailable')
})
test('recorded serialized stock cannot be bypassed by the bulk backorder switch',()=>{
 const result=productCardPurchase(product,{inventory_tracking_required:true,allow_out_of_stock_purchases:true},[{...option,stock_quantity:0}]);assert.equal(result.kind,'unavailable');assert.equal(result.allowBackorder,false)
})
test('legitimate unrecorded serialized sales retain zero stock and exact variant identity',()=>{
 const result=productCardPurchase(product,{inventory_tracking_required:false},[{...option,stock_quantity:0}]);assert.equal(result.kind,'direct');assert.equal(result.stock,0);assert.equal(result.allowBackorder,true);assert.equal(result.variant.id,optionId)
})
test('ordinary bulk stock and backorder policy are retained without inventing a variant',()=>{
 for(const [stock,settings,kind] of [[2,{},'direct'],[0,{},'unavailable'],[0,{allow_out_of_stock_purchases:true},'direct']]){
  const result=productCardPurchase({...product,is_serialized:false,stock_quantity:stock},settings);assert.equal(result.kind,kind);if(kind==='direct')assert.equal(result.variant,null)
 }
})
test('published, preorder, coming-soon, restricted and declared-choice gates remain separate',()=>{
 for(const [p,restricted,kind] of [[{...product,is_published:false},false,'unavailable'],[{...product,selling_mode:'coming_soon'},false,'unavailable'],[{...product,selling_mode:'preorder'},false,'preorder'],[product,true,'options'],[{...product,is_serialized:undefined},false,'options'],[{...product,is_serialized:false,has_variants:true},false,'options']])assert.equal(productCardPurchase(p,{},[option],restricted).kind,kind)
})
test('cart backorder extraction preserves the previous policy across normal and preorder stock modes',()=>{
 for(const serialized of [true,false])for(const mode of ['normal','preorder','coming_soon'])for(const allow of [true,false])for(const tracking of [true,false,undefined]){
  const p={is_serialized:serialized,selling_mode:mode,allow_out_of_stock_purchases:allow},s={inventory_tracking_required:tracking}
  const before=tracking===false&&mode==='normal'||allow&&!serialized||mode==='preorder';assert.equal(Boolean(allowsCartBackorder(p,s)),before)
 }
})
const client=(data,error=null)=>{
 const calls=[];const q={select:fields=>{calls.push(['select',fields]);return q},eq:(key,value)=>{calls.push(['eq',key,value]);return q},order:key=>{calls.push(['order',key]);return q},limit:n=>{calls.push(['limit',n]);return q},abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return q},then:(ok,fail)=>Promise.resolve({data,error}).then(ok,fail)}
 return {calls,from:name=>{calls.push(['from',name]);return q}}
}
test('metadata reads only public safe fields for one exact product, active rows, limit two',async()=>{
 const c=client([option]);assert.deepEqual(await readProductCardVariants(c,id),[option]);assert.deepEqual(c.calls,[['from','storefront_product_variants'],['select',productCardVariantFields],['eq','product_id',id],['eq','is_active',true],['order','id'],['limit',2]])
 assert.ok(!/cost|supplier|warehouse|serial_number|purchase_price/.test(productCardVariantFields))
})
test('foreign, inactive, duplicated, malformed and unbounded metadata is rejected',async()=>{
 for(const rows of [null,{},[{...option,product_id:randomUUID()}],[{...option,is_active:false}],[option,option],[{...option,id:'Default'}],[{...option,stock_quantity:'invalid'}],[option,{...option,id:randomUUID()},{...option,id:randomUUID()}]])await assert.rejects(readProductCardVariants(client(rows),id))
 await assert.rejects(readProductCardVariants(client([],{message:'Private provider text'}),id),/Options unavailable/)
 const c=client([]);await assert.rejects(readProductCardVariants(c,'invalid'));assert.equal(c.calls.length,0)
})
