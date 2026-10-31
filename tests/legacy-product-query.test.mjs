import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyProductQueryIntent as intent, resolveLegacyProductQuery as resolve } from '../server/utils/legacyProductQuery.js'
const published = async slug => ({ slug, is_published: true })
for (const path of ['/', '/index.php', '/ar', '/ar/', '/ar/index.php']) test(`permanent exact destination: ${path}`, async () => {
 const i = intent(path+'?product=mouse-one&utm_source=old&redirect=https://evil.invalid')
 assert.deepEqual(await resolve(i,published),{status:301,location:(path.startsWith('/ar')?'/ar':'')+'/products/mouse-one'})
 assert.equal(intent((await resolve(i,published)).location),null)
})
for(const path of ['/', '/?p=3546','/?post_type=product&p=3546','/checkout?product=mouse','/api/products?product=mouse','/products/mouse?product=other','//evil.invalid/?product=mouse'])test(`preserve unrelated routing: ${path}`,()=>assert.equal(intent(path),null))
for(const query of ['product=','product=3546&post_type=page','product=one&product=two','product=one&p=3546','product=one&page_id=3','product=one&post_type=product&post_type=page','product=https://evil.invalid','product=%2Fmouse','product=..','product=%252Fmouse','product=one%0A','product='+('a'.repeat(201))])test(`reject ambiguous or unsafe query: ${query.slice(0,80)}`,async()=>{let calls=0;assert.deepEqual(await resolve(intent('/?'+query),async()=>{calls++;return null}),{status:404});assert.equal(calls,0)})
test('published product query with explicit type and HEAD',async()=>assert.equal((await resolve(intent('/?post_type=product&product=mouse-one','HEAD'),published)).status,301))
for(const method of ['POST','PUT','PATCH','DELETE'])test(`no interception of ${method}`,()=>assert.equal(intent('/?product=one',method),null))
for(const data of [null,{slug:'one',is_published:false},{slug:'other',is_published:true},{slug:'one',is_published:1}])test('missing, unpublished and wrong identities never redirect',async()=>assert.deepEqual(await resolve(intent('/?product=one'),async()=>data),{status:404}))
test('query slug is not reinterpreted as WordPress numeric ID',async()=>{let seen;await resolve(intent('/?product=3546'),async slug=>{seen=slug;return null});assert.equal(seen,'3546')})
test('catalog failure never turns into a homepage or successful response',async()=>assert.rejects(resolve(intent('/?product=one'),async()=>{throw Error('unavailable')}),/unavailable/))
test('arbitrary store deployment remains portable',async()=>assert.deepEqual(await resolve(intent('/ar/?product=cedar-widget'),published),{status:301,location:'/ar/products/cedar-widget'}))
