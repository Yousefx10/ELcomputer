import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('every route keeps exactly one PageView with the shared ID',async()=>{
 const code=await read('app/composables/useMetaTracking.js')
 assert.ok(code.includes('q.disablePushState=true'))
 assert.ok(code.includes('q.allowDuplicatePageViews=true'))
 assert.ok(code.indexOf('q.allowDuplicatePageViews=true')<code.indexOf("createElement('script')"),'Set before the SDK loads')
 assert.ok(code.indexOf('q.disablePushState=true')<code.indexOf("createElement('script')"),'The flag must be set before the SDK loads')
})

test('InitiateCheckout waits for the quote that values it',async()=>{
 const flow=await read('app/composables/useCheckoutFlow.js'),names=await read('app/utils/metaTracking.js')
 assert.doesNotMatch(names,/checkout_started/)
 const quote=flow.indexOf("customerScope.request('/api/checkout/quote'"),event=flow.indexOf("emitMetaEvent('InitiateCheckout'")
 assert.ok(quote>0&&event>quote)
 assert.match(flow,/let metaCheckoutTracked = false/)
})
