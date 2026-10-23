import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPdcShipment,requestPdcJson,requestPdcLabel,PDC_PRODUCTION_BASE_URL,PDC_TEST_BASE_URL} from '../server/utils/pdcShipping.js'
import {requestPdcLookup,reconcilePdcShipment,pdcResponseRows} from '../server/utils/pdcLookups.js'
import {verifyReverseResult} from '../server/utils/pdcReverseLogistics.js'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'
import {parsePdcWebhook,pdcEventKey} from '../server/utils/pdcTracking.js'

// Primary sources: Customer Courier Integration Test V4.pdf, pp2–9
// (SHA256 8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186),
// and Customer Webhook Integration.pdf, pp2–5
// (SHA256 9386ff876642717be5514856c8b46056afdd444a0a0ac4995b539e76cd9d5c0d).
// All identities and responses are synthetic. A fixture accepting numeric test
// values establishes serialization only, never Product40 merchant acceptance.
const reference='ORD-00000000-0000-4000-8000-000000000001'
const order={first_name:'Synthetic',last_name:'Recipient',phone:'01100000000',street_address:'Synthetic destination',city:'Ramses',governorate:'Cairo',subtotal_amount:'1.00',discount_amount:'0.00'}
const baseSettings={api_mode:'production',base_url:PDC_PRODUCTION_BASE_URL,company_id:'123',product_id:40,origin_city_id:10,origin_address:'Synthetic origin',origin_phone:'01000000000',origin_contact_name:'Synthetic sender',default_weight_kg:1,shipment_type_id:1,label_template_id:1,allow_open_shipment:false}
const fixtureSettings=()=>({...baseSettings,access_token_encrypted:encryptShippingSecret('synthetic-access-token')})
const shipment=()=>buildPdcShipment({settings:baseSettings,order,items:[{product_title:'Synthetic item',quantity:1}],orderReference:reference,destinationCityId:10,codAmountMinor:0})
const success=()=>({generalResponse:{success:true,id:1,summary:{totalShipments:1,invalidShipments:0}},badResponses:[],successResponses:[{awb:'SYNTHETIC-AWB',ref:reference,success:true,name:'Synthetic Recipient',errors:null}]})
const rpcResult=data=>({abortSignal(){return Promise.resolve({data,error:null})}})

test('V6 documentation cases use explicit provider doubles and no global network',async t=>{
 const previousRuntime=globalThis.useRuntimeConfig,previousFetch=globalThis.fetch
 globalThis.useRuntimeConfig=()=>({shippingCredentialsEncryptionKey:'synthetic-document-review-key-over-32-characters'})
 globalThis.fetch=()=>{throw Error('Document contract review forbids network')}
 try {
  await t.test('all required shipment fields have the documented type and casing',async()=>{
   const s=await shipment()
   // API p3, Section4.3: these twelve fields are explicitly required.
   const required={fromCityID:'integer',fromAddress:'string',fromPhone:'string',toCityID:'integer',toConsigneeName:'string',toAddress:'string',toPhone:'string',toRef:'string',productID:'integer',weight:'number',pieces:'integer',shipmentTypeID:'integer'}
   for(const [key,type]of Object.entries(required)){
    assert.ok(Object.hasOwn(s,key),key)
    if(type==='integer')assert.ok(Number.isInteger(s[key]),key)
    else assert.equal(typeof s[key],type,key)
   }
   assert.match(s.fromPhone,/^\d{11}$/);assert.equal(s.productID,40);assert.equal(s.shipmentTypeID,1)
   assert.equal(s.cod,0);assert.equal(s.declaredValue,1);assert.equal(s.pieces,1);assert.equal(s.weight,1)
   assert.equal(s.fromContactPerson,baseSettings.origin_contact_name);assert.equal(s.allowToOpenShipment,false)
   assert.equal(s.toRef,reference)
   for(const key of ['awb','pickupID','fromContactName','allowToOpenPackage','specialInstructions','specialInstuctions'])assert.equal(Object.hasOwn(s,key),false)
  })

  await t.test('both explicit environments retain V6 POST, exact authentication and documented success matching',async()=>{
   const body={allMustValid:true,shipments:[await shipment()],hasAWBs:false,extraParams:{}}
   for(const [api_mode,base_url]of [['test',PDC_TEST_BASE_URL],['production',PDC_PRODUCTION_BASE_URL]]){
    let calls=0
    const response=await requestPdcJson({settings:{...fixtureSettings(),api_mode,base_url},endpoint:'SaveShipmentEx',body,bounded:true,fetcher:async(url,options)=>{
     calls++;assert.equal(url,base_url+'SaveShipmentEx');assert.equal(options.method,'POST');assert.equal(options.redirect,'error')
     assert.equal(options.headers.AccessToken,'synthetic-access-token');assert.equal(options.headers.CompanyID,'123')
     assert.equal(options.headers['Content-Type'],'application/json');assert.equal(options.headers.Accept,'application/json')
     assert.equal(Object.keys(options.headers).some(k=>/cookie|authorization/i.test(k)),false)
     assert.deepEqual(JSON.parse(options.body),body);return Response.json(success())
    }})
    assert.equal(calls,1);assert.deepEqual(verifyReverseResult(response,reference),{state:'created',ref:reference,awb:'SYNTHETIC-AWB'})
   }
  })

  await t.test('an HTTP500 generic envelope yields one failed request and no invented AWB',async()=>{
   const body={allMustValid:true,shipments:[await shipment()],hasAWBs:false,extraParams:{}}
   for(const operation of ['SaveShipmentEx','GetShipmentsStatus']){
    let calls=0
    const fetcher=async()=>{calls++;return Response.json({success:false,message:'Synthetic unspecified error.',traceId:'SYNTHETIC-TRACE'},{status:500})}
    if(operation==='SaveShipmentEx')await assert.rejects(()=>requestPdcJson({settings:fixtureSettings(),endpoint:operation,body,fetcher,bounded:true}))
    else await assert.rejects(()=>requestPdcLookup(fixtureSettings(),operation,{awBs:'',reFs:reference},fetcher),{statusCode:502})
    assert.equal(calls,1)
   }
   assert.equal(verifyReverseResult({success:false,message:'Synthetic error',traceId:'SYNTHETIC-TRACE'},reference).state,'uncertain')
  })

  await t.test('documented success requires one exact reference and validation rejection never invents success',()=>{
   const wrong=success();wrong.successResponses[0].ref='DIFFERENT-REFERENCE'
   assert.equal(verifyReverseResult(wrong,reference).state,'uncertain')
   const multiple=success();multiple.successResponses.push({...multiple.successResponses[0]})
   assert.equal(verifyReverseResult(multiple,reference).state,'uncertain')
   const rejected={generalResponse:{success:false,summary:{totalShipments:1,invalidShipments:1}},badResponses:[{errors:['Synthetic field rejection']}],successResponses:[]}
   assert.equal(verifyReverseResult(rejected,reference).state,'failed')
  })

  await t.test('the standard label uses integer template1 and an AWB array, and rejects non-PDF/oversized responses',async()=>{
   let calls=0
   const pdf=await requestPdcLabel({settings:fixtureSettings(),awb:'SYNTHETIC-AWB',bounded:true,fetcher:async(url,options)=>{
    calls++;assert.equal(url,PDC_PRODUCTION_BASE_URL+'ExportPDF');assert.equal(options.method,'POST')
    assert.deepEqual(JSON.parse(options.body),{templateID:1,awBs:['SYNTHETIC-AWB']})
    return new Response('%PDF-1.7\nsynthetic',{headers:{'content-type':'application/pdf'}})
   }})
   assert.equal(calls,1);assert.equal(pdf.subarray(0,5).toString(),'%PDF-')
   for(const [body,headers]of [['html',{'content-type':'application/pdf'}],['%PDF-synthetic',{'content-type':'text/html'}],['%PDF-synthetic',{'content-type':'application/pdf','content-length':'5242881'}]])
    await assert.rejects(()=>requestPdcLabel({settings:fixtureSettings(),awb:'SYNTHETIC-AWB',bounded:true,fetcher:async()=>new Response(body,{headers})}))
  })

  await t.test('date-filter examples serialize as documented without asserting that dates are mandatory',async()=>{
   const filters={fromDate:'2026-07-01T00:00:00.000Z',toDate:'2026-07-01T23:59:59.999Z',awBs:'',reFs:reference}
   let calls=0
   await requestPdcLookup(fixtureSettings(),'GetShipmentsStatus',filters,async(url,options)=>{
    calls++;assert.equal(url,PDC_PRODUCTION_BASE_URL+'GetShipmentsStatus');assert.equal(options.method,'POST')
    assert.deepEqual(JSON.parse(options.body),filters);return Response.json([])
   })
   assert.equal(calls,1)
  })

  await t.test('documented status rows need no invented StatusID or StatusDate and preserve Reason text',async()=>{
   const writes=[],db={rpc(name,args){
    if(name==='shipping_claim_pdc_refresh')return rpcResult({awb:'SYNTHETIC-AWB',ref:reference,observed_at:'2026-07-01T12:00:00Z'})
    assert.equal(name,'shipping_record_pdc_event');writes.push(args.p_update);return rpcResult({received:true})
   }}
   await reconcilePdcShipment(db,fixtureSettings(),'synthetic-order-id',async()=>Response.json([{AWB:'SYNTHETIC-AWB',Ref:reference,Status:'Out For Delivery',Reason:'No Answer'}]))
   assert.equal(writes.length,1);assert.equal(writes[0].status_id,null);assert.equal(writes[0].status_date,null)
   assert.equal(writes[0].reason,'No Answer');assert.equal(writes[0].ref,reference)
   assert.equal(writes[0].source,'reconciliation')
  })

  await t.test('known partial pagination and unsupported envelopes are refused rather than treated as an empty catalog',()=>{
   for(const response of [{data:[],hasMore:true},{items:[],totalCount:1},{shipments:[],nextPage:'synthetic-next'},{}])assert.throws(()=>pdcResponseRows(response))
   assert.deepEqual(pdcResponseRows([]),[])
  })

  await t.test('unmapped webhook labels may be empty; repeated AWB plus StatusID remains the same event',()=>{
   const body={AWB:'SYNTHETIC-AWB',REF:reference,CustomerStatusName:'',StatusID:'97',StatusDate:'2026-07-01T12:00:00Z',ReasonName:'No Answer'}
   const parsed=parsePdcWebhook(body,'Africa/Cairo')
   assert.equal(parsed.status_name,'');assert.equal(parsed.status_id,97);assert.equal(parsed.reason,'No Answer')
   const repeated=parsePdcWebhook({...body,CustomerStatusName:'Synthetic later label',StatusDate:'2026-07-01T13:00:00Z'},'Africa/Cairo')
   assert.equal(pdcEventKey(parsed),pdcEventKey(repeated))
   assert.equal(parsed.ref,reference)
  })
 } finally {globalThis.useRuntimeConfig=previousRuntime;globalThis.fetch=previousFetch}
})
