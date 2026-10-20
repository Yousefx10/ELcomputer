import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createClaimsHttpFixture} from './helpers/claimsHttpFixture.mjs'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'

test('actual account handlers retain ownership and staff authorization behind the routing correction',async t=>{
  const f=await createClaimsHttpFixture({extraDirectories:['server/api/account/messages','server/api/support','server/api/customer-users','server/api/admin-shipping']})
  // This SQL function returns rows through PostgREST, unlike scalar fixture RPCs.
  const scalar=f.client.rpc
  f.client.rpc=(name,args)=>name==='support_customer_unread_counts'
    ?f.db.query('select * from public.support_customer_unread_counts($1,$2::uuid[])',[args.p_customer_id,args.p_ticket_ids]).then(result=>({data:result.rows,error:null}))
    :scalar(name,args)
  const {url,close}=await f.start()
  const call=async(path,{actor='buyer',method='GET',body}={})=>{
    const response=await fetch(url+path,{method,headers:{...(actor?{authorization:'Bearer '+actor}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
    return {status:response.status,body:await response.json()}
  }
  try{
    await t.test('all four reported list APIs reject missing, invalid and inactive identities',async()=>{
      for(const path of ['/api/account/messages','/api/support/tickets','/api/account/after-sales/claims','/api/customer-users']){
        for(const [actor,status]of [[null,401],['invalid',401],['disabled',403],['anonymous',403]])assert.equal((await call(path,{actor})).status,status,path+' '+actor)
      }
    })
    await t.test('messages expose only the current customer and never mutate on list reads',async()=>{
      const own=randomUUID(),other=randomUUID()
      await f.db.query("insert into public.customer_order_messages(id,user_id,sender_admin_user_id,sender_name,subject,body) values($1,$2,$5,'Staff','Owned message','Owned body'),($3,$4,$5,'Staff','Foreign message','Foreign body')",[own,f.customer,other,f.actors.stranger,f.owner])
      const result=await call('/api/account/messages');assert.equal(result.status,200)
      assert.deepEqual(result.body.items.map(row=>row.id),[own]);assert.equal(JSON.stringify(result.body).includes('Foreign body'),false)
      assert.equal((await f.db.query('select read_at from public.customer_order_messages where id=$1',[own])).rows[0].read_at,null)
      assert.equal((await call('/api/account/messages/'+other+'/read',{method:'PATCH'})).status,404)
      assert.equal((await call('/api/account/messages/'+own+'/read',{method:'PATCH'})).status,200)
      await f.db.query('update public.customer_profiles set is_active=false where id=$1',[f.customer])
      assert.equal((await call('/api/account/messages')).status,403)
      await f.db.query('update public.customer_profiles set is_active=true where id=$1',[f.customer])
    })
    let ticket
    await t.test('text support reuses idempotent creation, customer-scoped lists and private thread filtering',async()=>{
      const input={subject:'Isolated support question',message:'Isolated text only',idempotencyKey:randomUUID()}
      const first=await call('/api/support/tickets',{method:'POST',body:input});assert.equal(first.status,200,JSON.stringify(first.body));ticket=first.body.item.id
      assert.equal((await call('/api/support/tickets',{method:'POST',body:input})).body.item.id,ticket)
      assert.equal((await call('/api/support/tickets')).body.items[0].id,ticket)
      assert.deepEqual((await call('/api/support/tickets',{actor:'stranger'})).body.items,[])
      assert.equal((await call('/api/support/tickets/'+ticket,{actor:'stranger'})).status,404)
      await f.db.query("select public.support_add_message($1,$2,'staff','Staff','PRIVATE_INTERNAL_NOTE',true,$3)",[ticket,f.owner,randomUUID()])
      const detail=await call('/api/support/tickets/'+ticket);assert.equal(detail.status,200,JSON.stringify(detail.body));assert.equal(JSON.stringify(detail.body).includes('PRIVATE_INTERNAL_NOTE'),false)
      assert.equal((await call('/api/support/orders')).status,200)
      assert.equal((await call('/api/support/unread')).status,200)
    })
    await t.test('claims list/detail keep database customer binding and do not expose another claim',async()=>{
      await f.enable();const item=await f.purchase(),claim=await f.create(f.body(item))
      const id=claim.id
      const own=await call('/api/account/after-sales/claims');assert.equal(own.status,200);assert.ok(own.body.items.some(row=>row.id===id))
      const foreign=await call('/api/account/after-sales/claims',{actor:'stranger'});assert.equal(foreign.status,200);assert.deepEqual(foreign.body.items,[])
      assert.equal((await call('/api/account/after-sales/claims/'+id,{actor:'stranger'})).status,404)
      assert.equal((await call('/api/account/after-sales/items')).status,200)
    })
    await t.test('Store Customers remains staff-only and rechecks Users permission and active status',async()=>{
      for(const actor of ['buyer','stranger','viewer'])assert.equal((await call('/api/customer-users',{actor})).status,403,actor)
      const owner=await call('/api/customer-users',{actor:'owner'});assert.equal(owner.status,200,JSON.stringify(owner.body));assert.ok(owner.body.items.some(row=>row.id===f.customer))
      await f.db.query('update public.admin_users set permissions=$1 where id=$2',[JSON.stringify({'dashboard.view':true,'users.view':true}),f.actors.viewer])
      assert.equal((await call('/api/customer-users',{actor:'viewer'})).status,200)
      await f.db.query('update public.admin_users set permissions=$1 where id=$2',[JSON.stringify({'dashboard.view':true}),f.actors.viewer])
      assert.equal((await call('/api/customer-users',{actor:'viewer'})).status,403)
      await f.db.query('update public.admin_users set is_active=false where id=$1',[f.owner])
      assert.equal((await call('/api/customer-users',{actor:'owner'})).status,403)
      await f.db.query('update public.admin_users set is_active=true where id=$1',[f.owner])
      assert.equal(f.storageCalls.length,0)
    })
    await t.test('existing manual PDC connection check works while shipments stay disabled and product selection is empty',async()=>{
      const previousRuntime=globalThis.useRuntimeConfig,previousFetch=globalThis.fetch,calls=[]
      let outbound=false
      globalThis.useRuntimeConfig=()=>({shippingCredentialsEncryptionKey:'isolated-shipping-encryption-fixture-123456',shippingLiveRequestsEnabled:outbound})
      try{
        await f.db.query("update public.shipping_provider_settings set is_enabled=false,auto_create_labels=false,reverse_enabled=false,company_id='42',product_id=null,access_token_encrypted=$1 where id='pdc'",[encryptShippingSecret('isolated-access-token')])
        globalThis.fetch=async(input,options)=>{
          const target=new URL(String(input))
          if(target.hostname==='127.0.0.1')return previousFetch(input,options)
          assert.equal(target.href,'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/GetProducts')
          assert.equal(options.method,'GET');assert.equal(options.headers.AccessToken,'isolated-access-token')
          calls.push(target.pathname)
          return new Response(JSON.stringify([{id:42,name:'Isolated product'}]),{headers:{'content-type':'application/json'}})
        }
        assert.equal((await call('/api/admin-shipping/lookups',{actor:'owner',method:'POST',body:{action:'test'}})).status,503)
        outbound=true
        assert.equal((await call('/api/admin-shipping/lookups',{actor:'viewer',method:'POST',body:{action:'test'}})).status,403)
        assert.equal(calls.length,0)
        const response=await call('/api/admin-shipping/lookups',{actor:'owner',method:'POST',body:{action:'test'}})
        assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.connected,true);assert.equal(calls.length,1)
        const state=(await f.db.query("select is_enabled,auto_create_labels,reverse_enabled,product_id from public.shipping_provider_settings where id='pdc'")).rows[0]
        assert.deepEqual(state,{is_enabled:false,auto_create_labels:false,reverse_enabled:false,product_id:null})
        assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0)
        assert.equal(f.storageCalls.length,0)
      }finally{globalThis.fetch=previousFetch;globalThis.useRuntimeConfig=previousRuntime}
    })
  }finally{await close()}
})
