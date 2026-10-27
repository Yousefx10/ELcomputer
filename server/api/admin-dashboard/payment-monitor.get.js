import {setHeader} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest.js'
import {readPaymentMonitorReport} from '../../utils/paymentMonitorReport.js'

export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store, max-age=0')
 setHeader(event,'Vary','Authorization')
 await requireAdminRequest(event,{permission:'dashboard.orders'})
 return {monitor:await readPaymentMonitorReport(useRuntimeConfig(event).paymentMonitorReportPath)}
})
