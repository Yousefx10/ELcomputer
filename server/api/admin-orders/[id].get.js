import { createError, getRouterParam } from 'h3'
import { normalizeAdminOrderItemRecord, normalizeAdminOrderRecord } from '../../utils/adminOrders'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Order id is required.'
    })
  }

  const [
    { data: orderRecord, error: orderError },
    { data: orderItems, error: orderItemsError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle(),
    supabaseAdmin
      .from('customer_order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
  ])

  if (orderError) {
    throw createError({
      statusCode: 500,
      statusMessage: orderError.message
    })
  }

  if (!orderRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found.'
    })
  }

  if (orderItemsError) {
    throw createError({
      statusCode: 500,
      statusMessage: orderItemsError.message
    })
  }

  let serializedUnitsByOrderItem = new Map()
  const serializedOrderItemIds = (orderItems || [])
    .filter((item) => item.variant_id)
    .map((item) => item.id)

  if (serializedOrderItemIds.length) {
    const { data: serializedUnits, error: serializedUnitsError } = await supabaseAdmin
      .from('commerce_serialized_units')
      .select('id, customer_order_item_id, unit_code, status')
      .in('customer_order_item_id', serializedOrderItemIds)
      .order('unit_code')

    if (serializedUnitsError) {
      throw createError({
        statusCode: 500,
        statusMessage: serializedUnitsError.message
      })
    }

    serializedUnitsByOrderItem = (serializedUnits || []).reduce((map, unit) => {
      const key = String(unit.customer_order_item_id)
      const existingUnits = map.get(key) || []
      existingUnits.push(unit)
      map.set(key, existingUnits)
      return map
    }, new Map())
  }

  let customerProfile = null
  let shipping = null
  let preorderPayments = []

  if (orderRecord.is_preorder) {
    const { data, error } = await supabaseAdmin.from('preorder_payments')
      .select('id, amount, reference, method, verified_by, recorded_at')
      .eq('order_id', orderId).order('recorded_at')
    if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load preorder payments.' })
    preorderPayments = data || []
  }

  if (orderRecord.user_id) {
    const { data: customerProfileRecord, error: customerProfileError } = await supabaseAdmin
      .from('customer_profiles')
      .select(`
        id,
        email,
        full_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        wallet_balance
      `)
      .eq('id', orderRecord.user_id)
      .maybeSingle()

    if (customerProfileError) {
      throw createError({
        statusCode: 500,
        statusMessage: customerProfileError.message
      })
    }

    customerProfile = customerProfileRecord || null
  }

  const { data: shippingJob, error: shippingJobError } = await supabaseAdmin
    .from('shipping_order_jobs')
    .select(`
      id,
      provider,
      to_ref,
      normalized_state,
      provider_status_source,
      provider_status_observed_at,
      state,
      awb,
      provider_status_id,
      provider_status_name,
      provider_status_at,
      provider_reason_name,
      label_storage_path,
      attempt_count,
      last_error,
      updated_at
    `)
    .eq('order_id', orderId)
    .maybeSingle()

  if (shippingJobError && !['42P01', 'PGRST205'].includes(shippingJobError.code)) {
    throw createError({
      statusCode: 500,
      statusMessage: shippingJobError.message
    })
  }

  if (shippingJob) {
    shipping = {
      ...shippingJob,
      label_ready: Boolean(shippingJob.label_storage_path)
    }
    const { data: courierEvents, error: eventError } = await supabaseAdmin.from('shipping_webhook_events')
      .select('id,provider_status_id,provider_status_name,status_date,reason_name,normalized_state,source,received_at')
      .eq('provider', shippingJob.provider).eq('order_ref', shippingJob.to_ref).eq('awb', shippingJob.awb || '')
      .not('processed_at', 'is', null).order('received_at', { ascending: false }).limit(200)
    if (eventError) throw createError({ statusCode: 503, statusMessage: 'Courier history is unavailable.' })
    shipping.events = courierEvents || []
    delete shipping.to_ref
    delete shipping.label_storage_path
  }

  return {
    order: normalizeAdminOrderRecord(orderRecord),
    items: (orderItems || []).map((item) => {
      return {
        ...normalizeAdminOrderItemRecord(item),
        serialized_units: serializedUnitsByOrderItem.get(String(item.id)) || []
      }
    }),
    customer: customerProfile,
    shipping,
    preorderPayments
  }
})
