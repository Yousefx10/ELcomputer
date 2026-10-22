// Built Nuxt application + real PostgreSQL/PostgREST in an owned loopback fixture.
// Catalog/media input is a read-only snapshot. Never accepts a hosted DB target.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,realpath,copyFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {reviewProductDashboard} from './lib/premium-product-dashboard-browser.mjs'
import {createCatalogRestFixture} from '../tests/helpers/catalogRestFixture.mjs'
const base=resolve('.'),dir=process.env.PDP_REVIEW_ARTIFACTS,input=process.env.PDP_REVIEW_CATALOG
assert.ok(dir&&input&&process.env.PDP_REVIEW_PLAYWRIGHT,'Explicit owned evidence/catalog/tool paths required')
await mkdir(dir,{recursive:true,mode:0o700});await mkdir(join(dir,'uploads'),{recursive:true})
const catalog=JSON.parse(await readFile(join(input,'catalog.json'),'utf8')),assets=JSON.parse(await readFile(join(input,'assets.json'),'utf8'))
const {chromium}=await import(pathToFileURL(process.env.PDP_REVIEW_PLAYWRIGHT).href)
const f=await createCatalogRestFixture({afterCatalog:async db=>{for(const name of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await db.exec(await readFile(join('supabase/migrations',name),'utf8'))}})
let proxy,nuxt,browser,serverLogs=''
const stop=async child=>{if(child&&child.exitCode===null&&child.signalCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await ended}}
const checks=[],errors=[],external=[],restFailures=[]
const check=(value,label)=>{assert.ok(value,label);checks.push(label)}
try{
 const columns=new Map()
 const insert=async(table,row)=>{
  if(!columns.has(table))columns.set(table,new Set((await f.db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER'",[table])).rows.map(r=>r.column_name)))
  const entries=Object.entries(row).filter(([key,value])=>columns.get(table).has(key)&&value!==undefined)
  await f.db.query(`insert into public.${table}(${entries.map(([k])=>'"'+k+'"').join(',')}) values(${entries.map((_,i)=>'$'+(i+1)).join(',')}) on conflict(id) do nothing`,entries.map(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)?JSON.stringify(v):v))
 }
 // Mirror existing authored public records only. Replication mode is fixture seed
 // setup, never used for editor requests, tests of writes, or production.
 await f.db.exec('set session_replication_role=replica; delete from public.specification_definitions')
 for(const [key,table]of [['categories','categories'],['brands','brands'],['definitions','specification_definitions']])for(const row of catalog[key])await insert(table,row)
 for(const row of catalog.products)await insert('products',{...row,primary_warehouse_id:f.warehouse,stock_quantity:0})
 for(const row of catalog.variants)await insert('product_variants',{...row,stock_quantity:0})
 for(const [key,table]of [['images','product_images'],['specifications','product_specifications'],['features','product_features']])for(const row of catalog[key])await insert(table,row)
 await f.db.exec('set session_replication_role=origin')
 await f.db.exec("delete from public.site_settings; grant select on public.site_offer_cards to authenticated,anon; grant select on public.product_reviews,public.customer_profiles,public.admin_users to service_role")
 await f.db.query("insert into public.site_settings(key,site_name,product_page_style,footer_style,copyright_text) values('default','Catalog review','premium','modern','Catalog review')")
 for(const [url,asset]of Object.entries(assets))if(url.startsWith('/uploads/')){const destination=join(dir,url.slice(1));await mkdir(resolve(destination,'..'),{recursive:true});await copyFile(join(input,asset.file),destination)}
 const actorTokens=Object.fromEntries(Object.keys(f.actors).map(name=>[name,f.token(name)]))
 const isolated=[]
 for(const kind of ['no-media','rich','coming-soon','preorder']){
  const id=randomUUID(),row={id,title:'Owned '+kind+' validation fixture',slug:'owned-'+kind+'-'+id,description:'Owned browser validation only.',price:125.5,old_price:150,primary_warehouse_id:f.warehouse,is_serialized:true,stock_quantity:0,is_published:true,image_url:kind==='no-media'?null:catalog.products.find(p=>p.id===catalog.selection.mouse).image_url,...(kind==='coming-soon'?{selling_mode:'coming_soon'}:{}),...(kind==='preorder'?{selling_mode:'preorder',preorder_active:false,preorder_payment_mode:'full'}:{})};await insert('products',row);catalog.products.push(row);isolated.push({kind,id})
  if(kind==='rich'){
   for(const [index,label,value]of [[0,'Fixture model','Owned fixture'],[1,'Fixture attribute A','Value A'],[2,'Fixture attribute B','Value B'],[3,'Box contents','Owned sample\nOwned cable']])await insert('product_specifications',{id:randomUUID(),product_id:id,label,value,sort_order:index,is_highlight:true})
   await insert('product_features',{id:randomUUID(),product_id:id,body:'Owned feature validation only.',sort_order:0})
  }
 }
 const tokenUsers=new Map(Object.keys(f.actors).map(name=>[actorTokens[name],{id:f.actors[name],email:name+'@catalog.example.invalid',aud:'authenticated',role:'authenticated'}]))
 proxy=createServer(async(req,res)=>{
  res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('access-control-allow-methods','GET,HEAD,OPTIONS,POST,PATCH,PUT,DELETE');res.setHeader('access-control-expose-headers','content-range')
  if(req.method==='OPTIONS'){res.writeHead(204).end();return}
  if(req.url==='/auth/v1/user'){const user=tokenUsers.get(req.headers.authorization?.slice(7));res.writeHead(user?200:401,{'content-type':'application/json'}).end(JSON.stringify(user||{message:'Fixture session required'}));return}
  if(!req.url.startsWith('/rest/v1/')){res.writeHead(404).end();return}
  try{
   const chunks=[];for await(const c of req)chunks.push(c)
   const body=Buffer.concat(chunks),headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length']
   const response=await fetch(f.url+req.url.slice('/rest/v1'.length),{method:req.method,headers,...(body.length?{body}:{}),signal:AbortSignal.timeout(15000)})
   const bytes=Buffer.from(await response.arrayBuffer());if(!response.ok)restFailures.push({path:req.url.split('?')[0],status:response.status,body:bytes.toString().slice(0,500)})
   res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','content-length','transfer-encoding','connection'].includes(key)))).end(bytes)
  }catch(error){res.writeHead(500).end(error.message)}
 })
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));const api='http://127.0.0.1:'+proxy.address().port
 const portProbe=createServer();await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));const origin='http://127.0.0.1:'+port
 const runtime={NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_PUBLIC_SUPABASE_URL:api,NUXT_PUBLIC_SUPABASE_KEY:f.token('anon'),NUXT_SUPABASE_SERVICE_ROLE_KEY:f.token('service'),NUXT_PUBLIC_SITE_URL:'https://merchant.example',NUXT_UPLOADS_DIR:await realpath(join(dir,'uploads')),NUXT_PACKING_VIDEO_PROBE_PATH:'/usr/local/bin/ffprobe',NUXT_PUBLIC_PURCHASING_ENABLED:'false'}
 nuxt=spawn(process.execPath,[join(base,'.output/server/index.mjs')],{env:{PATH:process.env.PATH,...runtime},stdio:['ignore','pipe','pipe']});nuxt.stdout.on('data',c=>{serverLogs+=c});nuxt.stderr.on('data',c=>{serverLogs+=c})
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/storefront/product-appearance')).ok)break}catch{}if(nuxt.exitCode!==null)throw Error('Built server exited: '+serverLogs);await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking']})
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'})
 await context.route('**/*',async route=>{
  const url=route.request().url(),parsed=new URL(url),asset=assets[url]||assets[parsed.pathname]
  if(asset){await route.fulfill({status:200,contentType:asset.contentType,body:await readFile(join(input,asset.file))});return}
  if([origin,api].includes(parsed.origin)){await route.continue();return}
  external.push(parsed.origin+parsed.pathname);await route.abort()
 })
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&/hydration/i.test(m.text()))errors.push(m.text())})
 const goto=async(id,{locale='en',theme='light',width=1440}={})=>{
  await context.addCookies([{name:'elcomputer-color-mode',value:theme,domain:'127.0.0.1',path:'/'}]);await page.setViewportSize({width,height:1100});await page.emulateMedia({colorScheme:theme==='system'?'dark':theme});const product=catalog.products.find(p=>p.id===id)
  const response=await page.goto(origin+(locale==='ar'?'/ar':'')+'/products/'+product.slug,{waitUntil:'domcontentloaded'});check(response.status()===200,'Product SSR 200 '+locale+'/'+width+'/'+theme)
  await page.locator('#main-content h1').first().waitFor({timeout:15000});await page.waitForFunction(()=>document.querySelector('#__nuxt').__vue_app__?.config.globalProperties.$nuxt?.isHydrating===false);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.pdp-gallery-stage img')].every(img=>img.complete));return response
 }
 const screenshot=async name=>{await page.screenshot({path:join(dir,name+'-viewport.png')});for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=850){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(50)}await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(120);await page.screenshot({path:join(dir,name+'.png'),fullPage:true})}
 const mouse=catalog.selection.mouse,keyboard=catalog.selection.keyboard
 await goto(keyboard);await screenshot('first-keyboard-en-desktop')
 check(await page.locator('h1').innerText()===catalog.products.find(p=>p.id===keyboard).title,'Authored product heading')
 check(await page.locator('.pdp-gallery-stage img').evaluate(img=>img.complete&&img.naturalWidth>0),'Real gallery image loads')
 check(await page.locator('.pdp-purchase-action').isDisabled(),'Production hold presentation is disabled')
 const thumb=page.locator('.pdp-thumbnails button');if(await thumb.count()>1){await thumb.first().focus();await page.keyboard.press('ArrowRight');check(await thumb.nth(1).getAttribute('aria-current')==='true','Keyboard thumbnail selection');await page.locator('.pdp-gallery-open').click();await page.locator('dialog[open]').waitFor();check(await page.evaluate(()=>document.body.style.overflow==='hidden'),'Modal locks background scroll');await page.keyboard.press('Tab');check(await page.evaluate(()=>!!document.activeElement.closest('dialog')),'Dialog keyboard focus stays inside');await page.keyboard.press('+');check(await page.locator('.pdp-dialog-stage').getAttribute('data-zoomed')==='true','Keyboard zoom');await page.keyboard.press('Escape');check(await page.locator('dialog').count()===0,'Escape closes gallery');check(await page.locator('.pdp-gallery-open').evaluate(el=>el===document.activeElement),'Gallery returns focus')}
 for(const locale of ['en','ar'])for(const width of [1440,1024,768,390,320])for(const theme of ['light','dark']){
  await goto(keyboard,{locale,width,theme});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),locale+'/'+width+'/'+theme+' no horizontal overflow');check(await page.locator('html').getAttribute('dir')===(locale==='ar'?'rtl':'ltr'),locale+' document direction');check(await page.locator('.pdp-purchase-action').isDisabled(),'Held purchasing remains disabled');await screenshot('keyboard-'+locale+'-'+width+'-'+theme)
 }
 await goto(mouse,{theme:'system'});check(await page.locator('html').evaluate(el=>el.classList.contains('dark')),'System dark mode');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));check(true,'System preference follows OS changes');await screenshot('mouse-en-system-light')
 for(const [name,id]of Object.entries(catalog.selection)){await goto(id);await screenshot('catalog-'+name+'-desktop');await goto(id,{width:390,locale:'ar',theme:'dark'});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' Arabic mobile no overflow');await screenshot('catalog-'+name+'-ar-mobile-dark')}
 for(const {kind,id}of isolated)for(const locale of ['en','ar'])for(const width of [1440,390]){await goto(id,{locale,width,theme:locale==='ar'?'dark':'light'});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Isolated '+kind+'/'+locale+'/'+width+' no overflow');if(kind==='no-media')check(await page.locator('.pdp-gallery-empty').isVisible(),'Missing media has an honest local fallback');if(kind==='rich'){check(await page.locator('.pdp-highlights > div').count()===4,'Authored highlights render');check(await page.locator('#pdp-included').isVisible(),'Explicit box contents render without inference');check(await page.locator('.pdp-feature-list').isVisible(),'Existing authored feature model renders')}if(kind==='coming-soon')check(await page.locator('.pdp-purchase-action').count()===0,'Coming-soon item has no misleading purchase action');if(kind==='preorder')check(await page.locator('.pdp-purchase-action').isDisabled(),'Inactive preorder remains unavailable');await screenshot('isolated-'+kind+'-'+locale+'-'+width)}
 const seo=()=>page.evaluate(()=>({title:document.title,canonical:document.querySelector('link[rel=canonical]')?.href,alternates:[...document.querySelectorAll('link[hreflang]')].map(el=>[el.hreflang,el.href]).sort(),schemas:[...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(el=>JSON.parse(el.textContent))}))
 const premiumSeo={};for(const locale of ['en','ar']){await goto(mouse,{locale});premiumSeo[locale]=await seo()}
 await goto(catalog.selection.variations);const options=page.locator('.pdp-variant-options [role=radio]');check(await options.count()===2,'Real multi-option product renders only its configured variants');await options.first().click();check(await options.first().getAttribute('aria-checked')==='true','Real option selects shared variant state');const firstPhoto=await page.locator('.pdp-gallery-stage img').getAttribute('src');await options.first().focus();await page.keyboard.press('ArrowRight');check(await options.nth(1).getAttribute('aria-checked')==='true','Keyboard selects genuine next option');const awaitPhoto=await page.locator('.pdp-gallery-stage img').getAttribute('src');check(catalog.images.some(i=>i.variant_id===catalog.variants.filter(v=>v.product_id===catalog.selection.variations).sort((a,b)=>a.name.localeCompare(b.name))[1].id&&i.image_url===awaitPhoto),'Variant chooses its assigned gallery');check(await page.locator('.pdp-purchase-action').isDisabled(),'Variant selection cannot bypass purchase hold')
 await goto(keyboard,{width:390});const stage=page.locator('.pdp-gallery-stage'),beforeSwipe=await stage.locator('img').getAttribute('src');await stage.dispatchEvent('pointerdown',{clientX:280,clientY:180,pointerId:1,pointerType:'touch',isPrimary:true});await stage.dispatchEvent('pointerup',{clientX:150,clientY:185,pointerId:1,pointerType:'touch',isPrimary:true});check(await stage.locator('img').getAttribute('src')!==beforeSwipe,'Mobile swipe navigates gallery');await page.locator('.pdp-gallery-open').dispatchEvent('click',{detail:1});check(await page.locator('dialog').count()===0,'Swipe does not accidentally open fullscreen')
 const appearance=await fetch(origin+'/api/storefront/product-appearance');check(appearance.headers.get('cache-control')==='no-store','SSR style endpoint never cached')
 await f.db.exec("update public.site_settings set product_page_style='classic'")
 for(const locale of ['en','ar'])for(const width of [1440,900,390])for(const theme of ['light','dark']){await goto(mouse,{locale,width,theme});check(await page.locator('.product-premium').count()===0,'Classic remains selected '+locale+'/'+width+'/'+theme);assert.deepEqual(await seo(),premiumSeo[locale]);checks.push('Classic/Premium SEO, canonical, hreflang and JSON-LD parity '+locale+'/'+width+'/'+theme);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Classic responsive no overflow');await screenshot('classic-mouse-'+locale+'-'+width+'-'+theme)}
 await f.db.exec("update public.site_settings set product_page_style='premium'")
 await reviewProductDashboard({f,dir,browser,origin,api,catalog,actorTokens,checks})
 // Availability/quantity/cart are exercised only on the pre-existing owned
 // legacy fixture. This loopback-only runtime has no checkout/provider access.
 await stop(nuxt);runtime.NUXT_PUBLIC_PURCHASING_ENABLED='true';nuxt=spawn(process.execPath,[join(base,'.output/server/index.mjs')],{env:{PATH:process.env.PATH,...runtime},stdio:['ignore','pipe','pipe']});nuxt.stdout.on('data',c=>{serverLogs+=c});nuxt.stderr.on('data',c=>{serverLogs+=c})
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/storefront/product-appearance')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const available=(await f.db.query('select * from public.storefront_products where id=$1',[f.published])).rows[0];catalog.products.push(available);await goto(available.id,{width:390});check(await page.locator('.pdp-purchase-action').isEnabled(),'Owned permitted purchase uses shared eligibility');const plus=page.locator('.pdp-quantity button').last();for(let i=1;i<8;i++)await plus.click();check(await plus.isDisabled(),'Quantity stops at authoritative stock');check(await page.locator('.pdp-quantity output').innerText()==='8','Quantity cannot exceed owned available stock');await page.locator('.pdp-purchase-action').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('elcomputer-cart')||'[]').length===1);const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('elcomputer-cart')));check(cart[0].id===available.id&&cart[0].quantity===8&&cart[0].price===Number(available.price),'Shared cart receives original product, bounded quantity and authoritative price');await screenshot('isolated-permitted-cart-mobile')
 check(errors.length===0,'No browser runtime or hydration errors')
 await writeFile(join(dir,'browser-report.json'),JSON.stringify({scope:'Owned native PostgreSQL/PostgREST + built Nuxt. Synthetic Auth. Real read-only published catalog snapshot. No production writes/provider requests.',checks,errors,external,restFailures,products:catalog.selection,isolated_fixtures:isolated},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors,external:external.length,restFailures},null,2))
}finally{await writeFile(join(dir,'server.log'),serverLogs);await writeFile(join(dir,'browser-errors.json'),JSON.stringify({errors,external,restFailures},null,2));await browser?.close();await stop(nuxt);if(proxy)await new Promise(resolve=>proxy.close(resolve));await f.close()}
