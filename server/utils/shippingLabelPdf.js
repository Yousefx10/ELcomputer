import { Worker } from 'node:worker_threads'
import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import { createError } from 'h3'

export const MAX_LABEL_BYTES = 5 * 1024 * 1024
const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const token = /^[A-Za-z0-9][A-Za-z0-9-]{0,149}$/
export const shippingLabelIdentity = job => {
  if (!job || typeof job.awb !== 'string' || typeof job.to_ref !== 'string' || job.provider !== 'pdc' || !id.test(job.id || '') || !id.test(job.order_id || '')
    || !token.test(job.awb || '') || job.awb.length > 100 || !token.test(job.to_ref || '')) throw unavailable()
  return { orderId: job.order_id, jobId: job.id, awb: job.awb, reference: job.to_ref }
}
const unavailable = () => createError({ statusCode: 503, statusMessage: 'The shipping label is unavailable.', data: { code: 'SHIPPING_LABEL_UNAVAILABLE' } })
let active = 0
// Fixed trusted worker code; PDF content is data only. No runtime credentials or
// network resources are passed. Parsing is bounded independently of the web loop.
const parser = String.raw`
import {parentPort,workerData} from 'node:worker_threads'
globalThis.fetch=()=>{throw Error('External resources disabled')}
globalThis.DOMMatrix=(await import(workerData.matrix)).default
const {getDocument,GlobalWorkerOptions}=await import(workerData.parser)
GlobalWorkerOptions.workerSrc=workerData.worker
const hasRecords=x=>x instanceof Map?x.size>0:!!x&&Object.keys(x).length>0
const contains=(text,value)=>{
 const expression=[...value.normalize('NFKC')].join('[\\t\\r\\n ]*')
 return new RegExp('(?:^|[^A-Za-z0-9-])'+expression+'(?:$|[^A-Za-z0-9-])').test(text.normalize('NFKC'))
}
let task
try{
 task=getDocument({data:workerData.bytes,stopAtErrors:true,isEvalSupported:false,useWorkerFetch:false,useWasm:false,disableFontFace:true,useSystemFonts:false,disableAutoFetch:true,disableStream:true,enableXfa:false,maxImageSize:10000000,verbosity:0})
 const doc=await task.promise
 if(doc.numPages<1||doc.numPages>4||await doc.hasJSActions()||hasRecords(await doc.getAttachments())||hasRecords(await doc.getFieldObjects()))throw Error('Invalid label')
 const pages=[]
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),view=page.getViewport({scale:1})
  if(!Number.isFinite(view.width)||!Number.isFinite(view.height)||view.width<10||view.height<10||view.width>1500||view.height>1500||hasRecords(await page.getJSActions())||(await page.getAnnotations({intent:'any'})).length)throw Error('Invalid page')
  const content=await page.getTextContent(),text=content.items.map(x=>x.str||'').join('\n')
  if(content.items.length>4000||text.length>65536||!contains(text,workerData.identity.awb)||!contains(text,workerData.identity.reference))throw Error('Wrong shipment')
  pages.push({width:view.width,height:view.height});page.cleanup()
 }
 parentPort.postMessage({ok:true,pages})
}catch{parentPort.postMessage({ok:false})}
finally{await task?.destroy()}
`
export const validateShippingLabelPdf = async (bytes, identity) => {
  if (!Buffer.isBuffer(bytes) || bytes.length < 100 || bytes.length > MAX_LABEL_BYTES
    || !/^%PDF-[12]\.\d[\r\n]/.test(bytes.subarray(0, 12).toString('ascii'))
    || !/%%EOF\s*$/.test(bytes.subarray(-1024).toString('ascii'))
    || !token.test(identity?.awb || '') || !token.test(identity?.reference || '') || active >= 2) throw unavailable()
  active++
  let worker
  try {
    const require=createRequire(import.meta.url),pdfRoot=dirname(require.resolve('pdfjs-dist/package.json')),matrixRoot=dirname(require.resolve('@thednp/dommatrix/package.json'))
    const data = new Uint8Array(bytes)
    worker = new Worker(new URL('data:text/javascript;base64,' + Buffer.from(parser).toString('base64')), {
      workerData: { bytes: data, identity: { awb: identity.awb, reference: identity.reference },
        matrix: pathToFileURL(join(matrixRoot,'dist/dommatrix.mjs')).href, parser: pathToFileURL(join(pdfRoot,'legacy/build/pdf.mjs')).href, worker: pathToFileURL(join(pdfRoot,'legacy/build/pdf.worker.mjs')).href },
      transferList: [data.buffer], env: { NODE_ENV: 'production' }, stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }
    })
    worker.stdout.resume(); worker.stderr.resume()
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(unavailable()), 6000)
      const stop = () => { clearTimeout(timer); reject(unavailable()) }
      worker.once('error', stop); worker.once('exit', code => { if (code !== 0) stop() })
      worker.once('message', result => { clearTimeout(timer); if (result?.ok === true && result.pages?.length) resolve({ pages: result.pages }); else reject(unavailable()) })
    })
  } catch { throw unavailable() }
  finally { await worker?.terminate().catch(() => {}); active-- }
}
