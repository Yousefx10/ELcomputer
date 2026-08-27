import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { PDC_LABEL_BUCKET } from '../../../../utils/pdcShipping'

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
    .select('awb, label_storage_path')
    .eq('order_id', orderId)
    .eq('state', 'ready')
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  if (!job?.label_storage_path) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Shipping label not found.'
    })
  }

  const { data: label, error: downloadError } = await supabaseAdmin.storage
    .from(PDC_LABEL_BUCKET)
    .download(job.label_storage_path)

  if (downloadError || !label) {
    throw createError({
      statusCode: 500,
      statusMessage: downloadError?.message || 'Could not download the shipping label.'
    })
  }

  return new Response(await label.arrayBuffer(), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="PDC-${job.awb || orderId}.pdf"`,
      'cache-control': 'private, no-store'
    }
  })
})
