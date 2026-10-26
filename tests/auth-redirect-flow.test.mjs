import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {parse} from '@vue/compiler-sfc'
import {ref,computed,watch,nextTick} from 'vue'
import {createBrowserClient} from '@supabase/ssr'
import {requestControlledConfirmation} from '../scripts/auth-email-acceptance/confirmation-browser.mjs'

// Actual login SFC + installed SSR/Auth SDK. All Auth transport is a closed
// in-memory fixture: no hosted endpoint, email, customer identity or password.
const script=parse(await readFile('app/pages/login.vue','utf8')).descriptor.scriptSetup.content
const imports=(script.match(/^import .*$/gm)||[]).join('\n')
const bundled=await build({stdin:{contents:imports+`\nexport default async function(deps){
 const {ref,computed,watch,onMounted,useUiNavigation,useI18n,useSupabaseClient,useRuntimeConfig,useUiRoute,useSupabaseUser,useSiteContent,window,sessionStorage,$fetch}=deps;
 ${script.replace(/^import .*$/gm,'')}
 return {authMode,email,password,submitAuthForm,errorKey,successKey,finishing};
}`,resolveDir:resolve('.'),loader:'js'},bundle:true,write:false,platform:'node',format:'cjs',alias:{'~':resolve('app')},define:{'import.meta.client':'true','import.meta.server':'false'}})
const module={exports:{}}
new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
const pageFactory=module.exports.default
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await nextTick();await new Promise(r=>setTimeout(r,0))}

function browser(t,url){
 const prior=Object.fromEntries(['window','document','history','BroadcastChannel'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
 const location=new URL(url),history={state:{},replaceState:(_state,_title,url)=>{location.href=new URL(url,location).href}}
 const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}}
 const tabStorage=new Map()
 const sessionStorage={getItem:key=>tabStorage.get(key)||null,setItem:(key,value)=>tabStorage.set(key,value)}
 const window={location,history,document,sessionStorage,addEventListener(){},removeEventListener(){}}
 Object.defineProperty(globalThis,'window',{value:window,configurable:true,writable:true})
 Object.defineProperty(globalThis,'document',{value:document,configurable:true,writable:true})
 Object.defineProperty(globalThis,'history',{value:history,configurable:true,writable:true})
 Object.defineProperty(globalThis,'BroadcastChannel',{value:undefined,configurable:true,writable:true})
 t.after(()=>{for(const[k,d]of Object.entries(prior)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}})
 return window
}

function transport(){
 const user={id:randomUUID(),email:'customer@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',is_anonymous:false,user_metadata:{full_name:'Fixture Customer'}}
 const calls=[],proof={challenge:null,consumed:false}
 const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,email:user.email,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).concat('Zml4dHVyZQ').join('.')
 const reply=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
 const fetcher=async(input,options={})=>{
  const url=new URL(String(input)),method=options.method||'GET',body=options.body?JSON.parse(options.body):null
  assert.equal(url.origin,'https://auth-fixture.example.invalid','All requests stay inside the fixture transport')
  calls.push({path:url.pathname,method,body,redirect:url.searchParams.get('redirect_to')})
  if(['/auth/v1/recover','/auth/v1/signup','/auth/v1/resend'].includes(url.pathname)){
   proof.challenge=body.code_challenge;proof.consumed=false
   assert.equal(body.code_challenge_method,'s256')
   return reply(url.pathname.endsWith('/signup')?{user}: {})
  }
  if(url.pathname==='/auth/v1/token'){
   assert.equal(url.searchParams.get('grant_type'),'pkce')
   if(body.auth_code!=='fixture-code'||proof.consumed||createHash('sha256').update(body.code_verifier).digest('base64url')!==proof.challenge)return reply({msg:'Invalid fixture code',error_code:'bad_code_verifier'},400)
   proof.consumed=true
   return reply({access_token:token,refresh_token:'fixture-refresh-token',expires_in:3600,token_type:'bearer',user})
  }
  if(url.pathname==='/auth/v1/user')return reply(user)
  if(url.pathname==='/auth/v1/logout')return reply(null,204)
  throw Error('Unexpected fixture endpoint')
 }
 return {user,calls,fetcher}
}

function client(t,network,cookies,key){
 // Two clients sharing cookies model a full browser reload. The SDK's
 // multiple-instance warning is expected in this single-process fixture.
 const sdk=createBrowserClient('https://auth-fixture.example.invalid','fixture-public-key',{
  isSingleton:false,cookieOptions:{name:key},auth:{autoRefreshToken:false},
  cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>{for(const {name,value}of values){if(value)cookies.set(name,value);else cookies.delete(name)}}},
  global:{fetch:network.fetcher}
 })
 t.after(async()=>{await sdk.auth.stopAutoRefresh();sdk.auth.broadcastChannel?.close()})
 return sdk
}

async function page(t,sdk,window,locale,mode,initialUser=null){
 const navigation=[],stops=[],user=ref(initialUser)
 const adapter={auth:sdk.auth,from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:initialUser?.sub,email:'customer@example.invalid',full_name:'Fixture Customer',is_active:true,avatar_url:null}})})})})}
 const state=await pageFactory({ref,computed,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop},onMounted:()=>{},
  useUiNavigation:()=>({uiNavigateTo:async path=>{navigation.push(path)}}),useI18n:()=>({locale:ref(locale),t:k=>k}),useSupabaseClient:()=>adapter,
  useRuntimeConfig:()=>({public:{}}),useUiRoute:()=>({query:{...(mode?{mode}:{} )}}),useSupabaseUser:()=>user,useSiteContent:async()=>({data:ref({settings:{}})}),window,sessionStorage:{getItem:()=>null,removeItem(){}},$fetch:async()=>({})})
 t.after(()=>stops.forEach(stop=>stop()))
 return {state,navigation,user}
}

for(const locale of ['en','ar'])test(`actual ${locale} recovery uses its exact redirect and PKCE reaches the password form`,async t=>{
 const origin='https://shop-fixture.example.invalid',prefix=locale==='ar'?'/ar':'',window=browser(t,origin+prefix+'/login?mode=forgot'),network=transport(),cookies=new Map(),key='fixture-'+randomUUID()
 const first=client(t,network,cookies,key);await first.auth.getSession()
 const request=await page(t,first,window,locale,'forgot');request.state.email.value=' customer@example.invalid '
 await request.state.submitAuthForm();assert.equal(request.state.successKey.value,'authPage.resetSent')
 const recover=network.calls.find(c=>c.path.endsWith('/recover'));assert.equal(recover.redirect,origin+prefix+'/login?mode=recovery');assert.equal(recover.body.email,'customer@example.invalid')
 assert.ok([...cookies.keys()].some(k=>k.includes('code-verifier')))
 window.location.href=recover.redirect+'&code=fixture-code'
 const returned=client(t,network,cookies,key),events=[];returned.auth.onAuthStateChange(event=>{events.push(event)})
 const session=await returned.auth.getSession();assert.equal(session.error,null);assert.equal(session.data.session.user.id,network.user.id);await settle()
 assert.ok(events.includes('PASSWORD_RECOVERY'));assert.equal(window.location.search,'?mode=recovery')
 const form=await page(t,returned,window,locale,'recovery',{sub:network.user.id});await settle()
 assert.equal(form.state.authMode.value,'recovery');assert.deepEqual(form.navigation,[])
 form.state.password.value='Synthetic-fixture-password-1';await form.state.submitAuthForm()
 assert.equal(form.state.successKey.value,'authPage.passwordUpdated');assert.equal(form.state.password.value,'')
 assert.equal(network.calls.filter(c=>c.path.endsWith('/token')).length,1)
 assert.equal(network.calls.filter(c=>c.path.endsWith('/user')&&c.method==='PUT').length,1)
 assert.equal(network.calls.filter(c=>c.path.endsWith('/logout')).length,1)
})

for(const locale of ['en','ar'])test(`actual ${locale} confirmation uses its exact redirect and exchanges PKCE before account entry`,async t=>{
 const origin='https://another-store.example.invalid',prefix=locale==='ar'?'/ar':'',window=browser(t,origin+prefix+'/login?mode=signup'),network=transport(),cookies=new Map()
 const sdk=client(t,network,cookies,'fixture-'+randomUUID());await sdk.auth.getSession()
 const p=await page(t,sdk,window,locale,'signup');p.state.email.value=network.user.email;p.state.password.value='Synthetic-fixture-password-2'
 await p.state.submitAuthForm();assert.equal(p.state.successKey.value,'authPage.checkEmail')
 const signup=network.calls.find(c=>c.path.endsWith('/signup'))
 assert.equal(signup.redirect,origin+prefix+'/login')
 assert.deepEqual(p.navigation,[])
 window.location.href=signup.redirect+'?code=fixture-code'
 const returned=client(t,network,cookies,sdk.auth.storageKey),events=[]
 returned.auth.onAuthStateChange(event=>{events.push(event)})
 const session=await returned.auth.getSession()
 assert.equal(session.error,null);assert.equal(session.data.session.user.id,network.user.id);await settle()
 assert.ok(events.includes('SIGNED_IN'));assert.equal(window.location.search,'')
 const confirmed=await page(t,returned,window,locale,null,{sub:network.user.id});await settle()
 assert.deepEqual(confirmed.navigation,['/account'])
 assert.equal(network.calls.filter(c=>c.path.endsWith('/token')).length,1)
 assert.equal(network.calls.filter(c=>c.method==='PUT').length,0)
})

test('a callback without its originating browser verifier cannot update a password',async t=>{
 const window=browser(t,'https://shop-fixture.example.invalid/login?mode=recovery&code=fixture-code'),network=transport(),sdk=client(t,network,new Map(),'fixture-'+randomUUID())
 assert.equal((await sdk.auth.getSession()).data.session,null)
 const p=await page(t,sdk,window,'en','recovery');p.state.password.value='Synthetic-fixture-password-3';await p.state.submitAuthForm()
 assert.equal(p.state.errorKey.value,'authPage.recoveryExpired');assert.equal(network.calls.filter(c=>c.method==='PUT').length,0)
})

for(const locale of ['en','ar'])test(`controlled ${locale} confirmation sends once with browser PKCE while signup stays unused`,async t=>{
 const origin='https://controlled-store.example.invalid',prefix=locale==='ar'?'/ar':''
 const window=browser(t,origin+prefix+'/login'),network=transport(),cookies=new Map(),key='fixture-'+randomUUID()
 const sdk=client(t,network,cookies,key);await sdk.auth.getSession()
 window.document.querySelector=()=>({__vue_app__:{$nuxt:{$supabase:{client:sdk}}}})
 const target={send_approved:true,test_id:'AUTH-CONFIRM-01',identity_id:network.user.id,email:network.user.email,origin,locale}
 const result=await requestControlledConfirmation(target,window)
 assert.equal(result.status,'REQUEST_ACCEPTED_DELIVERY_UNVERIFIED')
 const sent=network.calls.find(c=>c.path.endsWith('/resend'))
 assert.equal(sent.body.type,'signup');assert.equal(sent.redirect,origin+prefix+'/login')
 await assert.rejects(requestControlledConfirmation(target,window),/already attempted/)
 assert.equal(network.calls.filter(c=>c.path.endsWith('/resend')).length,1)
 assert.equal(network.calls.filter(c=>c.path.endsWith('/signup')).length,0)
 window.location.href=sent.redirect+'?code=fixture-code'
 const returned=client(t,network,cookies,key),session=await returned.auth.getSession()
 assert.equal(session.error,null);assert.equal(session.data.session.user.id,target.identity_id)
 assert.equal(window.location.search,'')
 const confirmed=await page(t,returned,window,locale,null,{sub:target.identity_id});await settle()
 assert.deepEqual(confirmed.navigation,['/account'])
 await assert.rejects(requestControlledConfirmation({...target,test_id:'AUTH-CONFIRM-SIGNED-IN'},window),/signed-out/)
 assert.equal(network.calls.filter(c=>c.path.endsWith('/resend')).length,1)
})

test('preparation cannot send a confirmation email without its explicit approval',async()=>{
 await assert.rejects(requestControlledConfirmation({send_approved:false}),/needs approval/)
})
