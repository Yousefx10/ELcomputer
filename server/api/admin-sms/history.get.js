import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.history.view' })
  const query = getQuery(event)
  const page = Math.min(10000, Math.max(1, Math.floor(Number(query.page) || 1)))
  const { data, error, count } = await supabaseAdmin.from('sms_batches')
    .select('id,traffic_type,triggered_by,trigger_source,template_id,external_trx_id,status,attempts,result_status,error_code,failure_category,created_at,submitted_at,sms_messages(id,position,recipient,sender,encoding,segments,status,provider_status,error_code,failure_category,submitted_at),sms_attempts(attempt_number,status,result_status,error_code,failure_category,started_at,finished_at)', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * 25, page * 25 - 1)
  if (error) throw createError({ statusCode: 503, statusMessage: 'SMS history is unavailable.' })
  const { data: orderEvents, error: orderError, count: orderCount } = await supabaseAdmin.from('sms_order_events')
    .select('id,order_number,shipment_awb,provider_event_at,event_type,locale,template_id,sender,recipient_masked,status,reason,batch_id,created_at,updated_at,sms_batches(id,external_trx_id,status,attempts,result_status,error_code,failure_category,submitted_at,sms_messages(encoding,units,segments,provider_status,error_code))', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * 25, page * 25 - 1)
  if (orderError) throw createError({ statusCode: 503, statusMessage: 'SMS history is unavailable.' })
  // History permission allows diagnostics, not retrieval of customer message text.
  return { page, total: count || 0, orderTotal: orderCount || 0, orderEvents: orderEvents || [], batches: (data || []).map(batch => ({ ...batch,
    sms_messages: batch.sms_messages.map(message => ({ ...message, recipient: message.recipient.slice(0, 4) + '••••••' + message.recipient.slice(-3) })) })) }
}))
