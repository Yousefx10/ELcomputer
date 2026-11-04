import {createError} from 'h3'
import {throwCheckoutError} from '../checkoutCommand'

export const runPaymentCheckoutRpc=async(db,name,input)=>{
 const {data,error}=await db.rpc(name,input)
 if(error){
  if(error.code==='40001')throw createError({statusCode:409,statusMessage:'Payment details changed. Refresh first.'})
  if(String(error.message).includes('payment_first:existing'))throw createError({statusCode:409,statusMessage:'Check this payment before paying again.',data:{code:'payment_first:existing',...(/^[0-9a-f-]{36}$/i.test(error.details||'')?{checkoutId:error.details}:{})}})
  if(String(error.message).includes('payment_first:refresh'))throw createError({statusCode:409,statusMessage:'Reload checkout before paying.',data:{code:'payment_first:refresh'}})
  throwCheckoutError(error)
 }
 return data
}
