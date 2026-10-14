// Actual owned Auth/Storage/PostgREST/TLS/Supautils. Realtime and Nuxt's server
// shell are explicit fixtures. Transport refuses every non-laboratory origin.
import { readFile, readdir, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import https from 'node:https'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { build } from 'esbuild'
import { createApp, createRouter, toNodeListener, readBody, setHeader } from 'h3'
import { createInstallerPlatform, installerNativeAvailable } from './installerPlatform.mjs'
import { applyCandidate, catalog, assertCatalogEquivalent } from '../../scripts/lib/cleanBaseline.mjs'
import { bootstrapFirstOwner } from '../../scripts/lib/installationBootstrap.mjs'
export { installerNativeAvailable as resetPlatformAvailable }

export async function createResetPlatform({installedLab=null,applicationSource=null}={}) {
 const lab=installedLab||await createInstallerPlatform(),directory=await realpath(await mkdtemp('/tmp/elcomputer-reset-platform-'))
 const uploads=directory+'/uploads',key='__resetPlatform_'+randomUUID().replaceAll('-',''),root=resolve('.'),db=lab.db
 await mkdir(uploads)
 let server
 const close=async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}delete globalThis[key];if(!installedLab)await lab.close();await rm(directory,{recursive:true,force:true})}
 try{
  const ca=await readFile(lab.target.api_ca_file),base=new URL(lab.target.api_url)
  const transport=async(input,options={})=>{
   const url=new URL(typeof input==='string'?input:input.url)
   if(url.origin!==base.origin||url.hostname!=='127.0.0.1'||!url.pathname.startsWith(base.pathname+'/'))throw Error('External request refused by owned reset platform')
   const headers=Object.fromEntries(new Headers(options.headers).entries());if(options.body){headers['content-length']=String(Buffer.byteLength(options.body));delete headers['transfer-encoding']}
   return new Promise((resolveResponse,reject)=>{
    const request=https.request(url,{method:options.method||'GET',headers,agent:false,ca,rejectUnauthorized:true,timeout:15000},response=>{const chunks=[];response.on('data',b=>chunks.push(b));response.on('end',()=>resolveResponse(new Response([204,205,304].includes(response.statusCode)?null:Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));response.on('error',reject)})
    request.on('error',reject);request.on('timeout',()=>request.destroy());if(options.body)request.write(options.body);request.end()
   })
  }
  const authClient=()=>createClient(lab.target.api_url,lab.credentials.anon_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}})
  const service=createClient(lab.target.api_url,lab.credentials.service_role_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}})
  let journal
  if(!installedLab){
  await applyCandidate(db,{installationId:lab.target.installation_id,validate:async d=>assertCatalogEquivalent(await catalog(d),JSON.parse(await readFile(root+'/supabase/bootstrap/clean-v1/expected-schema.json')))})
  await db.query(await readFile(root+'/supabase/migrations/20261012160000_quick_setup_installation_bootstrap.sql','utf8'))
  journal=await bootstrapFirstOwner({db,authAdmin:service.auth.admin,target:{installation_id:lab.target.installation_id,request_id:randomUUID(),target_digest:createHash('sha256').update('owned-reset-platform').digest('hex'),project_ref:lab.target.project_ref,site_origin:lab.target.site_origin},email:lab.owner.email,password:lab.owner.password,fullName:lab.owner.full_name,confirmOwner:true})
  for(const name of (await readdir(root+'/supabase/migrations')).filter(n=>n.endsWith('.sql')&&n>'20261012160000_quick_setup_installation_bootstrap.sql').sort())await db.query(await readFile(root+'/supabase/migrations/'+name,'utf8'))
  const buckets=JSON.parse(await readFile(root+'/supabase/bootstrap/clean-v1/storage.json'))
  for(const b of buckets){const r=await service.storage.createBucket(b.id,{public:false,fileSizeLimit:Number(b.file_size_limit),allowedMimeTypes:b.allowed_mime_types});if(r.error)throw Error(r.error.message)}
  }else{
   if((await db.query("select count(*)::int n from supabase_migrations.schema_migrations")).rows[0]?.n!==79)throw Error('Uncertified attached fixture')
   journal=(await db.query('select auth_subject,phase from private.installation_bootstrap')).rows[0]
   if(journal?.phase!=='complete')throw Error('Unsealed attached fixture')
  }
  await db.query("notify pgrst,'reload schema'");await new Promise(r=>setTimeout(r,1200))
  const tokens={},actors={owner:journal.auth_subject},browser=authClient()
  const signed=await browser.auth.signInWithPassword({email:lab.owner.email,password:lab.owner.password});if(signed.error)throw Error(signed.error.message);tokens.owner=signed.data.session.access_token
  const createActor=async(name,permissions=null)=>{
   const email=name+'@'+lab.target.project_ref+'.example.invalid',r=await service.auth.admin.createUser({email,password:lab.owner.password,email_confirm:true});if(r.error)throw Error(r.error.message);actors[name]=r.data.user.id
   if(permissions)await db.query("insert into public.admin_users(id,email,role,permissions) values($1,$2,'admin',$3)",[actors[name],email,JSON.stringify(permissions)])
   const client=authClient(),login=await client.auth.signInWithPassword({email,password:lab.owner.password});if(login.error)throw Error(login.error.message);tokens[name]=login.data.session.access_token;return actors[name]
  }
  await createActor('customer');await createActor('editor',{'products.view':true,'products.add':true,'products.edit':true})
  // The Realtime fixture needs its declared sender privilege. No hosted role or
  // managed service object ownership is changed by application migration79.
  await lab.root.query('grant insert on realtime.messages to postgres;grant usage on sequence realtime.messages_id_seq to postgres')
  globalThis[key]={service,transport,config:{public:{supabaseUrl:lab.target.api_url},supabaseServiceRoleKey:lab.credentials.service_role_key,uploadsDir:uploads,shippingLiveRequestsEnabled:false,paymobEnabled:false,smsLiveRequestsEnabled:false}}
  globalThis.defineEventHandler=h=>h;globalThis.readBody=readBody;globalThis.setHeader=setHeader
  const router=createRouter()
  const handlerRoot=resolve(applicationSource||root)
  const routes=[
   ['post','/api/admin-treasury/salary-payment','server/api/admin-treasury/salary-payment.post.js'],
   ['post','/api/admin-logs','server/api/admin-logs/index.post.js'],
   ['get','/api/admin-system-reset','server/api/admin-system-reset/index.get.js'],['post','/api/admin-system-reset','server/api/admin-system-reset/index.post.js'],
   ['get','/api/chat/status','server/api/chat/status.get.js'],['get','/api/admin-chat/settings','server/api/admin-chat/settings.get.js'],['put','/api/admin-chat/settings','server/api/admin-chat/settings.put.js'],
   ['get','/api/admin-shipping/settings','server/api/admin-shipping/settings.get.js'],['patch','/api/admin-shipping/settings','server/api/admin-shipping/settings.patch.js'],
   ['post','/api/analytics/events','server/api/analytics/events.post.js'],
   ['post','/api/admin-products','server/api/admin-products/index.post.js'],['get','/api/admin-products/:id','server/api/admin-products/[id].get.js'],['patch','/api/admin-products/:id','server/api/admin-products/[id].patch.js'],
   ['get','/api/admin-products','server/api/admin-products/index.get.js'],['post','/api/admin-products/bulk','server/api/admin-products/bulk.post.js'],
   ['get','/api/admin-products/list','server/api/admin-products/list.get.js'],
   ['post','/api/admin-products/transfer/export','server/api/admin-products/transfer/export.post.js'],['post','/api/admin-products/transfer/preview','server/api/admin-products/transfer/preview.post.js'],
   ['post','/api/checkout/quote','server/api/checkout/quote.post.js'],
   ['post','/api/checkout','server/api/checkout/index.post.js'],
   ['post','/api/admin-products/transfer/import','server/api/admin-products/transfer/import/index.post.js'],['post','/api/admin-products/transfer/import/approve','server/api/admin-products/transfer/import/approve.post.js'],
   ['post','/api/admin-products/transfer/import/apply','server/api/admin-products/transfer/import/apply.post.js'],['get','/api/admin-products/transfer/import','server/api/admin-products/transfer/import/index.get.js']
  ]
  for(const [method,path,file]of routes){
   // The frozen79 checkout contract must execute its frozen79 handlers. Salary
   // commands were added in81 and have no route in that historical package.
   if(applicationSource&&file==='server/api/admin-treasury/salary-payment.post.js')continue
   const compiled=await build({entryPoints:[handlerRoot+'/'+file],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':handlerRoot+'/app'},banner:{js:'const useRuntimeConfig=()=>globalThis['+JSON.stringify(key)+'].config;'},plugins:[{name:key,setup(b){
    b.onResolve({filter:/\/supabaseAdmin$/},()=>({path:key,namespace:key}));b.onLoad({filter:/.*/,namespace:key},()=>({contents:'export const getSupabaseAdminClient=()=>globalThis['+JSON.stringify(key)+'].service',loader:'js'}));
    b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:key+'Sdk',namespace:key+'Sdk'}));b.onLoad({filter:/.*/,namespace:key+'Sdk'},()=>({contents:'import {createClient as actual} from '+JSON.stringify(import.meta.resolve('@supabase/supabase-js'))+';export const createClient=(url,key,options)=>actual(url,key,{...options,global:{fetch:globalThis['+JSON.stringify(key)+'].transport}})',loader:'js'}));
    b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))
    b.onResolve({filter:/^file:/},args=>({path:args.path,external:true}))
   }}]})
   const handler=(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
   router[method](path,handler)
  }
  server=createServer(toNodeListener(createApp({debug:false}).use(router)));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
  const call=async(path,{method='GET',actor='owner',body,headers={}}={})=>{
   const response=await fetch(url+path,{method,headers:{...(actor?{authorization:'Bearer '+tokens[actor]}:{}),...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)}:{})});return{response,body:response.headers.get('content-type')?.includes('application/json')?await response.json():new Uint8Array(await response.arrayBuffer())}
  }
  const reset=async(scope,{id=randomUUID(),password=lab.owner.password,actor='owner'}={})=>call('/api/admin-system-reset',{method:'POST',actor,body:{scope,operationId:id,password,confirmation:'RESET '+scope.toUpperCase()}})
  return{lab,db,service,browser,authClient,transport,actors,tokens,url,directory,uploads,call,reset,createActor,close}
 }catch(error){await close();throw error}
}
