import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {mobileHeroPresentation,homepagePresentation} from '../app/utils/storePresentation.js'
import {historicalDate,historicalStatusKey} from '../app/utils/historicalOrderDisplay.js'
import {buildSeo} from '../app/utils/seo.js'
import config from '../config/storefront-presentation.json' with {type:'json'}

test('mobile copy is bound to the exact configured banner and destination',()=>{
 const entry=config.mobileHeroes[0],banner={image_url:entry.image,link_url:entry.link}
 assert.match(mobileHeroPresentation(banner,'en').title,/EGP50/)
 assert.match(mobileHeroPresentation(banner,'ar').title,/50/)
 assert.equal(mobileHeroPresentation({...banner,image_url:'/new-offer.png'},'en'),null)
 assert.equal(mobileHeroPresentation({...banner,link_url:'/different-offer'},'en'),null)
 assert.equal(mobileHeroPresentation(null,'en'),null)
})
test('homepage metadata uses the configured business and preserves owner overrides',()=>{
 const settings={site_name:'Independent Shop',seo_site_url:'https://shop.example.test'}
 for(const locale of ['en','ar']){
  const copy=homepagePresentation(settings,locale),seo=buildSeo({settings,siteUrl:settings.seo_site_url,path:locale==='ar'?'/ar':'/',locale,...copy})
  assert.match(copy.description,/Independent Shop/);assert.ok(!copy.description.includes('ELcomputer'))
  assert.equal(seo.canonical,'https://shop.example.test'+(locale==='ar'?'/ar':'/'))
  assert.equal(seo.robots,'index,follow');assert.equal(seo.alternates.length,3)
 }
 assert.equal(homepagePresentation({...settings,seo_site_title:'Owner title',seo_default_description:'Owner description'},'ar').description,'Owner description')
})
test('historical presentation translates known states and preserves unknown status evidence',()=>{
 for(const status of ['pending','processing','on-hold','completed','cancelled','refunded','failed','checkout-draft'])assert.equal(historicalStatusKey('wc-'+status),'historicalOrders.status.'+status)
 assert.equal(historicalStatusKey('wc-unrecognized'),'historicalOrders.status.unknown')
 assert.equal(historicalDate('bad-date','en'),null)
 assert.match(historicalDate('2025-05-15T12:00:00Z','en'),/2025/)
 assert.match(historicalDate('2025-05-15T12:00:00Z','ar'),/٢٠٢٥/)
})
test('favicon PNG/ICO/manifest dimensions bind to actual encoded assets',async()=>{
 const files=[[16,'favicon-16x16.png'],[32,'favicon-32x32.png'],[48,'favicon-48x48.png'],[96,'favicon-96x96.png'],[180,'apple-touch-icon.png'],[192,'android-chrome-192x192.png'],[512,'android-chrome-512x512.png']]
 for(const[size,name]of files){const b=await readFile('public/'+name);assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size)}
 const ico=await readFile('public/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),4)
 for(let i=0;i<4;i++){const offset=ico.readUInt32LE(6+i*16+12);assert.equal(ico.toString('hex',offset,offset+8),'89504e470d0a1a0a')}
 const manifest=JSON.parse(await readFile('public/site.webmanifest'));assert.equal(manifest.icons.length,2)
 for(const icon of manifest.icons)assert.ok((await readFile('public'+icon.src)).length>100)
})
