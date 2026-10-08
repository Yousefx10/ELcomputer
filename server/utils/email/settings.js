import { encryptCredentialSecret, isCredentialEncryptionReady } from '../credentialSecrets.js'
import { emailAddress, emailLine } from '../../../app/utils/email.js'
import { emailFail, validateEmail } from './core.js'
export const EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email'
export const emailDefaults = Object.freeze({ is_enabled:false,marketing_enabled:false,approved_senders:[],transactional_sender:'',marketing_sender:'',reply_to:'',brand_name:'',account_approved:false,activation_confirmed:false,webhook_enabled:false,timeout_ms:10000,unsubscribe_origin:'' })
export const getEmailSettings = async db => {
 const {data,error}=await db.from('email_provider_settings').select('*').eq('id','brevo').maybeSingle()
 if(error || !data) emailFail('Email settings are unavailable.',503)
 return {...data,config:{...emailDefaults,...data.config}}
}
export const emailReadiness = s => {
 const c=s.config,missing=[]
 if(!s.api_key_encrypted) missing.push('api_key')
 if(!isCredentialEncryptionReady()) missing.push('encryption')
 if(!c.approved_senders.some(x=>x.email===c.transactional_sender && x.verified)) missing.push('approved_transactional_sender')
 for(const key of ['account_approved','activation_confirmed']) if(!c[key]) missing.push(key)
 return {ready:!missing.length,missing}
}
export const publicEmailSettings = s => ({config:Object.fromEntries(Object.keys(emailDefaults).map(key=>[key,s.config[key]??emailDefaults[key]])),revision:s.revision,api_url:EMAIL_API_URL,api_key_configured:!!s.api_key_encrypted,webhook_token_configured:!!s.webhook_token_encrypted,encryption_ready:isCredentialEncryptionReady(),readiness:emailReadiness(s),updated_at:s.updated_at})
export const validateEmailSettings = (body,current) => validateEmail(()=>{
 if(body.revision!==current.revision) emailFail('Email settings changed. Reload before saving.',409)
 const c={...current.config}, secrets={}
 const allowed=new Set([...Object.keys(emailDefaults),'revision','api_key','webhook_token','clear_api_key','clear_webhook_token'])
 if(Object.keys(body).some(k=>!allowed.has(k))) emailFail('Invalid email settings.')
 for(const key of ['is_enabled','marketing_enabled','account_approved','activation_confirmed','webhook_enabled']) if(body[key]!==undefined){if(typeof body[key]!=='boolean') throw Error('Invalid email settings.');c[key]=body[key]}
 for(const key of ['transactional_sender','marketing_sender','reply_to']) if(body[key]!==undefined)c[key]=body[key]?emailAddress(body[key]):''
 if(body.brand_name!==undefined)c.brand_name=emailLine(body.brand_name,100,false)
 if(body.timeout_ms!==undefined){if(!Number.isInteger(body.timeout_ms)||body.timeout_ms<1000||body.timeout_ms>30000) throw Error('Invalid email timeout.');c.timeout_ms=body.timeout_ms}
 if(body.unsubscribe_origin!==undefined){
  c.unsubscribe_origin=emailLine(body.unsubscribe_origin,300,false)
  if(c.unsubscribe_origin){const u=new URL(c.unsubscribe_origin); if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||u.hostname==='localhost'||/^\d/.test(u.hostname)||!u.hostname.includes('.')) throw Error('Use an approved HTTPS store origin.'); c.unsubscribe_origin=u.origin}
 }
 if(body.approved_senders!==undefined){
  if(!Array.isArray(body.approved_senders)||body.approved_senders.length>20) throw Error('Invalid approved senders.')
  c.approved_senders=body.approved_senders.map(x=>{if(!x||typeof x.verified!=='boolean'||Object.keys(x).some(k=>!['email','name','verified'].includes(k))) throw Error('Invalid approved sender.'); return {email:emailAddress(x.email),name:emailLine(x.name,100),verified:x.verified}})
  if(new Set(c.approved_senders.map(x=>x.email)).size!==c.approved_senders.length) throw Error('Duplicate approved sender.')
 }
 for(const key of ['api_key','webhook_token']){
  if(body[key]!==undefined && typeof body[key]!=='string') throw Error('Invalid email credential.')
  if(body['clear_'+key]!==undefined && typeof body['clear_'+key]!=='boolean') throw Error('Invalid email credential.')
  if(body['clear_'+key] && body[key]) throw Error('Choose replacement or removal.')
  if(body[key]){const value=emailLine(body[key],1024);if(value!==body[key]||value.length<32||!/^[!-~]+$/.test(value)) throw Error('Use a credential of at least 32 characters.');secrets[key+'_encrypted']=encryptCredentialSecret(value,'Email')}
  else if(body['clear_'+key])secrets[key+'_encrypted']=null
 }
 if('api_key_encrypted' in secrets || JSON.stringify(c.approved_senders.map(x=>[x.email,x.name,x.verified]))!==JSON.stringify(current.config.approved_senders.map(x=>[x.email,x.name,x.verified]))||c.transactional_sender!==current.config.transactional_sender||c.marketing_sender!==current.config.marketing_sender){ c.is_enabled=false;c.account_approved=false;c.activation_confirmed=false }
 if('webhook_token_encrypted' in secrets)c.webhook_enabled=false
 const merged={...current,...secrets,config:c}
 if(c.is_enabled&&!emailReadiness(merged).ready) emailFail('Complete email activation checks before enabling.',409)
 if(c.webhook_enabled&&(!merged.webhook_token_encrypted||!isCredentialEncryptionReady())) emailFail('Configure webhook authentication before enabling.',409)
 if(c.marketing_enabled&&(!c.unsubscribe_origin||!c.approved_senders.some(x=>x.email===c.marketing_sender&&x.verified))) emailFail('Complete marketing sender and unsubscribe settings.',409)
 return {revision:body.revision,config:c,...secrets}
})
