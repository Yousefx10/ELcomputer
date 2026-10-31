import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp, toNodeListener, createError, defineEventHandler, sendRedirect, setHeader } from 'h3'
import { legacyProductQueryIntent, resolveLegacyProductQuery } from '../server/utils/legacyProductQuery.js'
const raw = (await readFile(new URL('../server/middleware/legacyProductQuery.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export default','return')
const calls=[]
function publicSeoClient(){return {client:{from(table){assert.equal(table,'products');const filters=[];return {select(fields){assert.equal(fields,'slug,is_published');return this},eq(k,v){filters.push([k,v]);return this},abortSignal(s){assert.ok(s instanceof AbortSignal);return this},async maybeSingle(){assert.deepEqual(filters[1],['is_published',true]);const slug=filters[0][1];calls.push(slug);return slug==='unavailable'?{error:{message:'PRIVATE_DATABASE_DIAGNOSTIC'}}:{data:slug==='mouse-one'?{slug,is_published:true}:null}}}}}}}
const handler=new Function('createError','defineEventHandler','sendRedirect','setHeader','publicSeoClient','legacyProductQueryIntent','resolveLegacyProductQuery',raw)(createError,defineEventHandler,sendRedirect,setHeader,publicSeoClient,legacyProductQueryIntent,resolveLegacyProductQuery)
test('actual middleware HTTP statuses, ownership-free public projection, locale and errors',async()=>{
 const app=createApp();app.use(handler);app.use(defineEventHandler(()=> 'UNCHANGED_ROUTE'));const server=createServer(toNodeListener(app));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
 try{
  for(const[path,status,location] of [['/?product=mouse-one',301,'/products/mouse-one'],['/ar/?product=mouse-one&utm_source=old',301,'/ar/products/mouse-one'],['/index.php?post_type=product&product=mouse-one',301,'/products/mouse-one'],['/?product=missing',404,null],['/?product=one&product=two',404,null],['/?product=unavailable',503,null],['/checkout?product=mouse-one',200,null],['/?p=3546',200,null],['/products/mouse-one',200,null]]){
   const r=await fetch(origin+path,{redirect:'manual'});assert.equal(r.status,status,path);assert.equal(r.headers.get('location'),location,path);const body=await r.text();assert.ok(!body.includes('PRIVATE_DATABASE_DIAGNOSTIC'));if(status>=400)assert.equal(r.headers.get('x-robots-tag'),'noindex,follow')
  }
  const h=await fetch(origin+'/?product=mouse-one',{method:'HEAD',redirect:'manual'});assert.equal(h.status,301);assert.equal(await h.text(),'')
  assert.deepEqual(calls,['mouse-one','mouse-one','mouse-one','missing','unavailable','mouse-one'])
 }finally{await new Promise(r=>server.close(r))}
})
