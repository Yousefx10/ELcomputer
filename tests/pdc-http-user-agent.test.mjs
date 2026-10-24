import test from 'node:test'
import assert from 'node:assert/strict'
import {requestPdcJson,requestPdcLabel,PDC_HTTP_USER_AGENT} from '../server/utils/pdcShipping.js'
import {requestPdcLookup} from '../server/utils/pdcLookups.js'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'

const key='offline-fixture-key-pdc-user-agent-000000000000'
const settings=company=>{
 globalThis.useRuntimeConfig=()=>({shippingCredentialsEncryptionKey:key})
 return {api_mode:'production',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',company_id:company,access_token_encrypted:encryptShippingSecret('offline-fixture-token-'+company),label_template_id:1}
}
const dates={awBs:'',reFs:'ORD-OFFLINE-FIXTURE',fromDate:'2026-10-23T00:00:00+03:00',toDate:'2026-10-25T00:00:00+03:00'}

test('all PDC operations identify the generic client without session cookies',async()=>{
 for(const company of ['123456','987654']){
  const s=settings(company),seen=[]
  const fetcher=async(url,options)=>{
   seen.push({url,options});assert.equal(options.headers['User-Agent'],PDC_HTTP_USER_AGENT);assert.equal(options.headers.Accept,'application/json');assert.equal(options.headers['Content-Type'],'application/json')
   assert.equal(options.headers.AccessToken,'offline-fixture-token-'+company);assert.equal(options.headers.CompanyID,company);assert.equal(options.redirect,'error')
   assert.equal(Object.keys(options.headers).some(k=>/cookie|authorization/i.test(k)),false)
   return url.endsWith('ExportPDF')?new Response('%PDF-1.4\nOFFLINE',{headers:{'content-type':'application/pdf'}}):new Response('[]',{headers:{'content-type':'application/json'}})
  }
  for(const operation of ['GetProducts','GetCities'])await requestPdcLookup(s,operation,undefined,fetcher)
  await requestPdcLookup(s,'GetShipmentsStatus',dates,fetcher)
  const body={allMustValid:true,shipments:[{toRef:'ORD-OFFLINE-FIXTURE',fromAddress:'عنوان اصطناعي',toAddress:'Synthetic recipient',contents:'Offline fixture',weight:1}],hasAWBs:false,extraParams:{}}
  await requestPdcJson({settings:s,endpoint:'SaveShipmentEx',body,fetcher,bounded:true})
  await requestPdcLabel({settings:s,awb:'OFFLINE-AWB',fetcher,bounded:true})
  assert.equal(seen.length,5);assert.deepEqual(JSON.parse(seen[2].options.body),dates);assert.deepEqual(JSON.parse(seen[3].options.body),body)
  assert.equal(PDC_HTTP_USER_AGENT.includes(company),false);assert.equal(/elcomputer/i.test(PDC_HTTP_USER_AGENT),false)
 }
})
test('upstream HTTP500 still stops each request after one call',async()=>{
 const s=settings('123456');let calls=0
 const fetcher=async(url,options)=>{calls++;assert.equal(options.headers['User-Agent'],PDC_HTTP_USER_AGENT);return new Response('{"success":false,"message":"offline error"}',{status:500,headers:{'content-type':'application/json'}})}
 await assert.rejects(()=>requestPdcJson({settings:s,endpoint:'SaveShipmentEx',body:{shipments:[]},fetcher,bounded:true}));assert.equal(calls,1)
 await assert.rejects(()=>requestPdcLookup(s,'GetShipmentsStatus',dates,fetcher),{statusCode:502});assert.equal(calls,2)
})
