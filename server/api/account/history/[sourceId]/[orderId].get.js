import {createError,getRouterParam} from 'h3'
import {historyCustomer,historyCommand} from '../../../../utils/customerHistory'

export default defineEventHandler(async event=>{
 const actor=await historyCustomer(event),source=getRouterParam(event,'sourceId'),order=getRouterParam(event,'orderId')
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(source||'')||!/^[1-9][0-9]{0,17}$/.test(order||''))throw createError({statusCode:404,statusMessage:'Order not found.'})
 const data=await historyCommand(actor,'customer_history_read',{p_source_id:source,p_order_id:order})
 if(!data)throw createError({statusCode:404,statusMessage:'Order not found.'})
 return data
})
