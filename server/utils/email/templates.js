import { emailBody, emailLine, emailAddress, emailVariables, renderEmailSource } from '../../../app/utils/email.js'
import { validateEmail } from './core.js'
export const validateEmailTemplate = body => validateEmail(()=>{
 if(!/^[a-z][a-z0-9_]{1,79}$/.test(body.key)||!['transactional','marketing'].includes(body.classification)||typeof body.is_enabled!=='boolean'||!Number.isInteger(body.version)||body.version<0) throw Error('Invalid email template.')
 const out={key:body.key,classification:body.classification,is_enabled:body.is_enabled,version:body.version,name:emailLine(body.name,100),category:emailLine(body.category,50),sender:body.sender?emailAddress(body.sender):'',reply_to:body.reply_to?emailAddress(body.reply_to):''}
 for(const locale of ['en','ar']){
  out['subject_'+locale]=emailLine(body['subject_'+locale]);out['body_'+locale]=emailBody(body['body_'+locale])
  const values=Object.fromEntries(emailVariables.map(key=>[key,'Sample']))
  renderEmailSource(out['subject_'+locale],values,true);renderEmailSource(out['body_'+locale],values)
 }
 return out
})
