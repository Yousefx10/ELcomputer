import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parse} from '@vue/compiler-sfc'
import {ref,computed} from 'vue'
const script=parse(await readFile('app/components/account/HistoricalOrders.vue','utf8')).descriptor.scriptSetup.content
const factory=new Function('deps',`const {useCustomerScope,useI18n,ref,computed,onMounted}=deps;${script};return {rows,profiles,load,connect,show,error,notice,copy,address};`)
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(){
 const requests=[],callbacks=[],locale=ref('en');let current=true
 const state=factory({ref,computed,useI18n:()=>({locale}),onMounted:()=>{},useCustomerScope:()=>({isCurrent:()=>current,onInvalidate:fn=>callbacks.push(fn),request:(path,options)=>{const r=deferred();requests.push({path,options,...r});return r.promise}})})
 return {state,requests,locale,invalidate(){current=false;callbacks.forEach(fn=>fn())}}
}
test('changing customer clears previous profiles and orders; late private responses stay hidden',async()=>{
 const f=fixture(),first=f.state.load();f.requests[0].resolve({orders:[{legacy_id:'1'}],profiles:[{profile:{display_name:'Account A'}}],total:1});await first
 assert.equal(f.state.profiles.value.length,1)
 const late=f.state.load();f.invalidate();assert.equal(f.state.rows.value.length,0);assert.equal(f.state.profiles.value.length,0)
 f.requests[1].resolve({orders:[{legacy_id:'private'}],profiles:[{profile:{display_name:'Late A'}}],total:1});await late
 assert.equal(f.state.profiles.value.length,0);assert.equal(f.state.rows.value.length,0)
})
test('failed history reads remain errors and claim carries no customer-selected identity',async()=>{
 const f=fixture(),read=f.state.load();f.requests[0].reject(Error('Synthetic failure'));await read;assert.equal(f.state.error.value,true)
 const claim=f.state.connect();assert.deepEqual(f.requests[1].options.body,{confirmed:true});assert.equal(f.requests[1].options.retry,0)
 f.invalidate();f.requests[1].resolve({connected:1});await claim;assert.equal(f.state.notice.value,false)
})
test('the same compact history controls retain authored EN/AR labels',()=>{
 const f=fixture();assert.equal(f.state.copy.value.title,'Previous orders');f.locale.value='ar';assert.equal(f.state.copy.value.title,'الطلبات السابقة')
})
test('archived addresses use known fields in readable order, regardless of JSONB key order',()=>{
 const f=fixture();assert.equal(f.state.address({city:'Town',internal_field:'PRIVATE',address_2:'Floor 2',last_name:'Reader',address_1:'Main Street',first_name:'Test'}),'Test, Reader, Main Street, Floor 2, Town')
})
