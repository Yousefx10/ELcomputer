// Targeted, private reconciliation only. Never called by a customer status GET.
// The caller supplies an owner-controlled credential in process memory.
import {createHash} from 'node:crypto'
import {normalizePaymobCallback,PaymentError} from './paymob.js'

export async function inquirePaymobTransaction({apiKey,config,expected,transactionId,providerOrderId,merchantReference,fetcher=fetch,timeoutMs=10000}){
 const unresolved=reason=>({status:'unresolved',reason,financialFinality:false})
 if(typeof apiKey!=='string'||apiKey.length<32||apiKey.length>8192||!/^[!-~]+$/.test(apiKey))throw new PaymentError('inquiry_configuration_unavailable')
 const numeric=value=>typeof value==='string'&&/^[0-9]{1,18}$/.test(value)
 if(transactionId&&!numeric(transactionId)||providerOrderId&&!numeric(providerOrderId)
  ||!transactionId&&!providerOrderId&&!/^[0-9a-f-]{36}$/i.test(merchantReference||''))throw new PaymentError('invalid_inquiry_target',400)
 let auth,response,data
 try{
  auth=await fetcher('https://accept.paymob.com/api/auth/tokens',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({api_key:apiKey}),signal:AbortSignal.timeout(timeoutMs)})
  if(!auth.ok)return unresolved('authentication_unavailable')
  const token=(await auth.json())?.token
  if(typeof token!=='string'||token.length<20||token.length>8192)return unresolved('authentication_unavailable')
  response=transactionId
   ?await fetcher('https://accept.paymob.com/api/acceptance/transactions/'+transactionId,{method:'GET',headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(timeoutMs)})
   :await fetcher('https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({auth_token:token,...(providerOrderId?{order_id:providerOrderId}:{merchant_order_id:merchantReference})}),signal:AbortSignal.timeout(timeoutMs)})
  if(!response.ok)return unresolved(response.status===404?'no_transaction_evidence':'inquiry_unavailable')
  data=await response.json()
 }catch{return unresolved('inquiry_unavailable')}
 if(!data||typeof data!=='object'||!data.id)return unresolved('no_transaction_evidence')
 let transaction
 try{transaction=normalizePaymobCallback(data,config)}catch{return unresolved('unsupported_or_mismatched_transaction')}
 if(typeof data.is_live!=='boolean'||data.is_live!==(expected.mode==='live')
  ||transaction.mode!==expected.mode||transaction.currency!==expected.currency
  ||transaction.amount_minor!==Number(expected.amount_minor)||transaction.integration_id!==Number(expected.integration_id)
  ||!expected.provider_order_id||transaction.provider_order_id!==String(expected.provider_order_id)
  ||transactionId&&transaction.transaction_id!==transactionId
  ||providerOrderId&&transaction.provider_order_id!==providerOrderId
  ||merchantReference&&data.order?.merchant_order_id!==merchantReference)return unresolved('unsupported_or_mismatched_transaction')
 // Store only a digest and the existing normalized financial projection.
 // Neither absence nor a decline retires the whole intention.
 return {status:transaction.status,transaction,evidenceSha256:createHash('sha256').update(JSON.stringify(data)).digest('hex'),financialFinality:false,source:'authenticated_targeted_inquiry'}
}
