import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {heroLayoutMode,selectedHeroBanners,normalizeHeroPresentation,heroDesktopSize,HERO_PHONE_SIZE} from '../app/utils/heroLayout.js'
import {getStoreCategoryArt} from '../app/utils/storefront.js'
import {readFileSync} from 'node:fs'
import {appendCatalogPage,catalogCacheKey} from '../app/utils/catalogContinuation.js'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'

test('existing hero mode, explicit static selection, disabled images and bounded authored inputs',()=>{
 const content={settings:{},heroBanners:[{id:'a',image_url:'/uploads/hero.png'},{id:'b',image_url:'/uploads/other.png'},{id:'c',image_url:'/uploads/off.png',is_enabled:false}]}
 assert.equal(heroLayoutMode(undefined),'both');assert.deepEqual(selectedHeroBanners(content).map(x=>x.id),['a','b'])
 content.settings={hero_layout_mode:'banner',hero_static_banner_id:'b'};assert.deepEqual(selectedHeroBanners(content).map(x=>x.id),['b'])
 content.heroBanners[1].is_enabled=false;assert.deepEqual(selectedHeroBanners(content).map(x=>x.id),['a'])
 const p=normalizeHeroPresentation({title_en:'x'.repeat(500),focal_x:-1,mobile_focal_y:200,fit:'script',mobile_image_url:23})
 assert.equal(p.title_en.length,120);assert.equal(p.focal_x,0);assert.equal(p.mobile_focal_y,100);assert.equal(p.fit,'cover');assert.equal(p.mobile_image_url,'')
})
test('banners fill their shape, and each listed size matches the storefront shape',()=>{
 assert.equal(normalizeHeroPresentation({}).fit,'cover');assert.equal(normalizeHeroPresentation({}).mobile_fit,'cover');assert.equal(normalizeHeroPresentation({fit:'contain'}).fit,'contain')
 assert.deepEqual(heroDesktopSize('both'),[1600,720]);assert.deepEqual(heroDesktopSize('banner'),[1920,600]);assert.deepEqual(heroDesktopSize('carousel'),[1920,600]);assert.deepEqual(HERO_PHONE_SIZE,[1080,1080])
 const css=readFileSync('app/assets/css/storefront.css','utf8')
 assert.match(css,/\.store-hero-picture \{[^}]*aspect-ratio: 20 \/ 9;/);assert.match(css,/store-hero-grid-single \.store-hero-picture \{ aspect-ratio: 16 \/ 5; \}/);assert.match(css,/store-hero-phone \.store-hero-picture \{ aspect-ratio: 1 \/ 1; \}/)
 assert.equal(1600/720,20/9);assert.equal(1920/600,16/5)
})
test('category tiles use an uploaded image or a generic transparent picture, never a product photo',()=>{
 const expected={Keyboards:'keyboard',Mouse:'mouse','Mouse Pad':'mouse-pad',Headsets:'headset',Controllers:'controller',webcams:'webcam',Microphones:'microphone',Accessories:'accessories'}
 for(const [name,file] of Object.entries(expected)){
  assert.equal(getStoreCategoryArt(name),'/images/storefront/categories/'+file+'.svg')
  const svg=readFileSync('public/images/storefront/categories/'+file+'.svg','utf8');assert.match(svg,/viewBox="0 0 400 400"/);assert.doesNotMatch(svg,/<rect[^>]*width="400"/)
 }
 assert.equal(getStoreCategoryArt('Gift cards'),'')
 const home=readFileSync('app/pages/index.vue','utf8');assert.match(home,/displayImageUrl: getStoreImageUrl\(category\.image_url\) \|\| getStoreCategoryArt\(category\.name\)/)
})
test('continuation retains query identity, deduplicates products and rejects invalid or unbounded pages',()=>{
 assert.equal(catalogCacheKey('/search',{q:'x',sort:'latest'}),catalogCacheKey('/search',{sort:'latest',q:'x'}))
 assert.notEqual(catalogCacheKey('/search',{q:'x'}),catalogCacheKey('/search',{q:'y'}))
 const a={page:1,pages:3,products:[{id:'a',slug:'a'}]},b={page:2,pages:3,products:[{id:'a',slug:'a'},{id:'b',slug:'b'}]}
 assert.deepEqual(appendCatalogPage(a,b).products.map(x=>x.id),['a','b'])
 for(const value of [{...b,page:1},{...b,products:Array(13).fill({id:'x',slug:'x'})},{...b,pages:1}])assert.throws(()=>appendCatalogPage(a,value))
})
test('schema114 discovery is additive on real schema113; bounded public ranking and saved modes', {skip:!emailNativeAvailable,timeout:120000},async()=>{
 const db=await createEmailNativeDatabase({stopBefore:'20261104140000'}),f=await createProductSaveFixture({database:db})
 try{
  const before=(await db.query("select to_jsonb(s) value from public.site_settings s where key='default'")).rows[0].value
  const funcs=(await db.query("select oid::regprocedure::text signature,pg_get_functiondef(oid) body from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by 1")).rows
  await db.query(await readFile('supabase/migrations/20261104140000_storefront_discovery.sql','utf8'))
  const after=(await db.query("select to_jsonb(s)-array['hero_layout_mode','hero_static_banner_id','catalog_infinite_scroll_enabled'] value from public.site_settings s where key='default'")).rows[0].value
  assert.deepEqual(after,before)
  for(const row of funcs)assert.equal((await db.query('select pg_get_functiondef($1::regprocedure) body',[row.signature])).rows[0].body,row.body)
  for(let n=0;n<27;n++)await db.query("insert into public.products(title,slug,price,is_published,primary_warehouse_id,created_at) values('Synthetic catalog',$1,100,true,$2,'2026-11-01')",['discovery-'+n,f.warehouse])
  const page=async n=>(await db.query("select public.storefront_ranked_catalog_page('Synthetic catalog',null,null,'',null,null,'{}','{}',$1) value",[n])).rows[0].value
  const first=await page(1),second=await page(2);assert.equal(first.ids.length,12);assert.equal(second.ids.length,12);assert.equal(first.count,27);assert.equal(new Set([...first.ids,...second.ids]).size,24);assert.deepEqual(await page(1),first)
  for(const n of [0,10001])await assert.rejects(page(n),/Invalid catalog query/)
  await db.query("set role anon");assert.deepEqual(await page(1),first);await db.query('reset role')
  await db.query("update public.site_settings set hero_layout_mode='banner',catalog_infinite_scroll_enabled=false where key='default'")
  const mode=(await db.query("select hero_layout_mode,catalog_infinite_scroll_enabled from public.site_settings where key='default'")).rows[0];assert.equal(mode.hero_layout_mode,'banner');assert.equal(mode.catalog_infinite_scroll_enabled,false)
  await assert.rejects(db.query("update public.site_settings set hero_layout_mode='other'"),/check constraint/)
 }finally{await db.close()}
})
