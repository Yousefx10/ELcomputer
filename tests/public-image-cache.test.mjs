import {createServer} from 'node:http'
import {build} from 'esbuild'
import {resolve} from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {versionedPublicImageUrl,normalizePublicImageCache} from '../app/utils/publicImageCache.js'
import {createMediaFixture,pngImage} from './helpers/mediaFixture.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('image URL epochs preserve stored sources, external origins and every private API',()=>{
 const source='/uploads/products/file.webp?width=400'
 assert.equal(versionedPublicImageUrl(source,{version:'new'}),source+'&v=new')
 assert.equal(versionedPublicImageUrl(source,{version:'next'}),source+'&v=next')
 for(const path of ['https://another-store.invalid/image.webp','/api/account/transfer-proofs/private','/api/auth/private','/uploads/products/video.mp4'])assert.equal(versionedPublicImageUrl(path,{version:'new'}),path)
 assert.deepEqual(normalizePublicImageCache({enabled:true,maxAge:999999999,version:'../private'}),{enabled:true,maxAge:86400,version:'1'})
})
test('public image HTTP validators, invalidation, disable, downloads and private-path denial',{timeout:60000},async()=>{
 const f=await createMediaFixture({routes:[['get','/api/admin-image-cache','server/api/admin-image-cache/index.get.js']]})
 try{
  await f.addFile('products/cache.png');await f.addFile('private/payment-secret.png')
  const first=await fetch(f.url+'/uploads/products/cache.png'),bytes=Buffer.from(await first.arrayBuffer()),etag=first.headers.get('etag');assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/public, max-age=86400/);assert.ok(etag);assert.ok(first.headers.get('last-modified'));assert.deepEqual(bytes,pngImage())
  const plainHead=await fetch(f.url+'/uploads/products/cache.png',{method:'HEAD'});assert.equal(plainHead.status,200);assert.equal(plainHead.headers.get('etag'),etag);assert.equal(Number(plainHead.headers.get('content-length')),bytes.length);assert.equal((await plainHead.arrayBuffer()).byteLength,0)
  const second=await fetch(f.url+'/uploads/products/cache.png',{headers:{'if-none-match':etag}});assert.equal(second.status,304);assert.equal((await second.arrayBuffer()).byteLength,0)
  const head=await fetch(f.url+'/uploads/products/cache.png',{method:'HEAD',headers:{'if-none-match':etag}});assert.equal(head.status,304);assert.equal((await head.arrayBuffer()).byteLength,0)
  await new Promise(r=>setTimeout(r,5));await f.addFile('products/cache.png',pngImage());const changed=await fetch(f.url+'/uploads/products/cache.png',{headers:{'if-none-match':etag}});assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),etag);await changed.body.cancel()
  const download=await fetch(f.url+'/uploads/products/cache.png?download=1',{headers:{'if-none-match':changed.headers.get('etag')}});assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');await download.body.cancel()
  for(const path of ['/uploads/private/payment-secret.png','/uploads/customer-attachments/private.png','/uploads/unknown/path.png'])for(const method of ['GET','HEAD']){const denied=await fetch(f.url+path,{method});assert.equal(denied.status,404);assert.equal(denied.headers.get('cache-control'),'no-store');assert.equal(denied.headers.get('etag'),null);assert.ok(!(await denied.text()).includes('payment-secret content'))}
  const diagnostic=await f.call('/api/admin-image-cache');assert.equal(diagnostic.response.status,200);assert.equal(diagnostic.response.headers.get('cache-control'),'private, no-store');assert.equal(diagnostic.body.serverTransformationCache,false);assert.equal(diagnostic.body.browserStorageLimit,null)
  for(const actor of [null,'customer','editor','disabled'])assert.ok([401,403].includes((await f.call('/api/admin-image-cache',{actor})).response.status))
  // Nested hero mobile images remain protected by the existing whole-row guard.
  const banner=(await f.db.query("insert into public.site_hero_banners(image_url,presentation) values('/uploads/products/other.png',$1) returning id",[JSON.stringify({mobile_image_url:'/uploads/products/cache.png'})])).rows[0].id
  assert.equal((await f.call('/api/admin-gallery',{method:'DELETE',body:{path:'/uploads/products/cache.png'}})).response.status,409)
  await f.db.query('delete from public.site_hero_banners where id=$1',[banner])
  await f.db.query("update public.site_settings set public_image_cache='{\"enabled\":false,\"maxAge\":0,\"version\":\"off\"}' where key='default'")
  await new Promise(r=>setTimeout(r,15100));const disabled=await fetch(f.url+'/uploads/products/cache.png',{headers:{'if-none-match':changed.headers.get('etag')}});assert.equal(disabled.status,200);assert.equal(disabled.headers.get('cache-control'),'no-store');await disabled.body.cancel()
  if(process.env.PAYMENT_REVIEW_ARTIFACTS)await mkdir(process.env.PAYMENT_REVIEW_ARTIFACTS,{recursive:true});
  if(process.env.PAYMENT_REVIEW_ARTIFACTS)await writeFile(process.env.PAYMENT_REVIEW_ARTIFACTS+'/image-cache-network.json',JSON.stringify({first:{status:200,body_bytes:bytes.length},conditional:{status:304,body_bytes:0},private_denials:3,scope:'isolated local image route',hosted_improvement_measured:false},null,2))
 }finally{await f.close()}
})
test('cache schema is additive, preserves settings and rolls back locally',{skip:!emailNativeAvailable,timeout:60000},async()=>{
 const db=await createEmailNativeDatabase({stopBefore:'20261104142000'})
 try{
  const before=(await db.query('select to_jsonb(s) value from public.site_settings s')).rows
  await db.query('begin');await db.query((await readFile('supabase/migrations/20261105150000_public_image_cache.sql','utf8')).replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,''))
  assert.deepEqual((await db.query("select to_jsonb(s)-'public_image_cache' value from public.site_settings s")).rows,before)
  await db.query('rollback');assert.deepEqual((await db.query('select to_jsonb(s) value from public.site_settings s')).rows,before)
 }finally{await db.close()}
})

test('a stalled settings read is aborted and its disabled fallback prevents repeated database waits',{timeout:10000},async()=>{
 const server=createServer(()=>{});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
 const key='__imageTimeout'+Date.now();let calls=0
 const query={select(){return this},eq(){return this},abortSignal(signal){this.signal=signal;return this},async maybeSingle(){calls++;await fetch(origin,{signal:this.signal});throw Error('No response expected')}}
 globalThis[key]={from:()=>query}
 try{
  const output=await build({entryPoints:[resolve('server/utils/publicImageCache.js')],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'timeout',setup(b){b.onResolve({filter:/\/supabaseAdmin$/},()=>({path:'stub',namespace:'timeout'}));b.onLoad({filter:/.*/,namespace:'timeout'},()=>({contents:'export const getSupabaseAdminClient=()=>globalThis['+JSON.stringify(key)+']',loader:'js'}))}}]})
  const {publicImageCacheSettings}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64')),start=performance.now()
  assert.equal((await publicImageCacheSettings()).enabled,false);assert.ok(performance.now()-start<3000);assert.equal(calls,1)
  assert.equal((await publicImageCacheSettings()).enabled,false);assert.equal(calls,1)
 }finally{delete globalThis[key];server.closeAllConnections();await new Promise(r=>server.close(r))}
})
