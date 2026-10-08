import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './resetDatabase.mjs'
import { smsDatabaseClient } from './smsDatabase.mjs'
import { getEmailSettings, validateEmailSettings } from '../../server/utils/email/settings.js'
import { emailRpc } from '../../server/utils/email/core.js'
export const emailFixtureRuntime={credentialsEncryptionKey:'email-fixture-master-over-32-characters',emailWorkerSecret:'email-fixture-worker-over-32-characters'}
export const EMAIL_KEY_CANARY='email-fixture-private-api-key-canary-over-32-characters'
export const WEBHOOK_CANARY='email-fixture-private-webhook-canary-over-32-characters'
export const createEmailFixture=async({database=null}={})=>{
 globalThis.useRuntimeConfig=()=>emailFixtureRuntime
 const db=database||await createResetDatabase(),client=smsDatabaseClient(db),actors={owner:randomUUID(),customer:randomUUID(),viewer:randomUUID(),manager:randomUUID(),templates:randomUUID(),sender:randomUUID(),history:randomUUID(),preferences:randomUUID(),inactive:randomUUID()}
 for(const [name,id]of Object.entries(actors)){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,name+'@email.example.invalid'])
  if(name==='customer')continue
  const permissions={'email.view':true,...Object.fromEntries(({viewer:['settings.view','templates.view'],manager:['settings.view','settings.manage'],templates:['templates.view','templates.manage'],sender:['transactional.send'],history:['history.view'],preferences:['marketing.manage']})[name]?.map(key=>['email.'+key,true])||[])}
  await db.query('insert into public.admin_users(id,email,role,permissions,is_active) values($1,$2,$3,$4,$5)',[id,name+'@email.example.invalid',name==='owner'?'owner':'admin',JSON.stringify(permissions),name!=='inactive'])
 }
 client.auth={getUser:async token=>({data:{user:actors[token]?{id:actors[token]}:null},error:null})}
 const settings=()=>getEmailSettings(client)
 const configure=async(change={},actor=actors.owner)=>{
  const current=await settings(),input=validateEmailSettings({revision:current.revision,...change},current)
  return emailRpc(client,'settings',input,actor)
 }
 const activate=async()=>{
  await configure({api_key:EMAIL_KEY_CANARY,webhook_token:WEBHOOK_CANARY,approved_senders:[{email:'store@email.example.invalid',name:'Fixture Store',verified:true},{email:'marketing@email.example.invalid',name:'Fixture Marketing',verified:true}],transactional_sender:'store@email.example.invalid',marketing_sender:'marketing@email.example.invalid',reply_to:'reply@email.example.invalid',brand_name:'Fixture Store',unsubscribe_origin:'https://store.example.invalid'})
  return configure({account_approved:true,activation_confirmed:true,is_enabled:true,marketing_enabled:true,webhook_enabled:true})
 }
 const fixtureWrite=async(sql,params=[])=>{await db.exec("begin;set local app.email_write='on';");try{const r=await db.query(sql,params);await db.exec('commit');return r}catch(e){await db.exec('rollback');throw e}}
 const unthrottle=()=>fixtureWrite("update public.email_provider_settings set next_dispatch_at=null")
 const message=async id=>(await db.query('select * from public.email_messages where id=$1',[id])).rows[0]
 const input=(changes={})=>({recipient:'buyer@email.example.invalid',sender:'store@email.example.invalid',locale:'en',subject:'Essential fixture',body:'Your fixture request has changed.',idempotency_key:randomUUID(),...changes})
 const template=(classification='transactional',changes={})=>({key:'fixture_'+classification,name:'Fixture '+classification,category:'fixture',classification,subject_en:'Request {{reference}}',subject_ar:'طلب {{reference}}',body_en:'Hello {{customer_name}}\n\n{{message}}',body_ar:'مرحبًا {{customer_name}}\n\n{{message}}',sender:'',reply_to:'',is_enabled:true,version:0,...changes})
 const saveTemplate=body=>emailRpc(client,'template',body,actors.owner)
 return {db,client,actors,settings,configure,activate,fixtureWrite,unthrottle,message,input,template,saveTemplate}
}
