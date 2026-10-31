export const MAX_LABEL_DOWNLOAD_BYTES=5*1024*1024
export const readShippingLabelResponse=async(response,expected)=>{
 if(!response.ok||response.headers.get('content-type')?.split(';')[0].trim()!=='application/pdf')throw Error('Shipping label unavailable')
 const identity={orderId:response.headers.get('x-shipping-order'),jobId:response.headers.get('x-shipping-job'),awb:response.headers.get('x-shipping-awb'),reference:response.headers.get('x-shipping-ref')}
 const digest=response.headers.get('x-label-sha256'),declared=Number(response.headers.get('content-length'))
 if(identity.orderId!==expected.orderId||identity.jobId!==expected.jobId||identity.awb!==expected.awb||!/^[A-Za-z0-9][A-Za-z0-9-]{0,149}$/.test(identity.reference||'')||!/^[a-f0-9]{64}$/.test(digest||'')||!Number.isSafeInteger(declared)||declared<100||declared>MAX_LABEL_DOWNLOAD_BYTES||!response.body)throw Error('Shipping label mismatch')
 const reader=response.body.getReader(),chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_LABEL_DOWNLOAD_BYTES){await reader.cancel();throw Error('Shipping label too large')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 if(size!==declared||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw Error('Shipping label mismatch')
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
 if(actual!==digest)throw Error('Shipping label mismatch')
 return {bytes,identity}
}
