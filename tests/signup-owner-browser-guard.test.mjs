import test from 'node:test'
import assert from 'node:assert/strict'
import { OwnerBrowserGuard } from '../scripts/signup-gates/owner-browser-guard.mjs'
const make = () => new OwnerBrowserGuard({ origin:'https://shop.example.invalid',authOrigin:'https://auth.example.invalid',a:'a',b:'b' })
const request = (url,method='GET',payload) => ({url:()=>url,method:()=>method,postData:()=>JSON.stringify(payload)})
test('private owner sign-in permits one request per bound stage without reading secrets',()=>{
 const g=make(),r=request('https://auth.example.invalid/auth/v1/token?grant_type=password','POST')
 r.postData=()=>{throw Error('Password body must not be inspected')}
 assert.equal(g.decide(r),'allow');assert.equal(g.decide(r),'deny')
 for(const path of ['signup','recover','verify','invite'])assert.equal(g.decide(request('https://auth.example.invalid/auth/v1/'+path,'POST')),'deny')
 g.stage='LOGIN_B';assert.equal(g.decide(r),'allow');assert.equal(g.decide(r),'deny')
})
test('profile edit is exact A-only null restoration, once; B and all other fields fail closed',()=>{
 const g=make(),body={id:'a',email:'a@example.invalid',address_line_1:null,full_name:'A'}
 g.stage='PROFILE_A';g.armProfile(body)
 const url='https://auth.example.invalid/rest/v1/customer_profiles'
 for(const bad of [{...body,id:'b'},{...body,full_name:'Changed'},{...body,wallet_balance:99},[body]])assert.equal(g.decide(request(url,'POST',bad)),'deny')
 assert.equal(g.decide(request(url,'POST',body)),'allow');assert.equal(g.decide(request(url,'POST',body)),'deny')
 g.stage='ORDERS_B';assert.equal(g.decide(request(url,'POST',body)),'deny')
})
test('profile and order reads are bound; history connection, checkout and PDC stay blocked',()=>{
 const g=make();assert.equal(g.decide(request('https://auth.example.invalid/rest/v1/customer_profiles?id=eq.b')),'deny')
 g.stage='ORDERS_B'
 assert.equal(g.decide(request('https://auth.example.invalid/rest/v1/customer_orders?user_id=eq.b')),'allow')
 assert.equal(g.decide(request('https://auth.example.invalid/rest/v1/customer_orders?user_id=eq.a')),'deny')
 assert.equal(g.decide(request('https://shop.example.invalid/api/account/history')),'allow')
 for(const url of ['https://shop.example.invalid/api/account/history/claim','https://auth.example.invalid/rest/v1/rpc/customer_history_claim','https://shop.example.invalid/api/checkout','https://shop.example.invalid/api/payments/intentions','https://api.courier.example.invalid/SaveShipmentEx'])assert.equal(g.decide(request(url,'POST')),'deny')
})
test('logout is limited to one per stage and public reads cannot become writes',()=>{
 const g=make(),r=request('https://auth.example.invalid/auth/v1/logout','POST')
 assert.equal(g.decide(r),'deny');g.stage='LOGOUT_A';assert.equal(g.decide(r),'allow');assert.equal(g.decide(r),'deny')
 assert.equal(g.decide(request('https://shop.example.invalid/api/products','POST')),'deny')
 assert.equal(g.decide(request('https://unrelated.example.invalid/')),'deny')
})
