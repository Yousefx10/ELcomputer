import {createError} from 'h3'
import {readShippingDocument} from './privateShippingDocuments.js'
import {shippingLabelIdentity,validateShippingLabelPdf} from './shippingLabelPdf.js'

const fields='id,order_id,provider,to_ref,state,awb,label_storage_path,label_sha256,label_size_bytes'
const unavailable=()=>createError({statusCode:503,statusMessage:'The shipping label is unavailable.',data:{code:'SHIPPING_LABEL_UNAVAILABLE'}})
export const loadShippingLabel = async ({db,orderId,authorize=async()=>{},readDocument=readShippingDocument,validatePdf=validateShippingLabelPdf}) => {
 const query=()=>db.from('shipping_order_jobs').select(fields).eq('order_id',orderId).eq('provider','pdc').eq('state','ready').maybeSingle()
 const {data:job,error}=await query()
 if(error)throw unavailable()
 if(!job)throw createError({statusCode:404,statusMessage:'The shipping label is not ready.'})
 const identity=shippingLabelIdentity(job)
 if(identity.orderId!==orderId||job.state!=='ready'||job.label_storage_path!==`vps-v1/orders/${identity.orderId}/${identity.jobId}.pdf`
  || !/^[a-f0-9]{64}$/.test(job.label_sha256||''))throw unavailable()
 let bytes,pdf
 try{bytes=await readDocument({path:job.label_storage_path,sha256:job.label_sha256,size_bytes:job.label_size_bytes});pdf=await validatePdf(bytes,identity)}catch{throw unavailable()}
 // Permission and saved identity must still hold after asynchronous file/PDF work.
 await authorize()
 const current=await query()
 if(current.error||!current.data||fields.split(',').some(k=>String(current.data[k]??'')!==String(job[k]??'')))throw unavailable()
 return {bytes,identity,pages:pdf.pages,sha256:job.label_sha256}
}
