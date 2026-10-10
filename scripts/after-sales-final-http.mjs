// Built Nuxt guards only. Use a local server with fictional runtime values.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const origin=new URL(process.env.AFTER_SALES_FINAL_LOCAL_URL||'http://127.0.0.1:3189')
assert.ok(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))
const id='11111111-1111-4111-8111-111111111111',checks=[
 ['/api/account/after-sales/items','GET'],['/api/account/after-sales/claims','GET'],['/api/account/after-sales/claims','POST'],
 ['/api/account/after-sales/claims/'+id,'GET'],['/api/account/after-sales/claims/'+id+'/actions','POST'],['/api/account/after-sales/claims/'+id+'/reverse','GET'],
 ['/api/account/after-sales/items/'+id+'/evidence','POST'],['/api/account/after-sales/evidence/'+id,'GET'],['/api/account/after-sales/evidence/'+id,'DELETE'],
 ['/api/admin-after-sales/claims','GET'],['/api/admin-after-sales/claims/'+id,'GET'],['/api/admin-after-sales/claims/'+id+'/actions','POST'],
 ['/api/admin-after-sales/claims/'+id+'/reverse','GET'],['/api/admin-after-sales/claims/'+id+'/reverse','POST'],['/api/admin-after-sales/claims/'+id+'/reverse-actions','POST'],
 ['/api/admin-after-sales/claims/'+id+'/reverse-label?job_id='+id,'GET'],['/api/admin-after-sales/claims/evidence/'+id,'GET'],
 ['/api/admin-after-sales/communications','GET'],['/api/admin-after-sales/communications','POST'],['/api/admin-after-sales/claims/'+id+'/communications','GET'],
 ['/api/admin-email/settings','GET'],['/api/admin-email/history','GET'],['/api/admin-sms/settings','GET'],['/api/admin-sms/history','GET'],
 ['/api/internal/shipping/process','POST'],['/api/internal/sms/process','POST'],['/api/internal/email/process','POST'],['/api/webhooks/pdc','POST']
]
let assertions=0
for(const[path,method]of checks){
 const response=await fetch(new URL(path,origin),{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(path.endsWith('/reverse-actions')?{action:'label',job_id:id}:{})}:{})})
 assert.equal(response.status,401,path);assertions++
 const body=await response.text();assert.doesNotMatch(body,/final-http-(?:service|master|worker)-fixture/,path);assertions++
 if(path.includes('after-sales')||path.includes('admin-email')||path.includes('admin-sms')){assert.equal(response.headers.get('cache-control'),'private, no-store',path);assertions++}
}
const report={requests:checks.length,assertions,productionAccess:false,realProviderCalls:0,scope:'Built localhost Nuxt anonymous API/worker guards; no authenticated acceptance claim.'}
await writeFile('/private/tmp/after-sales-final-http.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
