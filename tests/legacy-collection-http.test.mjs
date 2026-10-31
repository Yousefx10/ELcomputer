import test from 'node:test'
import assert from 'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createServer}from'node:http'
import{createApp,toNodeListener,createError,defineEventHandler,sendRedirect,setHeader,getRequestURL}from'h3'
import{legacyCollectionIntent,resolveLegacyCollection}from'../server/utils/legacyCollection.js'
const raw=(await readFile(new URL('../server/middleware/legacyCollection.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export default','return')
test('actual server handler, canonical origin, preserved pages, failures and untouched payment routes',async()=>{
 let origin,reads=0
 const count=async(event,q)=>{assert.ok(event.context.legacyCollectionSignal instanceof AbortSignal);reads++;if(q.category==='unavailable')throw createError({statusCode:503,statusMessage:'Public content is unavailable.'});return q.category==='missing'?0:30}
 const handler=new Function('createError','defineEventHandler','sendRedirect','setHeader','getRequestURL','legacyCollectionIntent','resolveLegacyCollection','legacyCollectionCount','legacyCollectionOrigin',raw)(createError,defineEventHandler,sendRedirect,setHeader,getRequestURL,legacyCollectionIntent,resolveLegacyCollection,count,async()=>origin)
 const app=createApp();app.use(handler);app.use(defineEventHandler(()=> 'EXISTING_ROUTE'));const server=createServer(toNodeListener(app));await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port
 try{
  for(const[path,status,location]of[['/product-category/keyboards/',301,'/search?category=keyboards'],['/ar/product-category/keyboards/page/2/?orderby=price',301,'/ar/search?category=keyboards&sort=price-asc&page=2'],['/shop/',301,'/shop'],['/shop/page/2/',301,'/shop?page=2'],['/shop',200,null],['/ar/shop?page=2',200,null],['/shop/page/9/',404,null],['/product-category/missing/',404,null],['/product-category/unavailable/',503,null],['/shop/?page=2&page=1',404,null],['/contact/',301,'/contact'],['/ar/request-refund/',301,'/ar/request-refund'],['/api/checkout',200,null],['/account/orders',200,null],['/?p=3546',200,null],['/?product=old-product',200,null]]){
   const response=await fetch(origin+path,{redirect:'manual',headers:{accept:'application/json'}});assert.equal(response.status,status,path);assert.equal(response.headers.get('location'),location?origin+location:null,path);if(status>=400)assert.equal(response.headers.get('x-robots-tag'),'noindex,follow');await response.body?.cancel()
  }
  const head=await fetch(origin+'/product-category/keyboards/',{method:'HEAD',redirect:'manual'});assert.equal(head.status,301);assert.equal(await head.text(),'')
  const post=await fetch(origin+'/shop/',{method:'POST',body:'{}',redirect:'manual'});assert.equal(post.status,200);assert.equal(await post.text(),'EXISTING_ROUTE');assert.ok(reads>0)
 }finally{await new Promise(r=>server.close(r))}
})
