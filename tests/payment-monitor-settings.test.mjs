import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createEmailFixture} from './helpers/emailFixture.mjs'
import {getEmailSettings,publicEmailSettings,validateEmailSettings} from '../server/utils/email/settings.js'
import {emailRpc} from '../server/utils/email/core.js'
import {parse,compileTemplate} from '@vue/compiler-sfc'

test('MON-01 recipient uses existing RBAC, revision and audit without enabling email',async()=>{
 const f=await createEmailFixture()
 try {
  const settings=await getEmailSettings(f.client)
  assert.equal(settings.config.monitor_recipient,'')
  const patch=validateEmailSettings({revision:settings.revision,monitor_recipient:'Owner@Example.INVALID'},settings)
  assert.equal(patch.config.monitor_recipient,'owner@example.invalid')
  assert.equal(patch.config.is_enabled,false)
  assert.equal(patch.config.activation_confirmed,false)
  assert.equal(patch.api_key_encrypted,undefined)
  await assert.rejects(()=>emailRpc(f.client,'settings',patch,f.actors.customer),/permission/)
  await emailRpc(f.client,'settings',patch,f.actors.owner)
  const saved=await getEmailSettings(f.client)
  assert.equal(saved.config.monitor_recipient,'owner@example.invalid')
  assert.throws(()=>validateEmailSettings({revision:settings.revision,monitor_recipient:'next@example.invalid'},saved),/changed/)
  for(const address of ['a@example.invalid\r\nBcc:x@y.com','a,b@example.invalid',null,{}])assert.throws(()=>validateEmailSettings({revision:saved.revision,monitor_recipient:address},saved))
  assert.equal(validateEmailSettings({revision:saved.revision,monitor_recipient:''},saved).config.monitor_recipient,'')
  assert.equal((await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n,0)
  assert.doesNotMatch(JSON.stringify(publicEmailSettings(saved)),/api_key_encrypted|webhook_token_encrypted/)
 }finally{await f.db.close()}
})

test('MON-01 Dashboard recipient compiles and has EN/AR labels',async()=>{
 const filename=new URL('../app/pages/dashboard/email.vue',import.meta.url),source=await readFile(filename,'utf8'),{descriptor,errors}=parse(source)
 assert.deepEqual(errors,[])
 assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'email.vue',id:'mon01'}).errors,[])
 for(const locale of ['en','ar']){
  const values=JSON.parse(await readFile(new URL('../i18n/locales/'+locale+'.json',import.meta.url),'utf8'))
  assert.ok(values.emailFoundation.monitorRecipient)
  assert.ok(values.emailFoundation.monitorRecipientHint)
 }
})
