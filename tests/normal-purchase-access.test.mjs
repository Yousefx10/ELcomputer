import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { ref, computed, getCurrentInstance } from 'vue'
import { createError } from 'h3'

let active, transport
Object.assign(globalThis,{
  ref,computed,getCurrentInstance,
  useNuxtApp:()=>active.app,
  useRuntimeConfig:()=>active.runtime,
  useSupabaseUser:()=>active.user,
  useSupabaseSession:()=>active.sessionRef,
  useSupabaseClient:()=>{const owner=active;return {auth:{getSession:async()=>({data:{session:owner.session}})}}},
  useState:(name,initial)=>{if(!active.state.has(name))active.state.set(name,ref(initial()));return active.state.get(name)},
  $fetch:(path,options)=>transport(path,options),
  defineNuxtRouteMiddleware:fn=>fn,
  createError,abortNavigation:error=>{throw error}
})
const compile = async file => {
  const result=await build({entryPoints:[resolve(file)],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.client':'false'}})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const {usePurchaseAccess}=await compile('app/composables/usePurchaseAccess.js')
const {useCustomerIdentity}=await compile('app/composables/useCustomerIdentity.js')
globalThis.useCustomerIdentity=useCustomerIdentity
globalThis.usePurchaseAccess=usePurchaseAccess
const {default:middleware}=await compile('app/middleware/purchasing.js')
const context = (siteUrl='https://orchid.example.invalid') => {
  const id=randomUUID()
  return {app:{},state:new Map(),runtime:{public:{siteUrl,purchasingEnabled:false}},user:ref({id}),session:{user:{id},access_token:'isolated-'+id}}
}
const allowed = () => ({card:{available:true},purchase:{available:true,restricted:true,productId:randomUUID(),variantId:randomUUID(),expiresAt:new Date(Date.now()+600000).toISOString()}})

test('two simultaneous SSR requests never share account-specific capabilities',async()=>{
  const a=context(),b=context('https://cedar.example.invalid'),capability=allowed()
  let calls=0
  transport=async(path,options)=>{
    assert.equal(path,'/api/payments/capabilities');assert.equal(options.retry,0);calls++
    await new Promise(resolve=>setTimeout(resolve,5))
    return options.headers.authorization==='Bearer '+a.session.access_token?capability:{card:{available:false},purchase:{available:false}}
  }
  active=a;const first=usePurchaseAccess(),firstRead=first.refresh()
  active=b;const second=usePurchaseAccess(),secondRead=second.refresh()
  await Promise.all([firstRead,secondRead])
  assert.equal(calls,2);assert.equal(first.purchasingEnabled.value,true);assert.equal(second.purchasingEnabled.value,false)
  assert.equal(first.allowsProduct(capability.purchase.productId,capability.purchase.variantId),true)
  assert.equal(first.allowsProduct(randomUUID()),false)
  assert.equal(second.capabilities.value.purchase.productId,undefined)
})

test('one request deduplicates simultaneous capability reads; a changed session cannot accept an older response',async()=>{
  const ctx=context();active=ctx
  let release,calls=0
  transport=async()=>{calls++;await new Promise(resolve=>{release=resolve});return allowed()}
  const first=usePurchaseAccess(),second=usePurchaseAccess()
  const reads=[first.refresh(),second.refresh()]
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal(calls,1)
  const id=randomUUID();ctx.session={user:{id},access_token:'different-session'};ctx.user.value={id}
  release();await Promise.all(reads)
  assert.equal(first.purchasingEnabled.value,false);assert.equal(second.purchasingEnabled.value,false)
})

test('normal middleware rejects default, anonymous, expired and denied access without lifecycle hooks',async()=>{
  for(const change of [{},{anonymous:true},{expired:true}]) {
    const ctx=context();active=ctx
    if(change.anonymous){ctx.user.value=null;ctx.session=null}
    transport=async()=>change.expired?{...allowed(),purchase:{...allowed().purchase,expiresAt:new Date(Date.now()-1).toISOString()}}:{card:{available:false},purchase:{available:false}}
    await assert.rejects(middleware(),error=>error.statusCode===403)
  }
  active=context();transport=async()=>allowed()
  await middleware()
  active=context();active.runtime.public.purchasingEnabled=true;active.session=null;active.user.value=null
  transport=()=>{throw Error('Public cart should not require a capability request')}
  await middleware()
})
