import {createError,getRouterParam,setHeader} from 'h3'
import {requireAdminRequest} from '../../../../utils/adminRequest'
import {processPdcTracking} from '../../../../utils/pdcTrackingPolling'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const authorize=()=>requireAdminRequest(event,{permission:'dashboard.orders'})
 const {supabaseAdmin}=await authorize(),id=getRouterParam(event,'id')
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))throw createError({statusCode:404,statusMessage:'Order not found.'})
 return processPdcTracking({db:supabaseAdmin,orderId:id,authorize})
})
