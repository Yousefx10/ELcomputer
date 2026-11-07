import { createError } from 'h3'
import { getPdcSettings } from './pdcShipping.js'
import { processPdcOrderJob } from './pdcOrderShipping.js'

// Owner request 7 Nov 2026: paid (and optionally COD) orders get their PDC AWB without a
// review step when Settings → Order flow says Automatic. The database decides which
// orders qualify; this worker books at most `limit` orders per run.
const safeMessage = error => String(error?.message || error?.statusMessage || '').replace(/\d{5,}/g, '#').slice(0, 200) || 'Automatic booking could not start.'

export async function processAutoCourier({ db, runtime = useRuntimeConfig(), fetcher = fetch, limit = 1 } = {}) {
  const summary = { active: false, booked: 0, waiting: 0, rejected: 0, uncertain: 0 }
  // Same server gate as staff "Book with PDC": live courier requests or the manual COD route.
  if (runtime.shippingLiveRequestsEnabled !== true && ![true, 'true'].includes(runtime.pdcManualCodEnabled)) return summary
  summary.active = true
  const due = await db.rpc('orders_due_for_auto_courier', { p_limit: limit })
  if (due.error) throw createError({ statusCode: 503, statusMessage: 'Order flow is unavailable.' })
  const ids = Array.isArray(due.data) ? due.data.filter(id => typeof id === 'string') : []
  if (!ids.length) return summary
  const settings = await getPdcSettings(db)
  const live = { ...runtime, shippingLiveRequestsEnabled: true }
  const note = (orderId, error) => db.rpc('order_auto_courier_record', { p_order: orderId, p_error: error })
  for (const orderId of ids) {
    const prepared = await db.rpc('shipping_order_prepare_auto', { p_order: orderId })
    if (prepared.error || !prepared.data?.id) { await note(orderId, safeMessage(prepared.error)); summary.waiting++; continue }
    await note(orderId, null)
    if (prepared.data.awb) { summary.booked++; continue }
    try {
      const result = await processPdcOrderJob({ supabaseAdmin: db, settings, jobId: prepared.data.id, fetcher, runtime: live })
      if (result?.state === 'rejected') summary.rejected++
      else if (result?.state === 'uncertain') summary.uncertain++
      else if (['ready', 'label_pending'].includes(result?.state)) summary.booked++
    } catch (error) {
      // The job stays visible on the order page; staff can book or attach a portal AWB.
      await note(orderId, safeMessage(error)); summary.waiting++
    }
  }
  return summary
}
