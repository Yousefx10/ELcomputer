import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp,createRouter,toNodeListener } from 'h3'
import { createEmailFixture } from './emailFixture.mjs'
export const createEmailHttpFixture=async()=>{
 const f=await createEmailFixture(),key='emailFixture_'+randomUUID().replaceAll('-',''),providerCalls=[]
 globalThis[key]={client:f.client,calls:providerCalls};globalThis.defineEventHandler=fn=>fn
 const router=createRouter(),routes=[]
 const register=async file=>{
  const match=/\.(get|post|patch)\.js$/.exec(file);if(!match)return
  const route='/'+file.replace(/^server\//,'').replace(/\.(get|post|patch)\.js$/,'')
  const compiled=await build({entryPoints:[resolve(file)],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'isolated-email-provider-and-database',setup(builder){
   builder.onResolve({filter:/\/supabaseAdmin(?:\.js)?$/},()=>({path:'db',namespace:'email-fixture'}))
   builder.onLoad({filter:/.*/,namespace:'email-fixture'},()=>({contents:`export const getSupabaseAdminClient=()=>globalThis.${key}.client`,loader:'js',resolveDir:resolve('.')}))
   builder.onResolve({filter:/^\.\/brevo\.js$/},()=>({path:'provider',namespace:'email-provider-fixture'}))
   builder.onLoad({filter:/.*/,namespace:'email-provider-fixture'},()=>({contents:`import{brevoProvider as real,brevoMessageId}from'${resolve('server/utils/email/brevo.js')}';export{brevoMessageId};export const brevoProvider={submit:(s,k,m,b)=>real.submit(s,k,m,b,async(payload,_key,_timeout,before)=>{await before();globalThis.${key}.calls.push(payload);return{status:201,body:JSON.stringify({messageId:'<fixture-'+globalThis.${key}.calls.length+'@email.example.invalid>'})}})}`,loader:'js',resolveDir:resolve('.')}))
   builder.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))
  }}]})
  router[match[1]](route,(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default);routes.push({route,method:match[1].toUpperCase()})
 }
 for(const file of await readdir('server/api/admin-email'))await register('server/api/admin-email/'+file)
 for(const file of ['server/api/webhooks/brevo.post.js','server/api/email/unsubscribe.post.js','server/api/internal/email/process.post.js'])await register(file)
 const app=createApp().use(router)
 return {...f,app,routes,providerCalls,async start(extra=null){if(extra)app.use(extra);const server=createServer(toNodeListener(app));await new Promise(done=>server.listen(0,'127.0.0.1',done));return {server,url:'http://127.0.0.1:'+server.address().port,close:async()=>{await new Promise(done=>server.close(done));delete globalThis[key];await f.db.close()}}}}
}
