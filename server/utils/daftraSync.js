import { createError } from 'h3'
import {
  daftraRequest,
  getDaftraConnectionSummary,
  unwrapDaftraRecord
} from './daftra'

const ISSUABLE_ORDER_STATUSES = new Set([
  'processing',
  'in_progress',
  'being_shipped',
  'out_for_delivery',
  'completed',
  'delivered'
])

export const isMissingDaftraSchemaError = (error) => {
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205']
    .includes(error?.code)
}

export const getErpSettings = async (supabaseAdmin) => {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('erp_mode, daftra_connection_status, daftra_last_checked_at, daftra_connected_at, daftra_connection_error')
    .eq('key', 'default')
    .maybeSingle()

  if (error) {
    if (isMissingDaftraSchemaError(error)) {
      return {
        erp_mode: 'built_in',
        daftra_connection_status: 'disconnected',
        migrationRequired: true
      }
    }

    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    erp_mode: data?.erp_mode || 'built_in',
    daftra_connection_status: data?.daftra_connection_status || 'disconnected',
    daftra_last_checked_at: data?.daftra_last_checked_at || null,
    daftra_connected_at: data?.daftra_connected_at || null,
    daftra_connection_error: data?.daftra_connection_error || null,
    migrationRequired: false
  }
}

export const testAndRecordDaftraConnection = async (supabaseAdmin) => {
  const checkedAt = new Date().toISOString()

  try {
    const summary = await getDaftraConnectionSummary()
    const { error } = await supabaseAdmin
      .from('site_settings')
      .update({
        daftra_connection_status: 'connected',
        daftra_last_checked_at: checkedAt,
        daftra_connected_at: checkedAt,
        daftra_connection_error: null,
        updated_at: checkedAt
      })
      .eq('key', 'default')

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return { ...summary, checkedAt }
  } catch (error) {
    const message = String(error?.statusMessage || error?.message || 'Connection failed.').slice(0, 500)

    await supabaseAdmin
      .from('site_settings')
      .update({
        daftra_connection_status: 'error',
        daftra_last_checked_at: checkedAt,
        daftra_connection_error: message,
        updated_at: checkedAt
      })
      .eq('key', 'default')

    throw error
  }
}

const getEntityLink = async (supabaseAdmin, localEntityType, localId) => {
  const { data, error } = await supabaseAdmin
    .from('erp_entity_links')
    .select('*')
    .eq('provider', 'daftra')
    .eq('local_entity_type', localEntityType)
    .eq('local_id', localId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data || null
}

const saveEntityLink = async (supabaseAdmin, link) => {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('erp_entity_links')
    .upsert({
      provider: 'daftra',
      ...link,
      last_synced_at: now,
      updated_at: now
    }, {
      onConflict: 'provider,local_entity_type,local_id'
    })
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
}

const findExactDaftraRecord = (response, wrapper, predicate) => {
  return (response?.data || [])
    .map((entry) => unwrapDaftraRecord(entry, wrapper))
    .find(predicate) || null
}

const ensureDaftraClient = async (supabaseAdmin, order) => {
  const existingLink = await getEntityLink(supabaseAdmin, 'customer_profile', order.user_id)

  if (existingLink) {
    return existingLink
  }

  const normalizedEmail = String(order.email || '').trim().toLowerCase()
  let client = null

  if (normalizedEmail) {
    const searchResponse = await daftraRequest('/clients.json', {
      query: { keywords: normalizedEmail, limit: 100, page: 1 }
    })

    client = findExactDaftraRecord(
      searchResponse,
      'Client',
      (record) => String(record.email || '').trim().toLowerCase() === normalizedEmail
    )
  }

  if (!client) {
    const response = await daftraRequest('/clients.json', {
      method: 'POST',
      body: {
        Client: {
          business_name: [order.first_name, order.last_name].filter(Boolean).join(' ') || normalizedEmail || 'Website customer',
          first_name: order.first_name || '',
          last_name: order.last_name || '',
          email: normalizedEmail || undefined,
          phone1: order.phone || '',
          address1: order.street_address || '',
          city: order.city || '',
          state: order.governorate || '',
          country_code: 'EG',
          default_currency_code: order.currency || 'EGP',
          notes: 'Created by ELcomputer website.'
        }
      }
    })

    client = {
      id: response?.id,
      client_number: response?.client_number || null
    }
  }

  if (!client?.id) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Daftra did not return a client ID.'
    })
  }

  return saveEntityLink(supabaseAdmin, {
    local_entity_type: 'customer_profile',
    local_id: order.user_id,
    external_entity_type: 'client',
    external_id: String(client.id),
    external_number: client.client_number ? String(client.client_number) : null,
    metadata: { matchedBy: normalizedEmail ? 'email' : 'created' }
  })
}

const getOrderCatalog = async (supabaseAdmin, items) => {
  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))]
  const variantIds = [...new Set(items.map((item) => item.variant_id).filter(Boolean))]
  const [productsResult, variantsResult] = await Promise.all([
    productIds.length
      ? supabaseAdmin
          .from('products')
          .select('id, title, description, price, cost_price, stock_quantity, sku')
          .in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    variantIds.length
      ? supabaseAdmin
          .from('product_variants')
          .select('id, product_id, name, code, sku, price, cost_price, stock_quantity')
          .in('id', variantIds)
      : Promise.resolve({ data: [], error: null })
  ])
  const error = productsResult.error || variantsResult.error

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    products: new Map((productsResult.data || []).map((product) => [product.id, product])),
    variants: new Map((variantsResult.data || []).map((variant) => [variant.id, variant]))
  }
}

const ensureDaftraProduct = async (supabaseAdmin, item, catalog) => {
  const variant = item.variant_id ? catalog.variants.get(item.variant_id) : null
  const product = catalog.products.get(item.product_id)
  const localId = variant?.id || product?.id || item.product_id
  const localEntityType = variant ? 'product_variant' : 'product'
  const existingLink = await getEntityLink(supabaseAdmin, localEntityType, localId)

  if (existingLink) {
    return existingLink
  }

  const code = String(
    variant?.sku
    || variant?.code
    || product?.sku
    || `WEB-${String(localId).replace(/-/g, '').slice(0, 24)}`
  ).trim()
  const name = [product?.title || item.product_title, variant?.name]
    .filter(Boolean)
    .join(' - ')
  const searchResponse = await daftraRequest('/products.json', {
    query: { product_code: code, limit: 100, page: 1 }
  })
  let daftraProduct = findExactDaftraRecord(
    searchResponse,
    'Product',
    (record) => String(record.product_code || '').trim().toLowerCase() === code.toLowerCase()
  )

  if (!daftraProduct) {
    const response = await daftraRequest('/products.json', {
      method: 'POST',
      body: {
        Product: {
          name: name || 'Website product',
          description: product?.description || '',
          product_code: code,
          type: 1,
          status: 0,
          deactivate: 0,
          unit_price: Number(item.unit_price || variant?.price || product?.price || 0),
          buy_price: Number(variant?.cost_price || product?.cost_price || 0),
          track_stock: 1,
          initial_stock_level: Number(variant?.stock_quantity ?? product?.stock_quantity ?? 0)
        }
      }
    })

    daftraProduct = { id: response?.id, product_code: code }
  }

  if (!daftraProduct?.id) {
    throw createError({
      statusCode: 502,
      statusMessage: `Daftra did not return a product ID for ${name || code}.`
    })
  }

  return saveEntityLink(supabaseAdmin, {
    local_entity_type: localEntityType,
    local_id: localId,
    external_entity_type: 'product',
    external_id: String(daftraProduct.id),
    external_number: code,
    metadata: { productId: item.product_id, variantId: item.variant_id || null }
  })
}

const getDaftraInvoiceByOrderNumber = async (orderNumber) => {
  const response = await daftraRequest('/invoices.json', {
    query: { po_number: orderNumber, recursive: 1, limit: 100, page: 1 }
  })

  return findExactDaftraRecord(
    response,
    'Invoice',
    (record) => String(record.po_number || '').trim() === String(orderNumber).trim()
  )
}

const loadOrderForDaftra = async (supabaseAdmin, orderId) => {
  const [orderResult, itemsResult] = await Promise.all([
    supabaseAdmin.from('customer_orders').select('*').eq('id', orderId).maybeSingle(),
    supabaseAdmin
      .from('customer_order_items')
      .select('id, order_id, product_id, variant_id, product_title, unit_price, quantity, line_total')
      .eq('order_id', orderId)
      .order('created_at')
  ])
  const error = orderResult.error || itemsResult.error

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!orderResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'The website order no longer exists.' })
  }

  if (!itemsResult.data?.length) {
    throw createError({ statusCode: 409, statusMessage: 'The website order has no items.' })
  }

  return { order: orderResult.data, items: itemsResult.data }
}

export const syncOrderToDaftra = async (supabaseAdmin, orderId) => {
  const { order, items } = await loadOrderForDaftra(supabaseAdmin, orderId)
  const clientLink = await ensureDaftraClient(supabaseAdmin, order)
  const catalog = await getOrderCatalog(supabaseAdmin, items)
  const productLinks = []

  for (const item of items) {
    productLinks.push(await ensureDaftraProduct(supabaseAdmin, item, catalog))
  }

  let invoiceLink = await getEntityLink(supabaseAdmin, 'customer_order', order.id)
  let invoice = invoiceLink
    ? await daftraRequest(`/invoices/${encodeURIComponent(invoiceLink.external_id)}.json`)
        .then((response) => unwrapDaftraRecord(response?.data, 'Invoice'))
        .catch(() => null)
    : await getDaftraInvoiceByOrderNumber(order.order_number)

  if (!invoice?.id && !invoiceLink) {
    const shouldIssue = ISSUABLE_ORDER_STATUSES.has(order.status)
    const created = await daftraRequest('/invoices.json', {
      method: 'POST',
      body: {
        Invoice: {
          client_id: Number(clientLink.external_id),
          po_number: order.order_number,
          name: `Website order ${order.order_number}`,
          currency_code: order.currency || 'EGP',
          date: String(order.created_at || new Date().toISOString()).slice(0, 10),
          issue_date: String(order.created_at || new Date().toISOString()).slice(0, 10),
          draft: !shouldIssue,
          discount: Number(order.discount_amount || 0),
          notes: `ELcomputer website order ${order.order_number}. Payment method: ${order.payment_method || 'not selected'}. Shipping: ${order.shipping_method || 'not selected'}.`
        },
        InvoiceItem: items.map((item, index) => ({
          item: item.product_title,
          unit_price: Number(item.unit_price || 0),
          quantity: Number(item.quantity || 0),
          product_id: Number(productLinks[index].external_id),
          discount: 0,
          discount_type: 2
        }))
      }
    })

    invoice = { id: created?.id, no: created?.invoice_number || null, draft: !shouldIssue }
  }

  if (!invoice?.id) {
    throw createError({ statusCode: 502, statusMessage: 'Daftra did not return an invoice ID.' })
  }

  invoiceLink = await saveEntityLink(supabaseAdmin, {
    local_entity_type: 'customer_order',
    local_id: order.id,
    external_entity_type: 'invoice',
    external_id: String(invoice.id),
    external_number: invoice.no ? String(invoice.no) : invoiceLink?.external_number || null,
    metadata: {
      orderNumber: order.order_number,
      websiteStatus: order.status,
      daftraDraft: Boolean(invoice.draft)
    }
  })

  if (ISSUABLE_ORDER_STATUSES.has(order.status) && Boolean(invoice.draft)) {
    await daftraRequest(`/invoices/update_draft/${encodeURIComponent(invoice.id)}/0.json`)

    invoiceLink = await saveEntityLink(supabaseAdmin, {
      ...invoiceLink,
      metadata: {
        ...(invoiceLink.metadata || {}),
        daftraDraft: false,
        issuedFromWebsiteStatus: order.status
      }
    })
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    daftraInvoiceId: invoiceLink.external_id,
    daftraInvoiceNumber: invoiceLink.external_number,
    clientId: clientLink.external_id,
    productCount: productLinks.length
  }
}

export const processNextDaftraJob = async (supabaseAdmin, jobId = null) => {
  const { data, error } = await supabaseAdmin.rpc('claim_daftra_sync_job', {
    p_job_id: jobId || null
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const job = Array.isArray(data) ? data[0] : data

  if (!job) {
    return { processed: false, job: null }
  }

  try {
    if (job.operation !== 'order.export') {
      throw createError({ statusCode: 400, statusMessage: 'Unsupported Daftra sync operation.' })
    }

    const result = await syncOrderToDaftra(supabaseAdmin, job.local_id)
    const completedAt = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('erp_sync_jobs')
      .update({
        status: 'completed',
        result,
        completed_at: completedAt,
        locked_at: null,
        last_error: null,
        updated_at: completedAt
      })
      .eq('id', job.id)

    if (updateError) {
      throw createError({ statusCode: 500, statusMessage: updateError.message })
    }

    return { processed: true, job: { ...job, status: 'completed', result } }
  } catch (error) {
    const attempts = Number(job.attempts || 1)
    const retryDelaySeconds = Math.min(3600, 30 * (2 ** Math.min(attempts, 7)))
    const availableAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString()
    const message = String(error?.statusMessage || error?.message || 'Daftra synchronization failed.').slice(0, 1000)

    await supabaseAdmin
      .from('erp_sync_jobs')
      .update({
        status: 'failed',
        available_at: availableAt,
        locked_at: null,
        last_error: message,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)

    throw error
  }
}

export const retryDaftraJob = async (supabaseAdmin, jobId) => {
  const { data, error } = await supabaseAdmin
    .from('erp_sync_jobs')
    .update({
      status: 'pending',
      attempts: 0,
      available_at: new Date().toISOString(),
      locked_at: null,
      completed_at: null,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq('provider', 'daftra')
    .eq('id', jobId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Sync job not found.' })
  }

  return data
}

const loadAllDaftraProducts = async () => {
  const products = []
  let page = 1
  let pageCount = 1

  do {
    const response = await daftraRequest('/products.json', {
      query: { limit: 100, page, with_images: 0 }
    })

    products.push(...(response?.data || []).map((entry) => unwrapDaftraRecord(entry, 'Product')))
    pageCount = Math.max(1, Number(response?.pagination?.page_count || 1))
    page += 1
  } while (page <= pageCount && page <= 500)

  return products
}

export const syncInventoryFromDaftra = async (supabaseAdmin) => {
  const [daftraProducts, productsResult, variantsResult, linksResult] = await Promise.all([
    loadAllDaftraProducts(),
    supabaseAdmin.from('products').select('id, sku').limit(10000),
    supabaseAdmin.from('product_variants').select('id, product_id, sku, code').eq('is_active', true).limit(10000),
    supabaseAdmin
      .from('erp_entity_links')
      .select('*')
      .eq('provider', 'daftra')
      .eq('external_entity_type', 'product')
      .in('local_entity_type', ['product', 'product_variant'])
  ])
  const error = productsResult.error || variantsResult.error || linksResult.error

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const normalizeCode = (value) => String(value || '').trim().toLowerCase()
  const productByCode = new Map()
  const variantByCode = new Map()
  const linkByExternalId = new Map((linksResult.data || []).map((link) => [String(link.external_id), link]))

  for (const product of productsResult.data || []) {
    const code = normalizeCode(product.sku)
    if (code && !productByCode.has(code)) productByCode.set(code, product)
  }

  for (const variant of variantsResult.data || []) {
    const code = normalizeCode(variant.sku || variant.code)
    if (code && !variantByCode.has(code)) variantByCode.set(code, variant)
  }

  let updated = 0
  let unmatched = 0
  const failures = []

  for (const daftraProduct of daftraProducts) {
    const externalId = String(daftraProduct.id || '')
    const code = normalizeCode(daftraProduct.product_code)
    const existingLink = linkByExternalId.get(externalId)
    const matchedVariant = existingLink?.local_entity_type === 'product_variant'
      ? { id: existingLink.local_id }
      : variantByCode.get(code)
    const matchedProduct = existingLink?.local_entity_type === 'product'
      ? { id: existingLink.local_id }
      : productByCode.get(code)
    const localRecord = matchedVariant || matchedProduct
    const localEntityType = matchedVariant ? 'product_variant' : 'product'

    if (!localRecord?.id) {
      unmatched += 1
      continue
    }

    const updatePayload = {
      stock_quantity: Math.max(0, Math.trunc(Number(daftraProduct.stock_balance || 0))),
      cost_price: Math.max(0, Number(daftraProduct.buy_price || daftraProduct.average_price || 0))
    }
    const { error: updateError } = await supabaseAdmin
      .from(localEntityType === 'product_variant' ? 'product_variants' : 'products')
      .update(updatePayload)
      .eq('id', localRecord.id)

    if (updateError) {
      failures.push({ externalId, code, message: updateError.message })
      continue
    }

    await saveEntityLink(supabaseAdmin, {
      local_entity_type: localEntityType,
      local_id: localRecord.id,
      external_entity_type: 'product',
      external_id: externalId,
      external_number: daftraProduct.product_code || null,
      metadata: { source: 'inventory-import' }
    })
    updated += 1
  }

  return {
    scanned: daftraProducts.length,
    updated,
    unmatched,
    failed: failures.length,
    failures: failures.slice(0, 20),
    syncedAt: new Date().toISOString()
  }
}
