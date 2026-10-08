import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { EMAIL_API_URL } from './settings.js'
import { isPublicSmsAddress } from '../sms/transport.js'
import { emailAddress, emailLine } from '../../../app/utils/email.js'
export const brevoMessageId = value => {
 if(typeof value!=='string'||value.length>254||/[\s\x00-\x1f\x7f]/.test(value)) throw Error('Invalid provider message ID.')
 const id=value.startsWith('<')&&value.endsWith('>')?value.slice(1,-1):value
 if(!/^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+$/.test(id)) throw Error('Invalid provider message ID.')
 return id
}
export const postBrevoEmail = async (payload, apiKey, timeoutMs, beforeDispatch, network = {lookup,request:https.request}) => {
 const url=new URL(EMAIL_API_URL), bytes=Buffer.from(JSON.stringify(payload))
 if(bytes.length>196608) throw Object.assign(Error('Email payload too large.'),{preflight:true})
 let addresses,dnsTimer
 try{ addresses=await Promise.race([network.lookup(url.hostname,{all:true}),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(Error('DNS timeout.')),timeoutMs);dnsTimer.unref?.()})]);if(!addresses.length||addresses.some(x=>!isPublicSmsAddress(x.address))) throw Error() }
 catch{throw Object.assign(Error('Email network preflight failed.'),{preflight:true})}finally{clearTimeout(dnsTimer)}
 await beforeDispatch()
 return new Promise((resolve,reject)=>{
  let done=false
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result)}
  const req=network.request(url,{method:'POST',minVersion:'TLSv1.2',maxHeaderSize:16384,agent:false,lookup:(_host,options,callback)=>options.all?callback(null,addresses):callback(null,addresses[0].address,addresses[0].family),headers:{'api-key':apiKey,'Content-Type':'application/json','Accept':'application/json','Content-Length':bytes.length}},res=>{
   const chunks=[];let size=0
   res.on('data',chunk=>{size+=chunk.length;if(size>262144)req.destroy(Error('Email response limit.'));else chunks.push(chunk)})
   res.on('end',()=>finish(null,{status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),retryAfter:res.headers['retry-after'],rateReset:res.headers['x-sib-ratelimit-reset']}))
   res.on('error',error=>finish(error));res.on('aborted',()=>finish(Error('Email response interrupted.')))
  })
  const timer=setTimeout(()=>req.destroy(Error('Email request timeout.')),timeoutMs)
  req.on('error',error=>finish(error));req.end(bytes)
 })
}
export const brevoProvider = {
 async submit(settings,apiKey,message,beforeDispatch,transport=postBrevoEmail){
  emailLine(apiKey,1024);emailAddress(message.recipient);emailAddress(message.sender);emailLine(message.sender_name,100);emailLine(message.subject)
  const payload={sender:{email:message.sender,name:message.sender_name},to:[{email:message.recipient}],subject:message.subject,headers:{'X-Mailin-custom':message.correlation},tags:[message.classification==='marketing'?'elc-marketing':'elc-transactional']}
  if(message.reply_to)payload.replyTo={email:emailAddress(message.reply_to)}
  // Current guide documents one body type per request. Text snapshots remain available.
  payload[message.body_format==='text'?'textContent':'htmlContent']=message.body_format==='text'?message.text_body:message.html_body
  let response
  try{response=await transport(payload,apiKey,settings.config.timeout_ms,beforeDispatch)}catch(error){if(error.dispatchDenied||error.workerRevoked)throw error;return {state:error.preflight?'retry':'uncertain',error_category:error.preflight?'network_preflight':'network_unknown',retry_seconds:30}}
  if(response.status===201){
   try { const value=JSON.parse(response.body);return {state:'accepted',provider_message_id:brevoMessageId(value.messageId),http_status:201} }
   catch{return {state:'uncertain',error_category:'invalid_acceptance',http_status:201}}
  }
  if(response.status===429){
   // Brevo documents the SMTP reset window in seconds. Honor either supplied
   // wait without retrying early; SQL retires waits beyond intent authorization.
   const seconds=value=>typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value)&&Number.isFinite(Number(value))&&Number(value)>0?Math.min(86400,Math.ceil(Number(value))):0
   const wait=Math.max(seconds(response.rateReset),seconds(response.retryAfter))||30
   return {state:'retry',error_category:'rate_limit',http_status:429,retry_seconds:wait}
  }
  if([400,401,402,403,404,405,406,422].includes(response.status)){
   let code
   try{code=JSON.parse(response.body).code}catch{}
   if(code==='duplicate_request')return {state:'uncertain',error_category:'provider_duplicate',http_status:response.status}
   const known={not_enough_credits:'quota',account_under_validation:'account_validation',permission_denied:'provider_restriction',unauthorized:'authentication',invalid_parameter:'invalid_request',missing_parameter:'invalid_request',out_of_range:'invalid_request',document_not_found:'endpoint',method_not_allowed:'endpoint'}
   const category=typeof code==='string'&&Object.hasOwn(known,code)?known[code]:({400:'invalid_request',401:'authentication',402:'quota',403:'provider_restriction',404:'endpoint',405:'endpoint',406:'invalid_request',422:'invalid_request'})[response.status]
   return {state:'failed',error_category:category,http_status:response.status}
  }
  return {state:'uncertain',error_category:'provider_unknown',http_status:response.status>=100&&response.status<=599?response.status:null}
 }
}
