// Offline replay may reach owned loopback fixtures only, including native SQL.
// Provider responses must enter through explicit test doubles.
import net from 'node:net'
import {syncBuiltinESMExports} from 'node:module'
const local=host=>['127.0.0.1','::1','localhost'].includes(host)
const originalConnect=net.Socket.prototype.connect
net.Socket.prototype.connect=function(...args){
 const first=Array.isArray(args[0])?args[0][0]:args[0]
 const options=first&&typeof first==='object'?first:null
 const host=options?.host??(typeof args[1]==='string'?args[1]:'localhost')
 if(!options?.path&&!local(host))throw new Error('Offline PDC replay refused a non-loopback connection.')
 return originalConnect.apply(this,args)
}
const originalFetch=globalThis.fetch
globalThis.fetch=(input,options)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
 if(!local(url.hostname))throw new Error('Offline PDC replay requires a provider fixture.')
 return originalFetch(input,options)
}
syncBuiltinESMExports()
