import { createError, getHeader } from 'h3'
import { MAX_IMAGE_BYTES } from './imageContent'

// Bound bytes before H3 parses multipart, including requests without Content-Length.
export const readBoundedUpload = async event => {
  const max=MAX_IMAGE_BYTES+64*1024
  const tooLarge=()=>createError({statusCode:413,statusMessage:'Image size must be 8 MB or smaller.',data:{code:'MEDIA_TOO_LARGE'}})
  if(Number(getHeader(event,'content-length'))>max) throw tooLarge()
  if(event._requestBody) {
    if(!Buffer.isBuffer(event._requestBody)||event._requestBody.length>max) throw tooLarge()
    return
  }
  event._requestBody=await new Promise((resolve,reject)=>{
    let size=0, exceeded=false; const chunks=[]
    event.node.req.on('data',chunk=>{
      size+=chunk.length
      if(size>max) {if(!exceeded){exceeded=true;chunks.length=0;reject(tooLarge())}return}
      if(!exceeded) chunks.push(chunk)
    }).once('end',()=>{if(!exceeded)resolve(Buffer.concat(chunks))}).once('error',reject)
  })
}
