import {createError,getQuery} from 'h3'
import {historyCustomer,historyCommand} from '../../../utils/customerHistory'

export default defineEventHandler(async event=>{
 const actor=await historyCustomer(event),query=getQuery(event)
 if(Object.keys(query).some(k=>k!=='offset')||!/^(0|[1-9][0-9]{0,5})$/.test(String(query.offset??'0'))||Number(query.offset||0)>100000)throw createError({statusCode:400,statusMessage:'Invalid page.'})
 return historyCommand(actor,'customer_history_read',{p_offset:Number(query.offset||0)})
})
