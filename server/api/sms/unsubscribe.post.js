import {createError,setHeader} from 'h3'
import {readSmsBody} from '../../utils/sms/admin'
import {getSupabaseAdminClient} from '../../utils/supabaseAdmin'
import {verifyUnsubscribe} from '../../utils/sms/marketing'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer');setHeader(event,'X-Content-Type-Options','nosniff')
 const body=await readSmsBody(event,1024),id=verifyUnsubscribe(body.token,useRuntimeConfig(event))
 if(id){const r=await getSupabaseAdminClient().rpc('sms_marketing_unsubscribe',{p_contact:id});if(r.error)throw createError({statusCode:503,statusMessage:'Please try again later.'})}
 return {state:'processed'}
})
