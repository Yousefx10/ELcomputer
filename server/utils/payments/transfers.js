import {createError,readMultipartFormData,setHeader} from 'h3'
import {normalizeCheckoutCommand} from '../checkoutCommand'
import {authorizeNormalCheckout} from '../normalPurchase.js'
import {paymentCheckoutRpc} from './checkout.js'
import {readBoundedUpload} from '../uploadRequest'
import {validateTransferContent,saveTransferDocument,readTransferDocument} from '../privateTransferDocuments'
export const manualTransferEnabled=runtime=>runtime.manualTransferEnabled===true||runtime.manualTransferEnabled==='true'
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const fail=(message='Transfer request is unavailable.',statusCode=400)=>{throw createError({statusCode,statusMessage:message})}
export const createTransferCheckout=async({body,user,db,runtime})=>{
 if(!manualTransferEnabled(runtime))fail('InstaPay is unavailable.',503)
 const {cart_revision,cart_lines,...command}=body||{}
 if(!uuid(cart_revision)||!Array.isArray(cart_lines)||!cart_lines.length||cart_lines.length>100)fail('Reload checkout before transferring.',409)
 const {cartId,order,items}=normalizeCheckoutCommand(command,user)
 if(order.payment_method!=='instapay'||!uuid(body.quote_id))fail('Review transfer checkout.',409)
 const context=authorizeNormalCheckout({runtime,user,cartId,order,items,commit:true,quoteId:body.quote_id,signature:body.review_token})
 if(context.scope)fail('This checkout is unavailable.',403)
 return paymentCheckoutRpc(db,'commerce_prepare_transfer_checkout',{p_user_id:user.id,p_cart_id:cartId,p_quote_id:body.quote_id,p_order:order,p_items:items,p_cart_revision:cart_revision,p_cart_lines:cart_lines})
}
const uploads=new Set()
export const submitTransferProof=async(event,{user,db,sessionId})=>{
 if(!uuid(sessionId))fail('Transfer not found.',404)
 if(uploads.size>=2||uploads.has(user.id))fail('Another receipt upload is in progress.',429)
 uploads.add(user.id)
 try{
  const checkout=await paymentCheckoutRpc(db,'commerce_read_payment_checkout',{p_user_id:user.id,p_session_id:sessionId})
  if(!checkout.transfer)fail('Transfer not found.',404)
  await readBoundedUpload(event)
  const parts=await readMultipartFormData(event)
  if(!parts||parts.length!==4||parts.some(p=>!['file','revision','requestId','reference'].includes(p.name))||new Set(parts.map(p=>p.name)).size!==4)fail('Select one receipt and reference.')
  const field=name=>parts.find(p=>p.name===name),file=field('file'),revision=Number(field('revision').data.toString()),requestId=field('requestId').data.toString(),reference=field('reference').data.toString()
  if(!uuid(requestId)||!Number.isSafeInteger(revision)||revision<0||reference.length>120||!file?.filename)fail('Invalid receipt details.')
  const type=String(file.type||'').toLowerCase(),settings=checkout.transfer.recipient
  if(!settings.mime_types.includes(type))fail('This receipt format is not enabled.',415)
  const metadata=await validateTransferContent(file.data,type,settings.max_bytes)
  const proof=await paymentCheckoutRpc(db,'commerce_transfer_reserve_proof',{p_user_id:user.id,p_session_id:sessionId,p_request_id:requestId,p_revision:revision,p_sha256:metadata.sha256,p_size:metadata.size_bytes,p_mime:type})
  await saveTransferDocument(proof,file.data)
  await paymentCheckoutRpc(db,'commerce_transfer_finish_proof',{p_user_id:user.id,p_proof_id:proof.id,p_sha256:metadata.sha256})
  const submission=await paymentCheckoutRpc(db,'commerce_transfer_submit',{p_user_id:user.id,p_session_id:sessionId,p_request_id:requestId,p_revision:revision,p_proof_id:proof.id,p_reference:reference})
  return {submission,checkout:await paymentCheckoutRpc(db,'commerce_read_payment_checkout',{p_user_id:user.id,p_session_id:sessionId})}
 }finally{uploads.delete(user.id)}
}
export const transferProofBytes=async(event,{actor,db,proofId,admin=false,download=false})=>{
 if(!uuid(proofId))fail('Proof not found.',404)
 const proof=await paymentCheckoutRpc(db,'commerce_transfer_read_proof',{p_user_id:actor,p_proof_id:proofId,p_admin:admin})
 const bytes=await readTransferDocument(proof)
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer');setHeader(event,'X-Content-Type-Options','nosniff')
 setHeader(event,'Content-Security-Policy',"sandbox; default-src 'none'");setHeader(event,'Content-Type',proof.mime_type)
 setHeader(event,'Content-Disposition',(download?'attachment':'inline')+'; filename="transfer-receipt.'+(proof.mime_type==='application/pdf'?'pdf':proof.mime_type==='image/png'?'png':'jpg')+'"')
 return bytes
}
export const reviewTransfer=async({db,actor,sessionId,body})=>{
 if(!uuid(sessionId)||!uuid(body?.requestId)||!Number.isSafeInteger(body?.revision)||body.revision<0||!['verify','reject','correct'].includes(body.action)||!body.evidence||Object.keys(body).some(k=>!['requestId','revision','action','evidence'].includes(k)))fail('Invalid transfer review.')
 const e=body.evidence
 if(JSON.stringify(e).length>16000||Object.keys(e).some(k=>!['bank_credit_verified','currency','recipient','recipient_revision','amount_minor','bank_received_at','bank_reference','reason','private_note'].includes(k)))fail('Invalid bank evidence.')
 if(body.action==='verify'){
  if(e.bank_credit_verified!==true||e.currency!=='EGP'||!Number.isSafeInteger(e.amount_minor)||e.amount_minor<=0||!Number.isInteger(e.recipient_revision)||typeof e.bank_reference!=='string'||typeof e.recipient!=='string'||!Number.isFinite(Date.parse(e.bank_received_at)))fail('Verify the actual bank credit.')
  const current=await paymentCheckoutRpc(db,'commerce_transfer_staff_detail',{p_actor:actor,p_session_id:sessionId})
  if(!current?.proofId)fail('Transfer proof is unavailable.',409)
  const proof=await paymentCheckoutRpc(db,'commerce_transfer_read_proof',{p_user_id:actor,p_proof_id:current.proofId,p_admin:true});await readTransferDocument(proof)
 }
 return paymentCheckoutRpc(db,'commerce_transfer_review',{p_actor:actor,p_session_id:sessionId,p_request_id:body.requestId,p_revision:body.revision,p_action:body.action,p_evidence:e})
}
