import {createError,getRouterParam,setHeader} from 'h3'
import {requireAdminRequest} from '../../../../utils/adminRequest'
import {loadShippingLabel} from '../../../../utils/shippingLabelAccess.js'

export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const authorize=()=>requireAdminRequest(event,{permission:'dashboard.orders'})
 const {supabaseAdmin}=await authorize(),orderId=(getRouterParam(event,'id')||'').toLowerCase()
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(orderId))throw createError({statusCode:400,statusMessage:'Choose an order.'})
 const {bytes,identity,sha256}=await loadShippingLabel({db:supabaseAdmin,orderId,authorize})
 return new Response(bytes,{headers:{
  'content-type':'application/pdf','content-length':String(bytes.length),
  'x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'",
  'referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin',
  'content-disposition':`attachment; filename="PDC-${identity.awb}.pdf"`,
  'cache-control':'private, no-store','x-shipping-order':identity.orderId,'x-shipping-job':identity.jobId,
  'x-shipping-awb':identity.awb,'x-shipping-ref':identity.reference,'x-label-sha256':sha256
 }})
})
