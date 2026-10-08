import { emailAddress } from '../../../app/utils/email.js'
import { brevoMessageId } from './brevo.js'
import { emailDigest } from './service.js'
import { validateEmail } from './core.js'
// Payload names, not create-webhook subscription names. Verified Brevo docs.
const events={request:'sent',delivered:'delivered',deferred:'deferred',soft_bounce:'soft_bounce',hard_bounce:'hard_bounce',spam:'spam',invalid_email:'invalid_email',blocked:'blocked',error:'error',unsubscribed:'unsubscribed',opened:'opened'}
export const normalizeBrevoEvent = body => validateEmail(()=>{
 if(!events[body.event])return null
 const recipient=emailAddress(body.email),id=brevoMessageId(body['message-id'])
 const seconds=body.ts_event??body.ts
 if(!Number.isSafeInteger(seconds)||seconds<946684800||seconds>Date.now()/1000+300)throw Error('Invalid email event time.')
 const event_at=new Date(seconds*1000).toISOString(),type=events[body.event]
 const correlation=typeof body['X-Mailin-custom']==='string'&&/^elc-[a-f0-9]{64}$/.test(body['X-Mailin-custom'])?body['X-Mailin-custom']:null
 return {recipient,provider_message_id:id,correlation,event_type:type,event_at,event_key:emailDigest(JSON.stringify([id,recipient,type,seconds]))}
})
