import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {parse as parseVue} from '@vue/compiler-sfc'
import {parse} from '@babel/parser'
import vm from 'node:vm'
test('actual Dashboard coupon form saves and reloads optional eligibility through its existing permission path',async()=>{
 const source=parseVue(await readFile('app/pages/dashboard/settings.vue','utf8')).descriptor.scriptSetup.content
 const names=['toDateTimeLocalValue','toIsoDateTimeValue','normalizeCouponPayload','mapCoupon','validateCouponForm','isCouponDirty','resetNewCoupon','saveCoupon']
 const nodes=parse(source,{sourceType:'module'}).program.body.filter(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>names.includes(d.id.name)))
 assert.equal(nodes.length,names.length)
 const saved=[],couponError={value:''},newCoupon={},ctx={couponError,newCoupon,couponLoading:{value:false},couponsLoaded:{value:false},handleTableError:()=>false,getCoupons:async()=>{},syncCouponsCache:()=>{},logSettingsAction:async()=>{},supabase:{from:table=>({update:payload=>({eq:async(k,id)=>{saved.push({table,payload,k,id});return{error:null}}})})}}
 vm.createContext(ctx);vm.runInContext(nodes.map(n=>source.slice(n.start,n.end)).join('\n')+'\nglobalThis.methods={'+names.join(',')+'}',ctx)
 const raw={id:randomUUID(),code:'PRIVATE_COMBINED',discount_type:'fixed',discount_value:25,delivery_discount_value:45,minimum_order_amount:1,usage_limit:1,starts_at:null,ends_at:null,is_active:true,eligible_customer_id:randomUUID(),eligible_product_id:randomUUID(),eligible_shipping_company_id:randomUUID()}
 const row=ctx.methods.mapCoupon(raw);assert.equal(ctx.methods.isCouponDirty(row),false)
 row.eligible_customer_id=randomUUID().toUpperCase();assert.equal(ctx.methods.isCouponDirty(row),true)
 await ctx.methods.saveCoupon(row);assert.equal(saved.length,1);assert.equal(saved[0].table,'site_coupons');assert.equal(saved[0].id,raw.id)
 for(const k of ['eligible_customer_id','eligible_product_id','eligible_shipping_company_id'])assert.equal(saved[0].payload[k],row[k].toLowerCase())
 assert.equal(saved[0].payload.delivery_discount_value,45);assert.equal(saved[0].payload.discount_value,25)
 const reload=ctx.methods.mapCoupon({...saved[0].payload,id:raw.id});assert.equal(ctx.methods.isCouponDirty(reload),false)
 row.eligible_customer_id='not-an-id';await ctx.methods.saveCoupon(row);assert.equal(saved.length,1);assert.match(couponError.value,/valid eligibility/)
 const ordinary=ctx.methods.normalizeCouponPayload({code:'REGULAR',discount_value:10});for(const k of ['eligible_customer_id','eligible_product_id','eligible_shipping_company_id'])assert.equal(ordinary[k],null)
 ctx.methods.resetNewCoupon();for(const k of ['eligible_customer_id','eligible_product_id','eligible_shipping_company_id'])assert.equal(newCoupon[k],'')
})
