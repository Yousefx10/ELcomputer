import {createError,setHeader} from 'h3'
import {requireCustomerRequest} from './customerRequest'

export const historyCustomer = async event => {
 setHeader(event,'Cache-Control','private, no-store')
 const actor=await requireCustomerRequest(event)
 if(!actor.authUser.email_confirmed_at)throw createError({statusCode:403,statusMessage:'Confirm your email before viewing previous orders.'})
 return actor
}

export const historyCommand = async (actor,name,parameters={}) => {
 const {data,error}=await actor.supabaseAdmin.rpc(name,{...parameters,p_user_id:actor.authUser.id})
 if(error)throw createError({statusCode:503,statusMessage:'Could not load previous orders. Please try again.'})
 return data
}
