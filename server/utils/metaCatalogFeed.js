import {usesUnrecordedStockSales} from '../../app/utils/backorder.js'
import {variantSalePrice} from '../../app/utils/productOptions.js'

// Item IDs match the content_ids sent by Pixel and server events, one row per active variant.
export const META_CATALOG_COLUMNS=['id','item_group_id','title','description','availability','condition','price','sale_price','link','image_link','brand','color']
const placeholder=/^(default|standard|base|product)$/i,feedImage=/\.(jpe?g|png)$/i
const money=value=>Number(value).toFixed(2)+' EGP'
const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/[#*_`~]+/g,' ').replace(/\s+/g,' ').trim()
const absolute=(base,url)=>/^https?:\/\//i.test(url)?url:base+(String(url).startsWith('/')?'':'/')+url
const isFeedImage=url=>feedImage.test(String(url).split('?')[0])
export function metaCatalogCondition(title){
 const text=String(title||'')
 if(/\brefurb/i.test(text))return 'refurbished'
 return /\bopen[\s-]?box\b|\bpre-?owned\b|مستعمل/i.test(text)?'used':'new'
}
// Meta documents JPEG and PNG, so a JPEG or PNG wins over a newer format the store also holds.
export function metaCatalogImage(product,variant,gallery){
 const own=gallery.filter(x=>x.variant_id===variant.id).map(x=>x.image_url),rest=gallery.filter(x=>x.variant_id!==variant.id).map(x=>x.image_url)
 const candidates=[...own,product.image_url,...rest].filter(Boolean)
 return candidates.find(isFeedImage)||candidates[0]||''
}
export function metaCatalogRows({products,variants,brands,images,settings,base}){
 const brandNames=new Map(brands.map(x=>[x.id,plain(x.name)])),byProduct=new Map(),gallery=new Map()
 for(const v of variants)if(v.is_active)byProduct.set(v.product_id,[...(byProduct.get(v.product_id)||[]),v])
 for(const i of [...images].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)))gallery.set(i.product_id,[...(gallery.get(i.product_id)||[]),i])
 const rows=[],skipped={preorder:0,brand:0,image:0,price:0}
 for(const product of products){
  if(!product.is_published)continue
  if((product.selling_mode||'normal')!=='normal'){skipped.preorder++;continue}
  const brand=brandNames.get(product.brand_id)
  if(!brand){skipped.brand++;continue}
  const options=byProduct.get(product.id)||[]
  for(const variant of options){
   const current=variantSalePrice(product,variant),regular=Number(product.old_price),image=metaCatalogImage(product,variant,gallery.get(product.id)||[])
   if(!image){skipped.image++;continue}
   if(!(current>0)){skipped.price++;continue}
   const name=plain(variant.name),title=plain(product.title),named=options.length>1&&name&&!placeholder.test(name)
   rows.push({id:variant.id,item_group_id:product.id,title:(named?title+' - '+name:title).slice(0,200),
    description:(plain(product.description)||plain(product.long_description)||title).slice(0,9999),
    availability:settings.allow_out_of_stock_purchases||usesUnrecordedStockSales(product,settings)||Number(variant.stock_quantity)>0?'in stock':'out of stock',
    condition:metaCatalogCondition(product.title),price:money(regular>current?regular:current),sale_price:regular>current?money(current):'',
    link:base+'/products/'+encodeURIComponent(product.slug),image_link:absolute(base,image),brand,color:placeholder.test(plain(variant.color_name))?'':plain(variant.color_name)})
  }
 }
 return {rows,skipped}
}
const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"'
export const metaCatalogCsv=rows=>[META_CATALOG_COLUMNS.join(','),...rows.map(row=>META_CATALOG_COLUMNS.map(key=>cell(row[key])).join(','))].join('\n')+'\n'
