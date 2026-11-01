import {requireAdminRequest} from '../../utils/adminRequest'
import {configuredPaymobMethods} from '../../utils/payments/methods.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');await requireAdminRequest(event,{permission:'payments.configure'})
 const runtime=useRuntimeConfig(event);let methods=[]
 try{methods=configuredPaymobMethods(runtime,runtime.paymobMode).map(x=>({method:x.method,configured:x.integrationId!==null,mode:runtime.paymobMode,implemented:x.flowImplemented,available:x.available&&runtime.paymobEnabled===true&&runtime.paymobLiveRequestsEnabled===true}))}catch{methods=['card','apple_pay','google_pay','mobile_wallet'].map(method=>({method,configured:false,implemented:method==='card',available:false}))}
 return {methods}
})
