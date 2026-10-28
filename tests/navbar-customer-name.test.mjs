import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { ref, shallowRef, computed, watch, effectScope, nextTick } from 'vue'
import { customerDisplayName } from '../app/utils/customerDisplayName.js'
const require=createRequire(import.meta.url)
const source=await readFile('app/composables/useCustomerDisplayProfile.js','utf8')
const factories={}
for(const client of [true,false]){
 const result=await build({stdin:{contents:`export default function(deps){const {ref,shallowRef,computed,watch,effectScope,onMounted,useNuxtApp,useSupabaseClient,useCustomerIdentity,window,setTimeout,clearTimeout}=deps;${source.replace('export const useCustomerDisplayProfile','const useCustomerDisplayProfile')};return useCustomerDisplayProfile}`,loader:'js'},bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.client':String(client)}})
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);factories[client]=module.exports.default
}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();await nextTick()}
const fixture=(client=true)=>{
 const user=ref({id:'alice'}),epoch=ref(0),identity={user,accountId:computed(()=>user.value?.is_anonymous?'':user.value?.id||''),key:computed(()=>`${user.value?.id||'guest'}:${epoch.value}`)}
 const reads=[],mounted=[],dispose=[],events=new Map(),timeouts=new Map(),app={vueApp:{onUnmount:fn=>dispose.push(fn)}}
 const supabase = { from(table) {
  assert.equal(table, 'customer_profiles')
  return { select: columns => ({ eq(field, id) {
   assert.equal(field, 'id')
   return { maybeSingle: () => ({ abortSignal: signal => new Promise(resolve => reads.push({ id, columns, signal, resolve })) }) }
  } }) }
 } }

 const use=factories[client]({ref,shallowRef,computed,watch,effectScope,onMounted:fn=>mounted.push(fn),useNuxtApp:()=>app,useSupabaseClient:()=>supabase,useCustomerIdentity:()=>identity,
 window:{addEventListener:(k,v)=>{assert.equal(events.has(k),false);events.set(k,v)},removeEventListener:k=>events.delete(k)},
 setTimeout:(fn,ms)=>{const key={};timeouts.set(key,{fn,ms});return key},clearTimeout:key=>timeouts.delete(key)})
 const mount=()=>{for(const fn of mounted.splice(0))fn()}
 const switchTo=value=>{user.value=value;epoch.value++}
 return {use,reads,identity,mount,switchTo,events,timeouts,dispose:()=>dispose.forEach(fn=>fn())}
}
test('navbar and account layout deduplicate one minimal own-profile read and reuse it after remount',async t=>{
 const f=fixture();t.after(f.dispose);const a=f.use(),b=f.use();assert.equal(f.reads.length,0);f.mount();assert.equal(f.reads.length,1)
 assert.equal(f.reads[0].columns,'id, full_name, created_at, is_active');assert.equal(a.ready.value,false)
 f.reads[0].resolve({data:{id:'alice',full_name:'Alice',is_active:true}});await settle();assert.equal(a.profile.value.full_name,'Alice');assert.equal(a.profile,b.profile)
 f.use();f.mount();await settle();assert.equal(f.reads.length,1);assert.equal(f.events.size,1)
})
test('old account-header isolation: clears immediately and ignores late A→B→A responses',async t=>{
 const f=fixture();t.after(f.dispose);const a=f.use();f.mount();f.switchTo({id:'bob'});assert.equal(a.profile.value,null);await settle();const b=f.reads.at(-1)
 f.switchTo({id:'alice'});assert.equal(a.ready.value,false);await settle();const current=f.reads.at(-1)
 assert.equal(f.reads.length,3);assert.equal(f.reads[0].signal.aborted,true);assert.equal(b.signal.aborted,true)
 current.resolve({data:{id:'alice',full_name:'Current Alice'}});await settle();b.resolve({data:{id:'bob',full_name:'Bob'}});f.reads[0].resolve({data:{id:'alice',full_name:'Stale Alice'}});await settle();assert.equal(a.profile.value.full_name,'Current Alice')
 f.switchTo(null);assert.equal(a.profile.value,null);assert.equal(a.ready.value,false);await settle();assert.equal(f.reads.length,3)
})
test('same-account profile update refreshes once without clearing the visible name',async t=>{
 const f=fixture();t.after(f.dispose);const a=f.use();f.use();f.mount();f.reads[0].resolve({data:{id:'alice',full_name:'Before'}});await settle()
 f.events.get('account:profile-updated')();assert.equal(f.reads.length,2);assert.equal(a.ready.value,true);assert.equal(a.profile.value.full_name,'Before')
 f.reads[1].resolve({data:{id:'alice',full_name:'After'}});await settle();assert.equal(a.profile.value.full_name,'After')
})
test('guest and anonymous sessions make no reads; failed and foreign-profile replies use a safe fallback',async t=>{
 const f=fixture();t.after(f.dispose);f.switchTo(null);const a=f.use();f.mount();assert.equal(f.reads.length,0)
 f.switchTo({id:'anonymous',is_anonymous:true});await settle();assert.equal(f.reads.length,0)
 f.switchTo({id:'bob'});await settle();f.reads.at(-1).resolve({data:{id:'alice',full_name:'Foreign'}});await settle();assert.equal(a.profile.value,null);assert.equal(a.ready.value,true)
 f.switchTo({id:'carol'});await settle();f.reads.at(-1).resolve({error:Error('Synthetic unavailable')});await settle();assert.equal(a.profile.value,null);assert.equal(a.ready.value,true)
 assert.equal(f.timeouts.size,0)
})
test('SSR makes no requests or serialized name state and separate app instances share no profile cache',async t=>{
 const server=fixture(false),a=server.use();server.mount();assert.equal(server.reads.length,0);assert.equal(a.profile.value,null)
 const f=fixture(),g=fixture();t.after(f.dispose);t.after(g.dispose);const first=f.use(),second=g.use();f.mount();g.mount();f.reads[0].resolve({data:{id:'alice',full_name:'First app'}});await settle();assert.equal(second.profile.value,null);assert.equal(first.profile.value.full_name,'First app')
})
test('a bounded profile timeout resolves to fallback and clears its pending request',async t=>{
 const f=fixture();t.after(f.dispose);const a=f.use();f.mount();const read=f.reads[0]
 read.signal.addEventListener('abort',()=>read.resolve({error:Error('Aborted')}))
 const timer=[...f.timeouts.values()][0];assert.equal(timer.ms,20000);timer.fn();await settle()
 assert.equal(a.ready.value,true);assert.equal(a.profile.value,null);assert.equal(f.timeouts.size,0)
})
test('display names prefer saved profile text and Auth names; never derive a name from email',()=>{
 assert.equal(customerDisplayName({full_name:'  عميل   متجر  '},{user_metadata:{preferred_name:'Alias'}},'Account'),'عميل متجر')
 assert.equal(customerDisplayName(null,{user_metadata:{preferred_name:'Preferred',display_name:'Display'}},'Account'),'Preferred')
 assert.equal(customerDisplayName(null,{user_metadata:{display_name:'Display'}},'Account'),'Display')
 assert.equal(customerDisplayName({full_name:17},{email:'private@example.invalid',user_metadata:{full_name:{unexpected:true},name:'  '}},'حسابي'),'حسابي')
 assert.equal(customerDisplayName({full_name:'\u202eName\u2066\n'},null,'Account'),'Name')
 assert.equal(customerDisplayName({full_name:'x'.repeat(300)},null,'Account').length,160)
})
