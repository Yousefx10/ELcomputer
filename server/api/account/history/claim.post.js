import {createError} from 'h3'
import {historyCustomer,historyCommand} from '../../../utils/customerHistory'
import {readPaymentCallbackBody} from '../../../utils/payments/body.js'

export default defineEventHandler(async event=>{
 const actor=await historyCustomer(event)
 let body
 try{body=JSON.parse(await readPaymentCallbackBody(event,512,2000))}catch{/* Reject malformed data below. */}
 if(!body||body.confirmed!==true||Object.keys(body).some(k=>k!=='confirmed'))throw createError({statusCode:400,statusMessage:'Confirm that you want to connect previous orders.'})
 return historyCommand(actor,'customer_history_claim')
})
