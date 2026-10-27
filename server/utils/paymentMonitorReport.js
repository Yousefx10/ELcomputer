import {open} from 'node:fs/promises'
import {constants} from 'node:fs'
import {isAbsolute} from 'node:path'

const MAX_BYTES=131072, MAX_AGE=15*60*1000
const statuses=new Set(['HEALTHY','WARNING','CRITICAL'])
const codes=new Set(['ATTEMPT_ORDER_MISMATCH','PAYMENT_AMOUNT_MISMATCH','TRANSACTION_ATTEMPT_MISMATCH','SIGNED_SUCCESS_ATTEMPT_MISMATCH','SUCCESS_WITHOUT_SIGNED_TRANSACTION','OVERDUE_PAYMENT_UNVERIFIED','TERMINAL_PAYMENT_UNVERIFIED','CHARGED_BUT_UNPAID_EVIDENCE','PAID_WITHOUT_SIGNED_SUCCESS','MULTIPLE_SUCCESSFUL_CHARGES','ORDER_OWNER_MISSING','CHECKOUT_ATTEMPT_MISSING','PAID_ORDER_NOT_PROCESSING','DUPLICATE_PROVIDER_ORDER','DUPLICATE_TRANSACTION_REFERENCE','CALLBACK_INGRESS_PROBE','PUBLIC_CHECKOUT_HEALTH','PUBLIC_ENDPOINT_UNAVAILABLE','CALLBACK_PROXY_CONFIGURATION_CHANGED','SERVICE_INACTIVE','JOURNAL_CALLBACK_RECONCILIATION','JOURNAL_CHECKOUT_FAILURE','JOURNAL_UNHANDLED','JOURNAL_UPSTREAM','MANUAL_DELIVERY_UNAVAILABLE','MONITOR_CHECK_INCOMPLETE','MISSED_MONITORING_INTERVAL','OWNER_NOTIFICATION_NOT_CONFIGURED','DASHBOARD_REPORT_UNAVAILABLE'])
const severities=new Set(['INFO','WARNING','CRITICAL'])
const proof=new Set(['LOCAL_LEDGER','SIGNED_CALLBACK_LEDGER','UNVERIFIED'])
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value)
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value)
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000
const date=value=>typeof value==='string'&&value.length<=40&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value))
const missing=reason=>({available:false,status:'WARNING',reason,stale:true,lastSuccessfulCheck:null,exceptions:[],staffAttention:[],exceptionCount:0,staffAttentionCount:0,newPaidOrderCount:0})

// No customer fields, credential metadata, arbitrary log text or paths are
// projected. A private atomic file is the only source; this endpoint never runs
// the worker or reads its SQLite database, runtime or credentials.
export const projectPaymentMonitorReport=(raw,now=Date.now())=>{
 if(raw?.version!==1||!statuses.has(raw.status)||typeof raw.complete!=='boolean'||!date(raw.observed_utc)
  ||!(raw.last_successful_check===null||date(raw.last_successful_check))||!count(raw.exception_count)||!count(raw.staff_attention_count)||!count(raw.new_paid_order_count)
  ||!Array.isArray(raw.exceptions)||raw.exceptions.length>100||!Array.isArray(raw.staff_attention)||raw.staff_attention.length>100
  ||raw.exception_count<raw.exceptions.length||raw.staff_attention_count<raw.staff_attention.length)throw Error('Invalid report')
 const exceptions=raw.exceptions.map(x=>{
  if(!id(x.id)||!codes.has(x.code)||!severities.has(x.severity)||(x.order!==undefined&&x.order!==''&&!reference(x.order))||(x.provider_evidence!==undefined&&!proof.has(x.provider_evidence)))throw Error('Invalid alert')
  return {id:x.id,code:x.code,severity:x.severity,...(x.order?{order:x.order}:{}),...(x.provider_evidence?{providerEvidence:x.provider_evidence}:{})}
 })
 const staffAttention=raw.staff_attention.map(x=>{
  if(!id(x.id)||!reference(x.order)||typeof x.status!=='string'||!/^[a-z_]{1,40}$/.test(x.status)||typeof x.stock_fulfillment_state!=='string'||!/^[a-z_]{1,40}$/.test(x.stock_fulfillment_state))throw Error('Invalid staff order')
  return {id:x.id,order:x.order,status:x.status}
 })
 const last=Date.parse(raw.last_successful_check), stale=!Number.isFinite(last)||now-last>MAX_AGE||last-now>60000||Date.parse(raw.observed_utc)-now>60000
 const severity=exceptions.some(x=>x.severity==='CRITICAL')?'CRITICAL':exceptions.some(x=>x.severity==='WARNING')?'WARNING':raw.status
 const status=severity==='CRITICAL'?'CRITICAL':stale||!raw.complete?'WARNING':severity
 return {available:true,status,reason:null,stale,complete:raw.complete,observedAt:raw.observed_utc,lastSuccessfulCheck:raw.last_successful_check,
  exceptionCount:raw.exception_count,staffAttentionCount:raw.staff_attention_count,newPaidOrderCount:raw.new_paid_order_count,
  exceptions,staffAttention,displayLimited:raw.exception_count>exceptions.length||raw.staff_attention_count>staffAttention.length,
  emailEnabled:raw.email_enabled===true,emailConfigured:raw.notification_configured===true}
}

export const readPaymentMonitorReport=async(file,{now=Date.now()}={})=>{
 if(!file)return missing('not_configured')
 if(typeof file!=='string'||!isAbsolute(file)||file.includes('\0')||file.split('/').includes('..'))return missing('unavailable')
 let handle
 try{
  handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW)
  const meta=await handle.stat()
  if(!meta.isFile()||![0o600,0o640].includes(meta.mode&0o777)||meta.size>MAX_BYTES)throw Error('Unsafe report')
  const bytes=Buffer.alloc(MAX_BYTES+1),{bytesRead}=await handle.read(bytes,0,bytes.length,0)
  if(bytesRead>MAX_BYTES)throw Error('Report bound')
  return projectPaymentMonitorReport(JSON.parse(bytes.subarray(0,bytesRead).toString('utf8')),now)
 }catch{return missing('unavailable')}
 finally{await handle?.close().catch(()=>{})}
}
