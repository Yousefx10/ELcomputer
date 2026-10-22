import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPdcShipment,requestPdcJson,requestPdcLabel} from '../server/utils/pdcShipping.js'
import {verifyReverseResult} from '../server/utils/pdcReverseLogistics.js'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'

// Contract provenance: original Code Snippets entry34 elc_pdc_create_shipment,
// authenticated SHA256 06da3aa4ba6e9d0f79bfde93b7aa1561b444a9a56765239c83a0f2b3dcc18409;
// Courier Integration Test V4 PDF pp3-7. Values below are synthetic.
const settings={api_mode:'production',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',company_id:'123456',product_id:40,origin_city_id:10,
 origin_address:'Synthetic pickup street',origin_phone:'01000000000',origin_contact_name:'Synthetic pickup',default_weight_kg:0.75,shipment_type_id:1,label_template_id:1,allow_open_shipment:false}
const order={first_name:'Synthetic',last_name:'Recipient',phone:'01100000000',street_address:'Synthetic destination',city:'Synthetic city',governorate:'Synthetic governorate',subtotal_amount:'100.10',discount_amount:'0.03',shipping_fee_amount:'20.00',payment_fee_amount:'3.00',total_amount:'123.07'}
const input=(changes={})=>({settings,order,items:[{product_title:'Synthetic item',quantity:1}],orderReference:'ORD-00000000-0000-4000-8000-000000000001',destinationCityId:20,codAmountMinor:0,...changes})

test('booking uses PDF and original PHP field names; service40 remains distinct from type1',async()=>{
 const s=await buildPdcShipment(input())
 assert.equal(s.fromContactPerson,settings.origin_contact_name);assert.equal(s.contents,'Synthetic item x1');assert.equal(s.allowToOpenShipment,false)
 for(const key of ['fromContactName','allowToOpenPackage','specialInstuctions','specialInstructions','awb'])assert.equal(Object.hasOwn(s,key),false)
 assert.equal(s.productID,40);assert.equal(s.shipmentTypeID,1);assert.equal(s.weight,0.75);assert.equal(s.pieces,1)
 assert.equal(s.toRef,input().orderReference);assert.equal(s.cod,0);assert.equal(s.declaredValue,100.07)
 assert.equal((await buildPdcShipment(input({codAmountMinor:12307}))).declaredValue,100.07)
})

test('declared value uses exact saved net goods value and rejects invalid amounts',async()=>{
 for(const value of ['-1','1.001','1e2','',null,true,{},'9007199254740992'])await assert.rejects(()=>buildPdcShipment(input({order:{...order,subtotal_amount:value}})),/shipment value is invalid/)
 await assert.rejects(()=>buildPdcShipment(input({order:{...order,discount_amount:'100.11'}})),/shipment value is invalid/)
 assert.equal((await buildPdcShipment(input({order:{...order,subtotal_amount:'0.03',discount_amount:'0.02'}}))).declaredValue,0.01)
 assert.equal((await buildPdcShipment(input({order:{...order,discount_amount:'100.10'}}))).declaredValue,0)
})

test('single booking and its one-AWB standard label use documented POST contracts without retries',async()=>{
 const previous=globalThis.useRuntimeConfig;globalThis.useRuntimeConfig=()=>({shippingCredentialsEncryptionKey:'synthetic-shipping-encryption-key-over-32-characters'})
 try{
  const s={...settings,access_token_encrypted:encryptShippingSecret('synthetic-token')},shipment=await buildPdcShipment(input()),requests=[]
  const response=await requestPdcJson({settings:s,endpoint:'SaveShipmentEx',bounded:true,body:{allMustValid:true,shipments:[shipment],hasAWBs:false,extraParams:{}},fetcher:async(url,options)=>{
   requests.push(url);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(Object.keys(options.headers).some(k=>k.toLowerCase()==='cookie'),false)
   const b=JSON.parse(options.body);assert.equal(b.allMustValid,true);assert.equal(b.hasAWBs,false);assert.equal(b.shipments.length,1)
   return Response.json({generalResponse:{success:true,summary:{totalShipments:1,invalidShipments:0}},badResponses:[],successResponses:[{awb:'SYNTHETIC-AWB',ref:shipment.toRef,success:true,errors:null}]})
  }})
  const matched=verifyReverseResult(response,shipment.toRef);assert.equal(matched.state,'created');assert.equal(requests.length,1)
  const bytes=await requestPdcLabel({settings:s,awb:matched.awb,bounded:true,fetcher:async(url,options)=>{requests.push(url);assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{templateID:1,awBs:['SYNTHETIC-AWB']});return new Response('%PDF-1.7\nfixture',{headers:{'content-type':'application/pdf'}})}})
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.equal(requests.length,2)
  assert.equal(verifyReverseResult({...response,successResponses:[{...response.successResponses[0],ref:'other'}]},shipment.toRef).state,'uncertain')
  assert.equal(verifyReverseResult({generalResponse:{success:false,summary:{totalShipments:1,invalidShipments:1}},badResponses:[{errors:['synthetic validation']}],successResponses:[]},shipment.toRef).state,'failed')
 }finally{globalThis.useRuntimeConfig=previous}
})
