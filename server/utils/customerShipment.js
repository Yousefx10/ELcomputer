const unavailableShipment=()=>({provider:'pdc',awb:null,current_state:'unknown',has_update:false,booking_verified:false,unavailable:true,events:[]})
import {createHash} from 'node:crypto'
import {readTrackingMetadata} from './pdcTrackingPolling.js'
import { shipmentReasonKey,shippingStates } from '../../app/utils/shipmentTracking.js'

const resolveState = (id, name, mappings) => {
  if (id != null) return mappings.find(m => m.provider_status_id === id)?.normalized_state || 'unknown'
  const states = new Set(mappings.filter(m => [m.provider_label, ...(m.provider_aliases || [])].some(alias => String(alias).trim().toLowerCase() === String(name || '').trim().toLowerCase())).map(m => m.normalized_state))
  return states.size === 1 ? [...states][0] : 'unknown'
}
export const presentCustomerShipment = (job, events, mappings) => {
  if (!job) return null
  const seen = new Set()
  const history = [...events].sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()).filter(e => {
    const identity = e.provider_status_id != null ? String(e.provider_status_id) : e.event_key
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  }).filter(e=>!['regression','conflict'].includes(e.projection_disposition)).map(e => ({
    id: e.id, state: shippingStates.includes(e.normalized_state)?e.normalized_state:resolveState(e.provider_status_id, e.provider_status_name, mappings),
    status_at: e.status_date, observed_at: e.received_at, source: e.source,
    reason_key: shipmentReasonKey(e.reason_name)
  }))
  return { provider: job.provider, awb: job.awb,
    current_state: shippingStates.includes(job.normalized_state)?job.normalized_state:resolveState(job.provider_status_id, job.provider_status_name, mappings),
    has_update: Boolean(job.provider_status_at || job.provider_status_observed_at || job.provider_status_name),
    status_at: job.provider_status_at, observed_at: job.provider_status_observed_at,
    reason_key: shipmentReasonKey(job.provider_reason_name), source: job.provider_status_source,
    events: history }
}

// Caller must establish customer ownership before using this service-role reader.
export const readCustomerShipment = async (db, ownedOrderId) => {
  const { data: job, error } = await db.from('shipping_order_jobs')
    .select('id,provider,awb,to_ref,normalized_state,provider_status_id,provider_status_name,provider_status_at,provider_status_observed_at,provider_reason_name,provider_status_source')
    .eq('order_id', ownedOrderId).maybeSingle()
  if (error) return unavailableShipment()
  if (!job) return null
  let metadata
  try{metadata=await readTrackingMetadata(db,ownedOrderId)}catch{return unavailableShipment()}
  if(metadata?.booking_verified&&metadata.binding_sha256!==createHash('sha256').update([job.id,ownedOrderId,job.to_ref,job.awb].join('|')).digest('hex'))return unavailableShipment()
  if(!metadata?.booking_verified)return {provider:'pdc',awb:null,current_state:'unknown',has_update:false,booking_verified:false,events:[]}
  const [eventResult, mappingResult] = await Promise.all([
    job.awb ? db.from('shipping_webhook_events')
      .select('id,event_key,provider_status_id,provider_status_name,status_date,reason_name,received_at,source,normalized_state,projection_disposition')
      .eq('provider', job.provider).eq('order_ref', job.to_ref).eq('awb', job.awb).not('processed_at', 'is', null)
      .order('status_date', { ascending: false, nullsFirst: true }).order('received_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    db.from('shipping_status_mappings').select('provider_status_id,provider_label,normalized_state,provider_aliases').eq('provider', job.provider)
  ])
  if (eventResult.error || mappingResult.error) return unavailableShipment()
  return {...presentCustomerShipment(job,eventResult.data||[],mappingResult.data||[]),booking_verified:true,booked_at:metadata.booked_at,last_success_at:metadata.last_success_at,latest_update_at:metadata.latest_update_at,stale:metadata.stale===true}
}
