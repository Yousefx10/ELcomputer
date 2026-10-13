import { randomUUID } from 'node:crypto'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, mkdir, writeFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp, createRouter, toNodeListener } from 'h3'
import { build } from 'esbuild'
import { deflateSync } from 'node:zlib'
import { createProductSaveFixture } from './productSaveFixture.mjs'

export const mediaMigration='20261013140000_media_reference_safety.sql'
export const pngImage = () => {
  const crc = bytes => {let v=0xffffffff;for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0)}return(v^0xffffffff)>>>0}
  const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b}
  const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,0,100,255,255]))),chunk('IEND',Buffer.alloc(0))])
}
// Actual media routes, authorization, filesystem and SQL. Hosted Auth and
// Supabase transport are fixtures; the root and database are newly owned.
export async function createMediaFixture(options={}) {
  const f=options.fixture || await createProductSaveFixture(options), root=await realpath(await mkdtemp(join(tmpdir(),'elcomputer-media-')))
  const key='__mediaFixture'+randomUUID().replaceAll('-','')
  f.client.auth={getUser:async token=>({data:{user:f.actors[token]?{id:f.actors[token]}:null},error:null})}
  globalThis[key]={client:f.client,root}
  globalThis.defineEventHandler=h=>h
  let server
  const close=async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}delete globalThis[key];if(!options.fixture)await f.db.close();await rm(root,{recursive:true,force:true})}
  const router=createRouter()
  try {
    for(const[method,path,file]of[
      ['post','/api/admin-uploads','server/api/admin-uploads/index.post.js'],['get','/api/admin-gallery','server/api/admin-gallery/index.get.js'],['delete','/api/admin-gallery','server/api/admin-gallery/index.delete.js'],['get','/uploads/**','server/routes/uploads/[...path].get.js']]){
      const result=await build({entryPoints:[resolve(file)],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:key,setup(b){
        b.onResolve({filter:/\/supabaseAdmin$/},()=>({path:key,namespace:key}));b.onLoad({filter:/.*/,namespace:key},()=>({contents:`export const getSupabaseAdminClient=()=>globalThis[${JSON.stringify(key)}].client`,loader:'js'}));b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))
      }}],banner:{js:`const useRuntimeConfig=()=>({uploadsDir:globalThis[${JSON.stringify(key)}].root});`}})
      const handler=(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default
      router[method](path,event=>{if(path.startsWith('/uploads/'))event.context.params.path=event.context.params._;return handler(event)})
    }
    server=createServer(toNodeListener(createApp({debug:false}).use(router)))
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
    const call=async(path,{actor='owner',method='GET',body}={})=>{
      const response=await fetch(url+path,{method,headers:{...(actor?{authorization:'Bearer '+actor}:{}),...(body&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})})
      const content=await response.text();return{response,body:response.headers.get('content-type')?.includes('application/json')?JSON.parse(content):content}
    }
    const addFile=async(path,bytes=pngImage())=>{await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),bytes)}
    const upload=(bytes=pngImage(),type='image/png',section='products',actor='editor',filename='image.png')=>{const form=new FormData();form.append('section',section);form.append('file',new Blob([bytes],{type}),filename);return call('/api/admin-uploads',{actor,method:'POST',body:form})}
    return{...f,root,url,call,upload,addFile,close}
  }catch(error){await close();throw error}
}
