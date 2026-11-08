import {createError,setHeader} from 'h3'
import {metaCatalogCsv,metaCatalogRows} from '../../utils/metaCatalogFeed.js'
import {publicSeoClient,readPublicRows,readSeoSettings} from '../../utils/publicSeo.js'
import {publicSiteUrl} from '../../../app/utils/seo.js'

// Public catalog fields only. An empty result stays an error, because Meta deletes items missing from a feed.
const readFeed=defineCachedFunction(async()=>{
 const {client,config}=publicSeoClient(),settings=await readSeoSettings(client)
 const [products,variants,brands,images]=await Promise.all([
  readPublicRows(client,'storefront_products','id,title,slug,description,long_description,price,old_price,image_url,brand_id,selling_mode,is_published',{is_published:true}),
  readPublicRows(client,'product_variants','id,product_id,name,color_name,sale_price,stock_quantity,is_active',{is_active:true}),
  readPublicRows(client,'brands','id,name',{}),
  readPublicRows(client,'product_images','id,product_id,variant_id,image_url,sort_order',{})
 ])
 const base=publicSiteUrl(settings,config.public.siteUrl);if(!base)throw createError({statusCode:503,statusMessage:'Site origin is not configured.'})
 const {rows}=metaCatalogRows({products,variants,brands,images,settings,base})
 if(!rows.length)throw createError({statusCode:503,statusMessage:'Catalog is unavailable.'})
 return metaCatalogCsv(rows)
},{name:'meta-catalog-feed',maxAge:900,swr:false})

export default defineEventHandler(async event=>{
 const csv=await readFeed()
 setHeader(event,'Content-Type','text/csv; charset=utf-8')
 setHeader(event,'Cache-Control','public, max-age=900')
 return csv
})
