import {constants,promises as fs} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {join,dirname} from 'node:path'
import {createError} from 'h3'
import {getShippingDocumentsRoot} from './privateShippingDocuments.js'
import {validateImageContent} from './imageContent.js'
import {validatePrivateReceiptPdf} from './shippingLabelPdf.js'
export const MAX_TRANSFER_BYTES=5*1024*1024
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const pattern=new RegExp('^transfers-v1/'+uuid+'/'+uuid+'/'+uuid+'\\.(jpg|png|pdf)$')
const fail=()=>{throw createError({statusCode:503,statusMessage:'Private receipt is unavailable.'})}
const statSafe=(s,dir=false)=>{if(s.isSymbolicLink()||!(dir?s.isDirectory():s.isFile())||s.mode&0o077||typeof process.getuid==='function'&&s.uid!==process.getuid()||!dir&&s.nlink!==1)fail()}
const directory=async p=>{if(await fs.realpath(p)!==p)fail();statSafe(await fs.lstat(p),true)}
const sync=async p=>{const h=await fs.open(p,constants.O_RDONLY|constants.O_NOFOLLOW);try{await h.sync()}finally{await h.close()}}
const location=async(key,create)=>{
 if(typeof key!=='string'||!pattern.test(key))fail()
 const config=useRuntimeConfig();let parent=await getShippingDocumentsRoot({create,configuredRoot:config.transferDocumentsDir||null})
 for(const part of key.split('/').slice(0,-1)){parent=join(parent,part);if(create){await fs.mkdir(parent,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e});await sync(dirname(parent))}await directory(parent)}
 return {path:join(parent,key.split('/').at(-1)),parent}
}
export const validateTransferContent=async(bytes,mime,maxBytes=MAX_TRANSFER_BYTES)=>{
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>Math.min(MAX_TRANSFER_BYTES,maxBytes)||!['image/png','image/jpeg','application/pdf'].includes(mime))throw createError({statusCode:415,statusMessage:'Use a supported receipt image or PDF.'})
 try{if(mime==='application/pdf')await validatePrivateReceiptPdf(bytes);else validateImageContent(bytes,mime)}catch{throw createError({statusCode:415,statusMessage:'The receipt file is invalid.'})}
 return {sha256:createHash('sha256').update(bytes).digest('hex'),size_bytes:bytes.length,mime_type:mime}
}
export const readTransferDocument=async evidence=>{
 if(!/^[a-f0-9]{64}$/.test(evidence?.sha256||'')||!Number.isSafeInteger(Number(evidence?.size_bytes))||Number(evidence.size_bytes)>MAX_TRANSFER_BYTES)fail()
 let file
 try{
  const {path}=await location(evidence.path,false);file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  const before=await file.stat();statSafe(before)
  if(before.size!==Number(evidence.size_bytes)||before.size<1)fail()
  const bytes=await file.readFile(),after=await file.stat()
  if(before.ino!==after.ino||before.dev!==after.dev||before.mtimeMs!==after.mtimeMs||createHash('sha256').update(bytes).digest('hex')!==evidence.sha256)fail()
  return bytes
 }catch{fail()}finally{await file?.close()}
}
export const saveTransferDocument=async(evidence,bytes)=>{
 const digest=createHash('sha256').update(bytes).digest('hex')
 if(digest!==evidence.sha256||bytes.length!==Number(evidence.size_bytes))fail()
 const {path,parent}=await location(evidence.path,true),temporary=join(parent,'.'+randomUUID()+'.pending');let file
 try{
  file=await fs.open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await file.writeFile(bytes);await file.sync();await file.close();file=null
  try{await fs.link(temporary,path)}catch(e){if(e.code!=='EEXIST')throw e;await readTransferDocument(evidence)}
  await fs.unlink(temporary);await sync(parent)
 }catch{fail()}finally{await file?.close();await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')fail()})}
 return evidence
}
