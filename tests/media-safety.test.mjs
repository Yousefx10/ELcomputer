import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access, symlink, mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { request } from 'node:http'
import { promises as fileSystem } from 'node:fs'
import { createMediaFixture, pngImage } from './helpers/mediaFixture.mjs'
import { throwBrandError } from '../server/utils/brandPages.js'
import { throwSitePageError } from '../server/utils/sitePages.js'
import { validateImageContent, MAX_IMAGE_BYTES } from '../server/utils/imageContent.js'

const images=JSON.parse(await readFile(new URL('./helpers/media-images.json',import.meta.url),'utf8'))
test('image byte validation preserves raster formats and rejects spoofed, truncated, SVG and oversized content',()=>{
  for(const[type,data]of Object.entries(images)) {
    const bytes=Buffer.from(data,'base64');assert.equal(validateImageContent(bytes,type).mimeType,type)
    assert.throws(()=>validateImageContent(bytes.subarray(0,bytes.length-3),type),e=>e.statusCode===400)
    assert.throws(()=>validateImageContent(Buffer.concat([bytes,Buffer.from('<script>alert(1)</script>')]),type),e=>e.statusCode===400)
    assert.throws(()=>validateImageContent(bytes,type==='image/png'?'image/jpeg':'image/png'),e=>e.statusCode===400)
  }
  for(const type of Object.keys(images)) for(const bytes of [Buffer.from('<svg onload="alert(1)"/>'),Buffer.from('<html>private</html>'),Buffer.from('not an image'),Buffer.alloc(0)]) assert.throws(()=>validateImageContent(bytes,type),e=>e.statusCode===400)
  assert.throws(()=>validateImageContent(Buffer.from('<svg/>'),'image/svg+xml'),e=>e.data.code==='MEDIA_SVG_UNSUPPORTED')
  assert.throws(()=>validateImageContent(Buffer.alloc(MAX_IMAGE_BYTES+1),'image/png'),e=>e.statusCode===413)
  for(const handler of [throwBrandError,throwSitePageError])assert.throws(()=>handler({message:'This image is unavailable. Choose another image.'}),e=>e.statusCode===400&&e.data.code==='MEDIA_UNAVAILABLE')
  const corrupt=pngImage();corrupt[44]^=1;assert.throws(()=>validateImageContent(corrupt,'image/png'))
})

test('actual media HTTP scopes, uploads, delivery and guarded deletion use an isolated root', {timeout:60000},async t=>{
  const f=await createMediaFixture()
  try{
    await f.addFile('products/existing.png');await f.addFile('products/gallery/gallery.png');await f.addFile('categories/category.png');await f.addFile('brands/brand.png');await f.addFile('settings/site-logo/logo.png');await f.addFile('private/documents/confidential.png');await f.addFile('customer-attachments/evidence.png')
    await t.test('product editor browses and selects product media without Settings; no protected paths',async()=>{
      const r=await f.call('/api/admin-gallery?section=products',{actor:'editor'});assert.equal(r.response.status,200);assert.equal(r.response.headers.get('cache-control'),'private, no-store')
      assert.deepEqual(r.body.items.map(i=>i.publicPath).sort(),['/uploads/products/existing.png','/uploads/products/gallery/gallery.png'])
      assert.equal((await f.call('/api/admin-gallery?section=site_logo',{actor:'editor'})).response.status,403)
      const owner=await f.call('/api/admin-gallery');assert.equal(owner.body.items.length,5);assert.ok(!JSON.stringify(owner.body).includes('confidential'))
      for(const actor of ['viewer','disabled','customer',null,'unknown']) assert.ok([401,403].includes((await f.call('/api/admin-gallery',{actor})).response.status))
      await f.db.query("update public.admin_users set permissions=$1 where id=$2",[JSON.stringify({'categories.view':true,'categories.edit':true}),f.actors.viewer])
      assert.deepEqual((await f.call('/api/admin-gallery',{actor:'viewer'})).body.items.map(i=>i.publicPath),['/uploads/categories/category.png'])
      await f.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.editor]);assert.equal((await f.call('/api/admin-gallery',{actor:'editor'})).response.status,403)
      await f.db.query('update public.admin_users set is_active=true where id=$1',[f.actors.editor])
    })
    await t.test('real bytes and generated filenames, not multipart names, control the uploaded image',async()=>{
      for(const[type,data]of Object.entries(images)) {
        const r=await f.upload(Buffer.from(data,'base64'),type,'products','editor','../../malicious.svg');assert.equal(r.response.status,200,JSON.stringify(r.body));assert.match(r.body.publicPath,/^\/uploads\/products\/\d+-[a-f0-9]{32}\.(png|jpg|webp|gif|avif)$/)
        const delivery=await fetch(f.url+r.body.publicPath);assert.equal(delivery.status,200);assert.equal(delivery.headers.get('content-type'),type);assert.equal(delivery.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await delivery.arrayBuffer()),Buffer.from(data,'base64'))
      }
      for(const actor of ['disabled','customer',null]) assert.ok([401,403].includes((await f.upload(pngImage(),'image/png','products',actor)).response.status))
      assert.equal((await f.upload(pngImage(),'image/png','brands','editor')).response.status,403)
      assert.equal((await f.upload(pngImage(),'text/html')).response.status,400)
      for(const section of ['constructor','__proto__','unknown'])assert.equal((await f.upload(pngImage(),'image/png',section)).response.status,400)
      assert.equal((await f.upload(Buffer.from('<svg onload="alert(1)"/>'),'image/png')).response.status,400)
      assert.equal((await f.upload(Buffer.from('<svg/>'),'image/svg+xml')).response.status,400)
      assert.equal((await f.upload(Buffer.alloc(MAX_IMAGE_BYTES+1),'image/png')).response.status,413)
    })
    await t.test('chunked oversized and malformed multipart requests stop before filesystem writes',async()=>{
      const response=await new Promise((resolve,reject)=>{
        const req=request(f.url+'/api/admin-uploads',{method:'POST',headers:{authorization:'Bearer editor','content-type':'multipart/form-data; boundary=fixture','transfer-encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);for(let i=0;i<10;i++)req.write(Buffer.alloc(1024*1024));req.end()
      });assert.equal(response,413)
      const form=new FormData();form.append('section','products');form.append('section','brands');form.append('file',new Blob([pngImage()],{type:'image/png'}),'image.png');assert.equal((await f.call('/api/admin-uploads',{method:'POST',actor:'editor',body:form})).response.status,400)
    })
    await t.test('incomplete uploads stay private and publication failure preserves complete media',async()=>{
      const originalLink=fileSystem.link,originalOpen=fileSystem.open
      const before=(await f.call('/api/admin-gallery')).body.items.length
      let observed,release,staging,destination
      const waiting=new Promise(resolve=>observed=resolve),barrier=new Promise(resolve=>release=resolve)
      fileSystem.link=async(source,target)=>{
        if(!source.startsWith(f.root))return originalLink(source,target)
        staging=source;destination=target;observed();await barrier
        throw Object.assign(Error('Synthetic publication failure'),{code:'EIO'})
      }
      try {
        const upload=f.upload();await waiting
        assert.equal((await f.call('/api/admin-gallery')).body.items.length,before)
        assert.equal((await f.call('/uploads/'+staging.slice(f.root.length+1),{actor:null})).response.status,404)
        release();assert.equal((await upload).response.status,500)
        await assert.rejects(()=>access(staging));await assert.rejects(()=>access(destination))
      } finally {release();fileSystem.link=originalLink}
      fileSystem.link=async(source,target)=>{destination=target;return originalLink(source,target)}
      fileSystem.open=async(...args)=>{
        const handle=await originalOpen(...args)
        if(args[0]===join(f.root,'products'))handle.sync=async()=>{throw Object.assign(Error('Synthetic directory sync failure'),{code:'EIO'})}
        return handle
      }
      try {assert.equal((await f.upload()).response.status,500)}
      finally {fileSystem.open=originalOpen;fileSystem.link=originalLink}
      assert.deepEqual(await readFile(destination),pngImage())
      const publicPath='/uploads/'+destination.slice(f.root.length+1)
      assert.ok((await f.call('/api/admin-gallery')).body.items.some(i=>i.publicPath===publicPath))
      const saved=await f.save(f.body({image_url:publicPath}))
      assert.equal((await f.snapshot(saved.id)).product.image_url,publicPath)
      await access(destination)
    })
    await t.test('products, variant galleries, categories, brand JSON, content, SEO and order snapshots block deletion',async()=>{
      const path='/uploads/products/existing.png',created=await f.save(f.body({image_url:path})),snapshot=await f.snapshot(created.id)
      const del=()=>f.call('/api/admin-gallery',{method:'DELETE',body:{path}})
      assert.equal((await del()).response.status,409);await access(join(f.root,'products/existing.png'))
      await f.db.query('update public.products set image_url=null where id=$1',[created.id])
      const order=randomUUID();await f.db.exec("update public.site_settings set payment_cash_enabled=true where key='default'");await f.db.query("insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate,payment_method)values($1,$2,'Fixture','01000000000','Fixture','Fixture','Fixture','cash')",[order,f.actors.customer])
      await f.db.query("insert into public.customer_order_items(order_id,product_title,image_url,unit_price,quantity,line_total)values($1,'Fixture',$2,10,1,10)",[order,path]);assert.equal((await del()).response.status,409);await f.db.query('delete from public.customer_order_items where order_id=$1',[order])
      const refs=[
        ['update public.products set seo_image_url=$1 where id=$2','update public.products set seo_image_url=null where id=$2',created.id,path],
        ['insert into public.product_images(id,product_id,variant_id,image_url)values($2,$3,$4,$1)','delete from public.product_images where id=$2',randomUUID(),path,created.id,snapshot.variants[0].id],
        ['update public.categories set image_url=$1 where id=$2','update public.categories set image_url=null where id=$2',f.category,path],
        ['update public.categories set image_url=$1 where id=$2','update public.categories set image_url=null where id=$2',f.category,'/uploads/products/EXISTING.PNG'],
        ['update public.brands set logo_url=$1 where id=$2','update public.brands set logo_url=null where id=$2',f.brand,path],
        ['update public.brands set brand_page=$1::jsonb where id=$2',"update public.brands set brand_page='{}' where id=$2",f.brand,JSON.stringify({rows:[{items:[{url:'https://store.example/uploads/products/%65xisting.png?width=200'}]}]})],
        ['update public.site_settings set site_logo_dark_url=$1 where key=$2','update public.site_settings set site_logo_dark_url=null where key=$2','default',path],
        ['insert into public.site_pages(id,title,path,content_markdown)values($2,\'Fixture\',\'media-fixture\',$1)','delete from public.site_pages where id=$2',randomUUID(),'![image](/uploads/products/gallery/../existing.png)'],
        ['insert into public.site_hero_banners(id,image_url)values($2,$1)','delete from public.site_hero_banners where id=$2',randomUUID(),path]
      ]
      for(const[add,remove,id,value,...tail]of refs){await f.db.query(add,[value,id,...tail]);const r=await del();assert.equal(r.response.status,409,add+' '+JSON.stringify(r.body));assert.equal(r.body.data.code,'MEDIA_REFERENCED');await f.db.query(remove.replaceAll('$2','$1'),[id])}
      await f.save(f.body({long_description:'![not a managed path](/uploads/'+ 'a'.repeat(6000)+')'}))
      const before=await f.counts();assert.equal((await f.call('/api/admin-gallery',{actor:'editor',method:'DELETE',body:{path}})).response.status,403)
      assert.equal((await del()).response.status,200);await assert.rejects(()=>access(join(f.root,'products/existing.png')));assert.deepEqual(await f.counts(),before)
      assert.equal((await del()).response.status,200)
      await assert.rejects(()=>f.db.query('update public.products set image_url=$1 where id=$2',[path,created.id]),/This image is unavailable/)
      await assert.rejects(()=>f.db.query('update public.categories set image_url=$1 where id=$2',['/uploads/products/EXISTING.PNG',f.category]),/This image is unavailable/)
      const fresh=await f.snapshot(created.id);await assert.rejects(()=>f.save({...f.body({image_url:path}),expected_revision:fresh.revision,variants:fresh.variants},{operation:'update',id:created.id}),e=>e.statusCode===400&&e.data.productSaveError==='media')
      assert.deepEqual(await f.counts(),before)
    })
    await t.test('reservation and lost completion keep deletion resumable, never re-enable references',async()=>{
      const pendingPath='/uploads/products/lost-reservation.png';await f.addFile('products/lost-reservation.png');const transport=f.client.rpc;let loseReserve=true
      f.client.rpc=async(name,args)=>{const r=await transport(name,args);if(name==='catalog_media_delete'&&!args.p_finish&&loseReserve){loseReserve=false;return{data:null,error:{message:'fixture lost reservation response'}}}return r}
      assert.equal((await f.call('/api/admin-gallery',{method:'DELETE',body:{path:pendingPath}})).response.status,503);await access(join(f.root,'products/lost-reservation.png'));await assert.rejects(()=>f.db.query('update public.categories set image_url=$1 where id=$2',[pendingPath,f.category]),/This image is unavailable/);assert.equal((await f.call('/api/admin-gallery',{method:'DELETE',body:{path:pendingPath}})).response.status,200);f.client.rpc=transport
      const path='/uploads/brands/brand.png';const reserve=await f.client.rpc('catalog_media_delete',{p_admin_id:f.actors.owner,p_path:path});assert.equal(reserve.error,null)
      await assert.rejects(()=>f.db.query('update public.brands set logo_url=$1 where id=$2',[path,f.brand]),/This image is unavailable/)
      const original=f.client.rpc;let lost=true
      f.client.rpc=async(name,args)=>{const r=await original(name,args);if(name==='catalog_media_delete'&&args.p_finish&&lost){lost=false;return{data:null,error:{message:'fixture lost acknowledgement'}}}return r}
      const r=await f.call('/api/admin-gallery',{method:'DELETE',body:{path}});assert.equal(r.response.status,503);await assert.rejects(()=>access(join(f.root,'brands/brand.png')))
      assert.equal((await f.call('/api/admin-gallery',{method:'DELETE',body:{path}})).response.status,200)
      f.client.rpc=original
    })
    await t.test('symlinks, traversal and non-image/private paths cannot be read, listed, written or removed',async()=>{
      await symlink(join(f.root,'private/documents/confidential.png'),join(f.root,'products/link.png'))
      assert.equal((await f.call('/uploads/products/link.png',{actor:null})).response.status,400)
      assert.ok(!(await f.call('/api/admin-gallery')).body.items.some(i=>i.name==='link.png'))
      for(const path of ['/uploads/private/documents/confidential.png','/uploads/customer-attachments/evidence.png','/uploads/products/../../private/documents/confidential.png','/uploads/products/a.png?x=1'])assert.ok([400,404].includes((await f.call('/api/admin-gallery',{method:'DELETE',body:{path}})).response.status))
      assert.equal((await f.call('/uploads/private/documents/confidential.png',{actor:null})).response.status,404)
      await access(join(f.root,'private/documents/confidential.png'))
      await f.addFile('products/old.svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
      await symlink(join(f.root,'private/documents'),join(f.root,'settings/auth-page'));assert.equal((await f.upload(pngImage(),'image/png','auth_page','owner')).response.status,400);await access(join(f.root,'private/documents/confidential.png'))
      const svg=await fetch(f.url+'/uploads/products/old.svg');assert.equal(svg.status,200);assert.match(svg.headers.get('content-security-policy'),/sandbox; default-src 'none'/)
    })
  }finally{await f.close()}
})
