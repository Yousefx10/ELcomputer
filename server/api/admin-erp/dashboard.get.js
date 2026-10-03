import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getDaftraList, getDaftraOverview, unwrapDaftraRecord } from '../../utils/daftra'
import { assertExternalErpDomain } from '../../utils/erpOwnership'

const normalizePage = (value) => Math.max(1, Number(value) || 1)

const normalizeInvoice = (entry) => {
  const invoice = unwrapDaftraRecord(entry, 'Invoice')
  const client = entry?.Client || invoice?.Client || {}

  return {
    id: invoice.id,
    number: invoice.no || '',
    orderNumber: invoice.po_number || '',
    client: invoice.client_business_name || client.business_name || '',
    date: invoice.date || invoice.issue_date || '',
    currency: invoice.currency_code || '',
    total: Number(invoice.summary_total || 0),
    paid: Number(invoice.summary_paid || 0),
    paymentStatus: invoice.payment_status,
    draft: Boolean(Number(invoice.draft ?? 0)),
    einvoiceStatus: invoice.e_invoice_status,
    pdfUrl: invoice.invoice_pdf_url || '',
    htmlUrl: invoice.invoice_html_url || ''
  }
}

const normalizeProduct = (entry) => {
  const product = unwrapDaftraRecord(entry, 'Product')

  return {
    id: product.id,
    name: product.name || '',
    code: product.product_code || '',
    barcode: product.barcode || '',
    price: Number(product.unit_price || 0),
    cost: product.buy_price == null && product.average_price == null ? null : Number(product.buy_price ?? product.average_price),
    stock: product.stock_balance == null ? null : Number(product.stock_balance),
    active: Number(product.status) === 0
  }
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.analysis'
  })
  await assertExternalErpDomain(supabaseAdmin)

  const query = getQuery(event)
  const tab = String(query.tab || 'overview').trim().toLowerCase()
  const page = normalizePage(query.page)

  if (tab === 'overview') {
    const [overview, pendingResult, failedResult] = await Promise.all([
      getDaftraOverview(),
      supabaseAdmin.from('erp_sync_jobs').select('*', { count: 'exact', head: true }).eq('provider', 'daftra').in('status', ['pending', 'processing']),
      supabaseAdmin.from('erp_sync_jobs').select('*', { count: 'exact', head: true }).eq('provider', 'daftra').eq('status', 'failed')
    ])

    if (pendingResult.error || failedResult.error) throw createError({ statusCode: 503, statusMessage: 'Could not load ERP job status.' })
    return {
      tab,
      overview,
      sync: {
        pending: pendingResult.count || 0,
        failed: failedResult.count || 0
      }
    }
  }

  if (tab === 'invoices') {
    const response = await getDaftraList('invoices', {
      page,
      limit: 20,
      recursive: 1,
      sort: 'date',
      direction: 'desc'
    })

    return {
      tab,
      items: (response?.data || []).map(normalizeInvoice),
      pagination: response?.pagination || {}
    }
  }

  if (tab === 'inventory') {
    let remoteError=null
    const response = await getDaftraList('products', {
      page,
      limit: 20,
      with_images: 0
    }).catch(()=>{remoteError='Daftra stock is unavailable. Cached stock remains in use.';return null})

    const { data: lastJob, error: statusError } = await supabaseAdmin.from('erp_sync_jobs')
      .select('id,status,completed_at,last_error,result,updated_at').eq('operation','inventory.import').order('created_at',{ascending:false}).limit(1).maybeSingle()
    const { data: lastSuccess, error: successError } = await supabaseAdmin.from('erp_sync_jobs')
      .select('completed_at').eq('operation','inventory.import').eq('status','completed').order('completed_at',{ascending:false}).limit(1).maybeSingle()
    if(statusError || successError) throw createError({statusCode:503,statusMessage:'Could not load stock refresh status.'})
    return {
      tab,
      inventorySync: { ...lastJob, lastSuccessfulAt:lastSuccess?.completed_at || null },
      remoteAvailable: !remoteError,
      remoteError,
      items: (response?.data || []).map(normalizeProduct),
      pagination: response?.pagination || {}
    }
  }

  if (tab === 'sync') {
    const from = (page - 1) * 20
    const { data, error, count } = await supabaseAdmin
      .from('erp_sync_jobs')
      .select('id, operation, local_id, status, attempts, max_attempts, available_at, completed_at, last_error, result, created_at, updated_at', { count: 'exact' })
      .eq('provider', 'daftra')
      .order('created_at', { ascending: false })
      .range(from, from + 19)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const orderIds = [...new Set((data || []).map((job) => job.local_id))]
    const { data: orders } = orderIds.length
      ? await supabaseAdmin.from('customer_orders').select('id, order_number').in('id', orderIds)
      : { data: [] }
    const orderNumbers = new Map((orders || []).map((order) => [order.id, order.order_number]))

    return {
      tab,
      items: (data || []).map((job) => ({
        ...job,
        orderNumber: orderNumbers.get(job.local_id) || ''
      })),
      pagination: {
        page,
        page_count: Math.max(1, Math.ceil(Number(count || 0) / 20)),
        total_results: count || 0
      }
    }
  }

  throw createError({ statusCode: 400, statusMessage: 'Choose a valid Daftra dashboard tab.' })
})
