// Built Nuxt + actual isolated PostgreSQL/PostgREST. No hosted writes/providers.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createCatalogRestFixture} from '../tests/helpers/catalogRestFixture.mjs'
import {createProductSaveFixture} from '../tests/helpers/productSaveFixture.mjs'
const base=process.cwd(),root=dirname(base),dir=process.env.MODERN_PDP_ARTIFACTS,engine=process.env.REVIEW_ENGINE||'chromium'
const clientNavigation=process.env.REVIEW_CLIENT_NAVIGATION==='1'
assert.ok(dir&&process.env.COD_REVIEW_PLAYWRIGHT)
await mkdir(dir,{recursive:true,mode:0o700});await mkdir(join(dir,'uploads'),{mode:0o700})
const pw=await import(pathToFileURL(process.env.COD_REVIEW_PLAYWRIGHT).href)
const catalog=JSON.parse(await readFile(root+'/public-snapshot/catalog.json')),assets=JSON.parse(await readFile(root+'/public-snapshot/assets.json'))
const rest=await createCatalogRestFixture({afterCatalog:async db=>{
 for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'))
}})
const f=await createProductSaveFixture({database:rest.db}),db=rest.db,checks=[],errors=[],requests=[],blocked=[],apiFailures=[]
let proxy,app,browser,page,logs=''
const stop=async child=>{if(child&&child.exitCode===null&&child.signalCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await ended}}
const check=(value,label)=>{assert.ok(value,label);checks.push(label)}
const readCart=()=>Object.keys(localStorage).filter(k=>k.startsWith('commerce-cart-v3:')).map(k=>JSON.parse(localStorage.getItem(k))).find(v=>v.items.length)?.items||[]
try{
 await db.exec('grant select on public.product_reviews,public.customer_profiles,public.admin_users to service_role;grant select on public.site_offer_cards to anon,authenticated')
 // Match the hosted authenticated lookup grants verified read-only in
 // evidence/hosted-browser-role-grants.json; no hosted grants are changed.
 await db.exec('grant select on public.site_settings,public.commerce_warehouses,public.commerce_crm_accounts,public.customer_profiles to authenticated;grant select on public.site_settings to service_role')
 await db.query("update public.site_settings set site_name='Owned qualification store',product_page_style='premium',product_page_config=null,payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=10,inventory_tracking_required=true,allow_out_of_stock_purchases=false where key='default'")
 const imagePaths=Object.keys(assets).filter(p=>p.startsWith('/uploads/')&&assets[p].contentType?.startsWith('image/'))
 for(const path of imagePaths){const dest=join(dir,path.slice(1));await mkdir(dirname(dest),{recursive:true});await copyFile(root+'/public-snapshot/'+assets[path].file,dest)}
 const image=imagePaths[0],otherImage=imagePaths[1]||image
 assert.ok(image,'Source-backed public image is required')
 const create=async(title,variants,price='125.50')=>{
  const result=await f.save(f.body({title,slug:'owned-'+randomUUID(),price,is_published:true,image_url:image,variants}))
  const snapshot=await f.snapshot(result.id)
  for(const [index,v] of snapshot.variants.entries())await db.query('insert into public.product_images(product_id,variant_id,image_url,sort_order) values($1,$2,$3,$4)',[result.id,v.id,index%2?otherImage:image,index])
  for(const [index,label] of ['Fixture construction','Fixture connection','Fixture width','Fixture height'].entries())await db.query('insert into public.product_specifications(product_id,label,value,sort_order) values($1,$2,$3,$4)',[result.id,label,'Owned test value '+index,index])
  return snapshot
 }
 const option=(name,code,values,price=null)=>({name,code,sku:'OWNED-'+code+'-'+randomUUID(),sale_price:price,option_values:values})
 const simple=await create('Owned simple product',[option('Default','DEFAULT',{})],'100.00')
 const models=await create('Owned model choices',[option('Model A','MODEL_A',{model:'Model A'},'140.50'),option('Model B','MODEL_B',{model:'Model B'},'170.75')])
 const colors=await create('Owned color choices',[
  {...option('Black','BLACK',{color:'Black'}),color_name:'Black',color_hex:'#111111'},
  {...option('White','WHITE',{color:'White'}),color_name:'White',color_hex:'#FFFFFF'}])
 const keyboard=await create('Owned multidimensional keyboard',[
  {...option('Black Red','BLACK_RED',{color:'Black',switch:'Red'},'150.25'),color_name:'Black',color_hex:'#111111'},
  {...option('Black Blue','BLACK_BLUE',{color:'Black',switch:'Blue'},'155.00'),color_name:'Black',color_hex:'#111111'},
  {...option('White Red','WHITE_RED',{color:'White',switch:'Red'},'175.00'),color_name:'White',color_hex:'#FFFFFF'}])
 const capacity=await create('Owned capacity and version choices',[option('16 GB V1','CAP16',{capacity:'16 GB',version:'V1'}),option('32 GB V2','CAP32',{capacity:'32 GB',version:'V2'},'200.00')])
 const accessory=await create('Owned optional accessory',[option('Default','ACCESSORY',{})],'25.75')
 const standaloneBlack=await create('Owned standalone black',[option('Default','FAMILYBLACK',{})],'91.25')
 const standaloneWhite=await create('Owned standalone white',[option('Default','FAMILYWHITE',{})],'112.50')
 const modelBasic=await create('Owned standalone model basic',[option('Default','MODELBASIC',{})],'210.00')
 const modelPro=await create('Owned standalone model pro',[option('Default','MODELPRO',{})],'310.00')
 const switchBlue=await create('Owned standalone blue switch',[option('Default','SWITCHBLUE',{})],'125.00')
 const switchRed=await create('Owned standalone red switch',[option('Default','SWITCHRED',{})],'135.00')
 const capacitySmall=await create('Owned standalone capacity 16',[option('Default','FAMILYCAP16',{})],'175.00')
 const capacityLarge=await create('Owned standalone capacity 32',[option('Default','FAMILYCAP32',{})],'225.00')
 const linkedFixtures=[standaloneBlack,standaloneWhite,modelBasic,modelPro,switchBlue,switchRed,capacitySmall,capacityLarge]
 const stock=[...linkedFixtures.flatMap(p=>p.variants),...simple.variants,...models.variants,...colors.variants,...capacity.variants,...accessory.variants,...keyboard.variants.filter(v=>v.code!=='BLACK_BLUE')]
 const receipt=await f.client.rpc('commerce_create_procurement_order',{p_supplier_id:f.supplier,p_warehouse_id:f.warehouse,p_invoice_number:'OWNED-MODERN-'+randomUUID(),p_notes:null,p_paid_amount:0,p_items:stock.map(v=>({product_id:v.product_id,variant_id:v.id,quantity:v.code==='WHITE_RED'?1:4,unit_cost:10}))})
 assert.equal(receipt.error,null,JSON.stringify(receipt.error))
 await db.query('select public.catalog_save_product_presentation($1,$2,$3,0,$4)',[f.actors.owner,keyboard.product.id,randomUUID(),JSON.stringify({videos:[],related:[],compatible:[accessory.product.id,models.product.id]})])
 const family=async(axes,members)=>{const content={videos:[],related:[],compatible:[],family:{id:randomUUID(),axes,members:members.map(([p,values,color_hex])=>({product_id:p.product.id,values,values_ar:{},...(color_hex?{color_hex}:{})}))}};await db.query('select public.catalog_save_product_presentation($1,$2,$3,0,$4)',[f.actors.owner,members[0][0].product.id,randomUUID(),JSON.stringify(content)])}
 await family([{key:'color',label:'Color',label_ar:'اللون'}],[[standaloneBlack,{color:'Black'},'#111111'],[standaloneWhite,{color:'White'},'#ffffff']])
 await family([{key:'model',label:'Model',label_ar:'الموديل'}],[[modelBasic,{model:'Basic'}],[modelPro,{model:'Pro'}]])
 await family([{key:'switch',label:'Keyboard switch',label_ar:'نوع المفتاح'}],[[switchBlue,{switch:'Blue'}],[switchRed,{switch:'Red'}]])
 await family([{key:'capacity',label:'Capacity',label_ar:'السعة'},{key:'version',label:'Version',label_ar:'الإصدار'}],[[capacitySmall,{capacity:'16 GB',version:'V1'}],[capacityLarge,{capacity:'32 GB',version:'V2'}]])
 await family([{key:'version',label:'Model',label_ar:'الموديل'}],[[models,{version:'Model options'}],[colors,{version:'Color options'}]])
 // The visual reference records are copied without source identity changes.
 // Replication mode is used only for seeding this isolated catalog, never writes
 // under test, stock receiving, storefront requests or any hosted operation.
 const columns=new Map()
 const insert=async(table,row)=>{
  if(!columns.has(table))columns.set(table,new Set((await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER'",[table])).rows.map(r=>r.column_name)))
  const entries=Object.entries(row).filter(([k,v])=>columns.get(table).has(k)&&v!==undefined)
  await db.query('insert into public.'+table+'('+entries.map(([k])=>'"'+k+'"').join(',')+') values('+entries.map((_,i)=>'$'+(i+1)).join(',')+') on conflict(id) do nothing',entries.map(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)?JSON.stringify(v):v))
 }
 await db.exec('set session_replication_role=replica;delete from public.specification_definitions')
 for(const [field,table] of [['categories','categories'],['brands','brands'],['definitions','specification_definitions']])for(const row of catalog[field])await insert(table,row)
 for(const row of catalog.products)await insert('products',{...row,primary_warehouse_id:f.warehouse,stock_quantity:0})
 for(const row of catalog.variants)await insert('product_variants',{...row,stock_quantity:0})
 for(const [field,table] of [['images','product_images'],['specifications','product_specifications'],['features','product_features']])for(const row of catalog[field])await insert(table,row)
 await db.exec('set session_replication_role=origin')
 const users=new Map(Object.entries(rest.actors).map(([name,id])=>[rest.token(name),{id,email:name+'@catalog.example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,user_metadata:{}}]))
 proxy=createServer(async(req,res)=>{
  res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('access-control-allow-methods','GET,HEAD,OPTIONS,POST,PATCH,PUT,DELETE');res.setHeader('access-control-expose-headers','content-range')
  if(req.method==='OPTIONS'){res.writeHead(204).end();return}
  if(req.url==='/auth/v1/user'){
   const user=users.get(req.headers.authorization?.slice(7))
   if(req.method==='PUT'&&user){const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks));user.user_metadata={...user.user_metadata,...body.data}}
   res.writeHead(user?200:401,{'content-type':'application/json'}).end(JSON.stringify(user||{message:'Owned fixture session required'}));return
  }
  if(!req.url.startsWith('/rest/v1/')){res.writeHead(404).end();return}
  try{
   const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks),headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length']
   const response=await fetch(rest.url+req.url.slice('/rest/v1'.length),{method:req.method,headers,...(body.length?{body}:{}),signal:AbortSignal.timeout(15000)})
   const raw=Buffer.from(await response.arrayBuffer());if(!response.ok)apiFailures.push({path:req.url.split('?')[0],status:response.status,body:raw.toString().slice(0,500)})
   res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>!['content-length','content-encoding','transfer-encoding','connection'].includes(k)))).end(raw)
  }catch(e){res.writeHead(500).end(e.message)}
 })
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const api='http://127.0.0.1:'+proxy.address().port
 const portProbe=createServer();await new Promise(r=>portProbe.listen(0,'127.0.0.1',r));const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));const origin='http://127.0.0.1:'+port
 const runtime={PATH:process.env.PATH,DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH,NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_PUBLIC_SUPABASE_URL:api,NUXT_PUBLIC_SUPABASE_KEY:rest.token('anon'),NUXT_SUPABASE_SERVICE_ROLE_KEY:rest.token('service'),NUXT_PUBLIC_SITE_URL:'https://independent-merchant.example.invalid',NUXT_UPLOADS_DIR:join(dir,'uploads'),NUXT_PUBLIC_PURCHASING_ENABLED:'true'}
 app=spawn(process.execPath,[join(base,'.output/server/index.mjs')],{env:runtime,stdio:['ignore','pipe','pipe']});app.stdout.on('data',v=>{logs+=v});app.stderr.on('data',v=>{logs+=v})
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/storefront/product-appearance')).ok)break}catch{}if(app.exitCode!==null)throw Error('Built app exited: '+logs);await new Promise(r=>setTimeout(r,100))}
 browser=await pw[engine].launch(engine==='chromium'?{headless:true,channel:'chrome'}:{headless:true,...(process.env.REVIEW_WEBKIT_EXECUTABLE?{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE}:{})})
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'})
 context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(20000)
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());requests.push({method:req.method(),path:url.pathname})
  if(![origin,api].includes(url.origin)){blocked.push(url.origin+url.pathname);await route.abort();return}
  await route.continue()
 })
 page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message+' @ '+page.url()));page.on('console',m=>{if(/hydration/i.test(m.text())&&m.type()==='warning')errors.push(m.text())})
 const go=async(product,{locale='en',width=1440,theme='light',query=''}={})=>{
  await context.addCookies([{name:'elcomputer-color-mode',value:theme,domain:'127.0.0.1',path:'/'}]);await page.setViewportSize({width,height:1100});await page.emulateMedia({colorScheme:theme==='system'?'dark':theme})
  const path=(locale==='ar'?'/ar':'')+'/products/'+product.slug+query
  if(clientNavigation&&page.url().startsWith(origin)){
   const response=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});check(response.status===200,'SSR product '+locale+'/'+width+'/'+theme);await response.body?.cancel()
   await page.evaluate(async({path,theme})=>{const nuxt=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt;nuxt.$colorMode.preference=theme;await nuxt.$router.push(path)},{path,theme})
   await page.waitForURL(origin+path)
  }else{
   const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});check(response.status()===200,'SSR product '+locale+'/'+width+'/'+theme)
  }
  await page.locator('.product-premium h1').waitFor();await page.waitForFunction(()=>document.querySelector('#__nuxt').__vue_app__?.config.globalProperties.$nuxt?.isHydrating===false)
  await page.waitForFunction(title=>document.querySelector('.product-premium h1')?.textContent.trim()===title,product.title)
  await page.evaluate(()=>document.fonts.ready)
 }
 const photo=async name=>{await page.screenshot({path:join(dir,name+'.png'),fullPage:true})}
 await go(simple.product)
 check(await page.locator('.pdp-variants').count()===0,'Simple Default option stays clean')
 check(await page.locator('.pdp-buy-with-it').count()===0,'No curated accessories stays hidden')
 check(await page.locator('[data-product-family]').count()===0,'Simple products have no invented family')
 for(const [from,to,label,price] of [[standaloneBlack,standaloneWhite,'White',112.50],[modelBasic,modelPro,'Pro',310],[switchBlue,switchRed,'Red',135],[capacitySmall,capacityLarge,'32 GB · V2',225]]){
  await go(from.product);const family=page.locator('[data-product-family]');await family.getByRole('link',{name:label,exact:true}).click();await page.waitForURL('**/products/'+to.product.slug)
  await page.waitForFunction(title=>document.querySelector('.product-premium h1')?.textContent.trim()===title,to.product.title)
  check((await page.locator('link[rel=canonical]').getAttribute('href')).endsWith('/products/'+to.product.slug),'Standalone choice preserves canonical '+label)
  check(Number((await page.locator('.pdp-price').innerText()).replace(/[^0-9.]/g,''))===price,'Standalone choice uses target price '+label)
  await page.locator('.pdp-purchase-action').click();await page.waitForFunction(id=>Object.keys(localStorage).some(k=>k.startsWith('commerce-cart-v3:')&&JSON.parse(localStorage.getItem(k)).items.some(i=>i.id===id)),to.product.id)
  check((await page.evaluate(readCart)).some(i=>i.id===to.product.id&&i.variant_id===to.variants[0].id&&i.price===price),'Standalone choice cart has actual target identity '+label)
 }
 await go(models.product);check(await page.locator('[data-product-family]').count()===1&&await page.locator('.pdp-option-dimension').count()===1,'Family links and internal SKU choices coexist')
 check(await page.getByText('Options for this product',{exact:true}).count()===1,'Mixed family/internal headings are unambiguous')
 for(const locale of ['en','ar'])for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  await go(standaloneBlack.product,{locale,width,theme});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Family responsive '+locale+'/'+width+'/'+theme)
  const links=page.locator('[data-product-family] a');check(await links.count()===2,'Only real published product combinations '+locale+'/'+width+'/'+theme)
  check(await page.locator('[data-product-family] [aria-current=page]').count()===1,'Current product is accessible '+locale+'/'+width+'/'+theme)
  await links.last().focus();await page.keyboard.press('Enter');await page.waitForURL('**/products/'+standaloneWhite.product.slug);check(true,'Family keyboard navigation '+locale+'/'+width+'/'+theme)
  if(width===390||width===1440)await photo('standalone-family-'+locale+'-'+width+'-'+theme)
 }
 await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('commerce-cart-v3:')).forEach(k=>localStorage.removeItem(k)))
 await go(simple.product)
 const favorite=page.locator('.pdp-favorite-action button'),share=page.locator('.pdp-share-action button')
 await favorite.waitFor();await page.waitForFunction(()=>document.querySelector('.pdp-favorite-action button').dataset.ready==='true')
 check(await favorite.evaluate(el=>!!el.closest('.pdp-purchase .pdp-quantity-row')),'Favorite is inside the quantity row')
 check(await share.evaluate(el=>!el.closest('.pdp-purchase')&&el.closest('.pdp-share-action').previousElementSibling?.matches('.pdp-purchase')),'Share is immediately below and outside the purchase card')
 const favoriteBox=await favorite.boundingBox(),quantityBox=await page.locator('.pdp-quantity').boundingBox()
 check(favoriteBox.x>=quantityBox.x+quantityBox.width&&Math.abs(favoriteBox.y-quantityBox.y)<3,'Favorite fits to the right of quantity on the same row')
 await favorite.focus();await page.keyboard.press('Space');check(await favorite.getAttribute('aria-pressed')==='true','Favorite keyboard state is accessible')
 if(engine==='webkit')await page.waitForLoadState('networkidle');await page.reload();await page.waitForFunction(()=>document.querySelector('.pdp-favorite-action button')?.dataset.ready==='true');check(await favorite.getAttribute('aria-pressed')==='true','Favorite guest persistence is retained')
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value}}})})
 await share.click();check((await page.evaluate(()=>window.__copied))===await page.locator('link[rel=canonical]').getAttribute('href'),'Share copy uses exact canonical URL')
 const reviewAction=page.locator('.pdp-customer-reviews');await reviewAction.focus();await page.keyboard.press('Enter');await page.waitForTimeout(150)
 check(await page.locator('#pdp-reviews').isVisible(),'Customer Reviews opens the real empty review section')
 check(await page.locator('.pdp-customer-reviews').evaluate(el=>el.previousElementSibling?.textContent?.trim().length>0),'Reviews action follows the warranty row')
 await go(colors.product);check(await page.locator('.pdp-option-dimension').count()===1,'Only genuine color dimension renders');await page.getByRole('radio',{name:'Black',exact:true}).click();check(await page.getByRole('radio',{name:'Black',exact:true}).getAttribute('aria-checked')==='true','A real color selects its SKU')
 await go(models.product);check((await page.locator('.pdp-price').innerText()).includes('170.75'),'Unselected models show actual configured price bounds')
 await page.getByRole('radio',{name:'Model A',exact:true}).click();check(Number((await page.locator('.pdp-price').innerText()).replace(/[^0-9.]/g,''))===140.5,'Model selection changes actual variant price')
 await page.locator('.pdp-quantity button').last().click();await page.getByRole('radio',{name:'Model B',exact:true}).click();check(await page.locator('.pdp-quantity output').innerText()==='2','Changing a variant retains quantity when its stock allows it')
 await go(capacity.product);check(await page.locator('.pdp-option-dimension').count()===2,'Capacity/version controls use authored dimensions');await page.getByRole('radio',{name:'16 GB',exact:true}).click();await page.getByRole('radio',{name:'V1',exact:true}).click();check(await page.locator('.pdp-purchase-action').isEnabled(),'Exact capacity/version combination can purchase')
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();await page.getByRole('radio',{name:'32 GB',exact:true}).click();check(await page.getByRole('radio',{name:'V1',exact:true}).isDisabled(),'Nonexistent capacity/version combination is disabled')
 await go(keyboard.product)
 const disclosure=page.locator('.pdp-buy-with-it');check(await disclosure.getAttribute('open')===null,'Buy with it starts collapsed')
 check(await disclosure.locator('.store-product-card').count()===0,'Collapsed accessories do not mount option-fetching cards')
 const blackRed=keyboard.variants.find(v=>v.code==='BLACK_RED'),whiteRed=keyboard.variants.find(v=>v.code==='WHITE_RED')
 await page.getByRole('radio',{name:'Black',exact:true}).click();check(await page.getByRole('radio',{name:'Blue',exact:true}).isDisabled(),'Unreceived switch option is disabled with stock tracking')
 await page.getByRole('radio',{name:'Red',exact:true}).click();const firstImage=await page.locator('.pdp-gallery-stage img').getAttribute('src')
 await page.locator('.pdp-quantity button').last().click();check(await page.locator('.pdp-quantity output').innerText()==='2','Valid quantity increments')
 await page.getByRole('radio',{name:'White',exact:true}).click();check(await page.locator('.pdp-quantity output').innerText()==='1','Variant change clamps quantity to its actual stock')
 const secondImage=await page.locator('.pdp-gallery-stage img').getAttribute('src');check(firstImage!==secondImage,'Variant change selects its assigned gallery image')
 await page.getByRole('radio',{name:'Black',exact:true}).click();await page.locator('.pdp-quantity button').last().click();await page.getByRole('radio',{name:'White',exact:true}).focus();await page.keyboard.press('ArrowLeft');check(await page.getByRole('radio',{name:'Black',exact:true}).getAttribute('aria-checked')==='true','Variant arrow navigation retains an exact choice')
 await page.locator('.pdp-purchase-action').click();await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('commerce-cart-v3:')&&JSON.parse(localStorage.getItem(k)).items.length))
 const cart=await page.evaluate(readCart);check(cart[0].variant_id===blackRed.id&&cart[0].price===150.25&&cart[0].variant_options.switch==='Red','Cart contains the exact selected SKU, price and attributes')
 const quantityBefore=await page.locator('.pdp-quantity output').innerText();await disclosure.locator('summary').click();await disclosure.locator('.store-product-add').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.pdp-buy-with-it .store-product-add')?.disabled)
 await disclosure.locator('.store-product-add').first().click();await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('commerce-cart-v3:')&&JSON.parse(localStorage.getItem(k)).items.length===2))
 const withAccessory=await page.evaluate(readCart);check(withAccessory.some(i=>i.id===accessory.product.id&&i.variant_id===accessory.variants[0].id&&i.quantity===1&&i.price===25.75),'Explicit accessory add creates its own correct SKU line')
 check((await disclosure.locator('.store-product-price').nth(1).innerText()).includes('170.75'),'Curated multi-option accessory shows actual SKU price bounds')
 check(await page.locator('.pdp-quantity output').innerText()===quantityBefore,'Accessory add leaves main-product quantity intact')
 await photo('keyboard-accessories-expanded-en-desktop')
 await go(simple.product,{query:'?variant='+randomUUID()});check(await page.locator('.pdp-purchase-action').isDisabled(),'Invalid requested SKU cannot silently select the default');await page.getByRole('radio',{name:/Default/}).click();check(await page.locator('.pdp-purchase-action').isEnabled(),'Explicit choice recovers an invalid requested SKU')
 for(const locale of ['en','ar'])for(const width of [320,390,768,1440])for(const theme of ['light','dark']){
  await go(keyboard.product,{locale,width,theme});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+locale+'/'+width+'/'+theme)
  check(await page.locator('html').getAttribute('dir')===(locale==='ar'?'rtl':'ltr'),'Document direction '+locale+'/'+width+'/'+theme)
  check(await disclosure.getAttribute('open')===null,'Accessories collapsed on navigation '+locale+'/'+width+'/'+theme)
  const favoritePosition=await favorite.boundingBox(),quantityPosition=await page.locator('.pdp-quantity').boundingBox()
  check(favoritePosition.x>=quantityPosition.x+quantityPosition.width-1&&Math.abs(favoritePosition.y-quantityPosition.y)<3,'Favorite stays right of quantity '+locale+'/'+width+'/'+theme)
  if(width<768)check(await page.locator('.pdp-quick-specifications a').isVisible(),'Mobile specifications link stays above accessories '+locale+'/'+width+'/'+theme)
  await photo('keyboard-'+locale+'-'+width+'-'+theme)
 }
 await go(keyboard.product,{theme:'system'});check(await page.locator('html').evaluate(el=>el.classList.contains('dark')),'System theme uses the OS preference')
 for(const product of catalog.products){await go(product,{width:1440});await photo('current-published-'+product.id+'-desktop');await go(product,{locale:'ar',width:390,theme:'dark'});await photo('current-published-'+product.id+'-ar-mobile')}
 await go(keyboard.product)
 const start=requests.length;await page.waitForTimeout(800);const background=requests.slice(start).filter(r=>r.path.includes('capabilities'))
 check(background.length===0,'Mounting the Modern page has no repeating availability requests')
 // The full Dashboard uses a synthetic owned Auth session with real role/RLS,
 // HTTP handlers and the same disposable PostgreSQL database.
 const identity=users.get(rest.token('owner')),session={access_token:rest.token('owner'),refresh_token:'owned-fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:identity}
 const cookieName=await page.evaluate(()=>document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$config.public.supabase.cookiePrefix)
 assert.ok(cookieName)
 await context.addCookies([{name:cookieName,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}])
 const dashboardPath='/dashboard/products/edit/'+models.product.id
 if(clientNavigation){await page.evaluate(async path=>{await document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$router.push(path)},dashboardPath);check(true,'Dashboard native fixture route renders through client navigation')}
 else{const dashboardResponse=await page.goto(origin+dashboardPath,{waitUntil:'domcontentloaded'});check(dashboardResponse.status()===200,'Dashboard native fixture route renders')}
 const prices=page.getByLabel('Option price (EGP)',{exact:true});await prices.first().waitFor({timeout:20000});await prices.first().fill('219.95')
 const values=page.getByLabel('Value',{exact:true});await values.first().fill('Model A Plus')
 await photo('dashboard-variant-fields')
 const save=page.getByRole('button',{name:/^Save changes$/i});await save.click()
 await page.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>/saved/i.test(el.textContent)),null,{timeout:15000})
 const after=await f.snapshot(models.product.id);check(after.variants.some(v=>Number(v.sale_price)===219.95&&v.option_values.model==='Model A Plus'),'Dashboard saves option price and attributes through actual HTTP/SQL')
 const oldRevision=after.revision;await prices.first().fill('229.95');await db.query("update public.products set description='Concurrent owned fixture edit' where id=$1",[models.product.id]);await save.click()
 await page.getByRole('alert').filter({hasText:/changed|reload/i}).first().waitFor();check(await prices.first().inputValue()==='229.95','Stale Dashboard save keeps the in-memory option draft')
 check((await f.snapshot(models.product.id)).revision>oldRevision,'Concurrent fixture edit retains the newer revision')
 await photo('dashboard-stale-option-save')
 const curator=await context.newPage();curator.setDefaultTimeout(10000);curator.on('pageerror',e=>errors.push(e.message+' @ '+curator.url()))
 await curator.goto(origin+'/dashboard/products/edit/'+keyboard.product.id,{waitUntil:'domcontentloaded'});(engine==='webkit'?await curator.waitForLoadState('networkidle'):undefined)
 const selected=curator.getByRole('heading',{name:'Buy with it',exact:true}).locator('..')
 await selected.getByRole('button',{name:'Move down',exact:true}).first().waitFor()
 await selected.getByRole('button',{name:'Move down',exact:true}).first().click()
 const savePresentation=curator.getByRole('button',{name:JSON.parse(await readFile('i18n/locales/en.json')).productPage.savePresentation,exact:true})
 await savePresentation.click()
 await curator.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>/presentation saved|saved/i.test(el.textContent)))
 const reordered=(await db.query('select public.get_product_presentation($1) v',[keyboard.product.id])).rows[0].v.compatible.map(p=>p.id)
 check(reordered[0]===models.product.id&&reordered[1]===accessory.product.id,'Dashboard reorders curated accessories through the existing receipt transaction')
 await selected.getByRole('button',{name:'Remove',exact:true}).first().click();await savePresentation.click()
 await curator.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>/presentation saved|saved/i.test(el.textContent)))
 const removed=(await db.query('select public.get_product_presentation($1) v',[keyboard.product.id])).rows[0].v.compatible.map(p=>p.id)
 check(removed.length===1&&removed[0]===accessory.product.id,'Dashboard removes only the explicitly selected accessory')
 await curator.screenshot({path:join(dir,'dashboard-curated-accessories.png'),fullPage:true})
 const familyPanel=curator.locator('[data-product-family-editor]')
 (engine==='webkit'?await curator.waitForLoadState('networkidle'):undefined);await curator.goto(origin+'/dashboard/products/edit/'+standaloneBlack.product.id,{waitUntil:'domcontentloaded'});(engine==='webkit'?await curator.waitForLoadState('networkidle'):undefined)
 await familyPanel.getByLabel('Color',{exact:true}).first().waitFor()
 await familyPanel.getByRole('button',{name:'Move down',exact:true}).first().click();await savePresentation.click()
 await curator.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>/presentation saved/i.test(el.textContent)))
 check((await db.query('select public.get_product_presentation($1) v',[standaloneWhite.product.id])).rows[0].v.family.members[0].product_id===standaloneWhite.product.id,'Dashboard family reorder propagates through native HTTP/SQL')
 await curator.screenshot({path:join(dir,'dashboard-linked-product-family.png'),fullPage:true})
 await familyPanel.getByRole('button',{name:'Remove',exact:true}).first().click();await savePresentation.click()
 await curator.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>/presentation saved/i.test(el.textContent)))
 check((await db.query('select public.get_product_presentation($1) v',[standaloneWhite.product.id])).rows[0].v.family===null,'Dashboard unlink preserves standalone identity')
 await familyPanel.getByRole('button',{name:'Link product options',exact:true}).click()
 await familyPanel.getByLabel('Color',{exact:true}).fill('Black')
 const searchLabel=JSON.parse(await readFile('i18n/locales/en.json')).productPage.productSearch
 await curator.getByLabel(searchLabel,{exact:true}).fill(standaloneWhite.product.title)
 const linkOption=curator.getByRole('button',{name:'Link as option',exact:true});await linkOption.waitFor()
 check(await linkOption.isDisabled(),'Dashboard requires explicit same-product confirmation')
 await familyPanel.getByRole('checkbox').check();await linkOption.click()
 await familyPanel.getByLabel('Color',{exact:true}).last().fill('White');await savePresentation.click()
 await curator.waitForFunction(()=>[...document.querySelectorAll('[role=status]')].some(el=>/presentation saved/i.test(el.textContent)))
 check((await db.query('select public.get_product_presentation($1) v',[standaloneWhite.product.id])).rows[0].v.family.members.length===2,'Dashboard links an existing standalone product through the original save/receipt path')
 // Keep both pages until browser teardown. WebKit can wait indefinitely for a
 // page-close acknowledgement with this full Dashboard fixture.
 check(errors.length===0,'No browser runtime or hydration errors')
 const unexpectedApiFailures=apiFailures.filter(x=>!(x.status===409&&x.path.endsWith('/rpc/catalog_save_product')&&JSON.parse(x.body).code==='PT409'))
 check(unexpectedApiFailures.length===0,'No unexpected native API failures')
 check(!requests.some(r=>/\/api\/(checkout|payments\/intentions)/.test(r.path)&&r.method==='POST'),'Browser UI tests create no order or provider intention')
 await writeFile(join(dir,'browser-report.json'),JSON.stringify({engine,checks,errors,apiFailures,blocked,requests,public_snapshot_utc:catalog.utc,production_writes:0,provider_calls:0},null,2)+'\n')
 console.log(JSON.stringify({result:'PRODUCT_FAMILY_BUILT_BROWSER_PASS',engine,checks:checks.length,errors,blocked:blocked.length,apiFailures},null,2))
}catch(error){await page?.screenshot({path:join(dir,'failure.png'),fullPage:true});await writeFile(join(dir,'failure.txt'),error.stack+'\n');throw error}
finally{await writeFile(join(dir,'server.log'),logs);await writeFile(join(dir,'diagnostics.json'),JSON.stringify({checks,errors,apiFailures,blocked,requests},null,2));await browser?.close();await stop(app);if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r))}await rest.close()}
