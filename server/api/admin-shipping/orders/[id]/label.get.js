import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { readShippingDocument } from '../../../../utils/privateShippingDocuments.js'

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

  const { data: job, error } = await supabaseAdmin
    .from('shipping_order_jobs')
    .select('id,order_id,awb,label_storage_path,label_sha256,label_size_bytes')
    .eq('order_id', orderId)
    .eq('state', 'ready')
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Shipping label is unavailable.'
    })
  }

  if (!job?.label_sha256 || job.label_storage_path !== `vps-v1/orders/${job.order_id}/${job.id}.pdf`) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shipping label not found.'
    })
  }

  const bytes = await readShippingDocument({ path: job.label_storage_path, sha256: job.label_sha256, size_bytes: job.label_size_bytes })
  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'",
      'content-disposition': `attachment; filename="PDC-${job.awb || orderId}.pdf"`,
      'cache-control': 'private, no-store'
    }
  })
})
