import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {META_CATALOG_COLUMNS,metaCatalogCondition,metaCatalogCsv,metaCatalogImage,metaCatalogRows} from '../server/utils/metaCatalogFeed.js'

const base='https://store.example.invalid'
const product=(o={})=>({id:'p1',title:'Mouse',slug:'mouse',description:'<p>Light **mouse**</p>',long_description:'',price:100,old_price:null,image_url:'/uploads/a.jpg',brand_id:'b1',selling_mode:'normal',is_published:true,...o})
const variant=(o={})=>({id:'v1',product_id:'p1',name:'Default',color_name:'',sale_price:null,stock_quantity:0,is_active:true,...o})
const input=(o={})=>({products:[product()],variants:[variant()],brands:[{id:'b1',name:'Acme'}],images:[],settings:{inventory_tracking_required:false},base,...o})

test('a row uses the variant ID sent by events and the storefront price',()=>{
 const {rows}=metaCatalogRows(input({products:[product({old_price:150})]}));assert.equal(rows.length,1);const r=rows[0]
 assert.equal(r.id,'v1');assert.equal(r.item_group_id,'p1');assert.equal(r.price,'150.00 EGP');assert.equal(r.sale_price,'100.00 EGP')
 assert.equal(r.description,'Light mouse');assert.equal(r.link,base+'/products/mouse');assert.equal(r.image_link,base+'/uploads/a.jpg');assert.equal(r.title,'Mouse')
})
test('no strike-through price leaves sale_price empty and a variant override wins',()=>{
 const r=metaCatalogRows(input({variants:[variant({sale_price:90})]})).rows[0];assert.equal(r.price,'90.00 EGP');assert.equal(r.sale_price,'')
})
test('availability follows what the store can sell',()=>{
 assert.equal(metaCatalogRows(input()).rows[0].availability,'in stock')
 assert.equal(metaCatalogRows(input({settings:{inventory_tracking_required:true}})).rows[0].availability,'out of stock')
 assert.equal(metaCatalogRows(input({settings:{inventory_tracking_required:true},variants:[variant({stock_quantity:3})]})).rows[0].availability,'in stock')
})
test('preorders, unbranded products and hidden products stay out, and nothing is invented',()=>{
 const a=metaCatalogRows(input({products:[product({selling_mode:'preorder'})]}));assert.equal(a.rows.length,0);assert.equal(a.skipped.preorder,1)
 const b=metaCatalogRows(input({products:[product({brand_id:null})]}));assert.equal(b.rows.length,0);assert.equal(b.skipped.brand,1)
 assert.equal(metaCatalogRows(input({products:[product({is_published:false})]})).rows.length,0)
})
test('only products with several options name the option',()=>{
 const two=metaCatalogRows(input({variants:[variant({name:'Black',color_name:'Black'}),variant({id:'v2',name:'White',color_name:'White'})]})).rows
 assert.deepEqual(two.map(x=>x.title),['Mouse - Black','Mouse - White']);assert.deepEqual(two.map(x=>x.color),['Black','White'])
 assert.equal(metaCatalogRows(input({variants:[variant({name:'Black'})]})).rows[0].title,'Mouse')
 assert.equal(metaCatalogRows(input({variants:[variant({color_name:'Default'})]})).rows[0].color,'','A placeholder is not a color')
})
test('a JPEG or PNG is preferred and the option image comes first',()=>{
 const v=variant();assert.equal(metaCatalogImage(product({image_url:'/uploads/a.webp'}),v,[{variant_id:null,image_url:'/uploads/b.png'}]),'/uploads/b.png')
 assert.equal(metaCatalogImage(product(),v,[{variant_id:'v1',image_url:'/uploads/own.jpg'}]),'/uploads/own.jpg')
 assert.equal(metaCatalogImage(product({image_url:'/uploads/a.webp'}),v,[]),'/uploads/a.webp')
})
test('condition comes from the product title',()=>{
 assert.equal(metaCatalogCondition('Mouse (OPEN BOX)'),'used');assert.equal(metaCatalogCondition('Refurbished Mouse'),'refurbished');assert.equal(metaCatalogCondition('Mouse'),'new');assert.equal(metaCatalogCondition('Mousepad used for gaming'),'new')
})
test('CSV keeps quotes, commas and Arabic intact',()=>{
 const csv=metaCatalogCsv([{id:'1',title:'A "B", ماوس'}]),[head,row]=csv.trim().split('\n')
 assert.equal(head,META_CATALOG_COLUMNS.join(','));assert.ok(row.includes('"A ""B"", ماوس"'))
})
test('the route reads public fields only and refuses an empty feed',async()=>{
 const route=await readFile('server/routes/feeds/meta-catalog.csv.get.js','utf8')
 assert.doesNotMatch(route,/cost_price|getSupabaseAdminClient/);assert.match(route,/!rows\.length/)
})
test('native: a product view uses the first active variant and an explicit choice still wins',{skip:!emailNativeAvailable,timeout:240000},async()=>{
 const f=await paymentFirstFixture(),hash='d'.repeat(64);try{
  await f.rpc('commerce_meta_configure',[f.actors.owner,0,{enabled:true,capiEnabled:true,pixelId:'123456789',graphVersion:'v26.0',testEventCode:''},'v1.YQ.Yg.Yw',false])
  await f.rpc('commerce_meta_consent',[hash,true,'Browser'])
  const view=async o=>(await f.rpc('commerce_meta_event',[hash,null,{eventName:'ViewContent',eventId:randomUUID(),path:'/products/item',productId:f.product,...o}])).data
  assert.deepEqual((await view({})).content_ids,[f.variant]);assert.deepEqual((await view({variantId:f.variant})).content_ids,[f.variant])
 }finally{await f.close()}
})
