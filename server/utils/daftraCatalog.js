import { createError } from 'h3'
import { readAllDaftraRecords } from './daftraSync.js'
import { daftraRequest, unwrapDaftraRecord } from './daftra.js'

// Daftra product names and codes for linking. Stock and cost are never read here.
const CATALOG_MS = 5 * 60 * 1000
let cached = null

export async function readDaftraCatalog({ force = false, request = daftraRequest } = {}) {
  if (!force && cached && cached.expires > Date.now()) return cached.value
  const records = await readAllDaftraRecords('/products.json', 'Product', { with_images: 0 }, request)
  const value = {
    fetchedAt: new Date().toISOString(),
    products: records.filter(record => record?.id).map(record => ({
      id: String(record.id), name: String(record.name || '').trim(), code: String(record.product_code || '').trim(), active: Number(record.status) === 0
    }))
  }
  cached = { value, expires: Date.now() + CATALOG_MS }
  return value
}

export const clearDaftraCatalogCache = () => { cached = null }

// Treasuries and the payment methods already used on Daftra bills, for the settings picker.
export async function readDaftraPaymentOptions(request = daftraRequest) {
  const [treasuries, payments] = await Promise.all([
    request('/treasuries.json', { query: { limit: 100, page: 1 } }),
    request('/invoice_payments.json', { query: { limit: 100, page: 1 } })
  ])
  if (!Array.isArray(treasuries?.data) || !Array.isArray(payments?.data)) throw createError({ statusCode: 502, statusMessage: 'Daftra could not complete the request.' })
  return {
    treasuries: treasuries.data.map(entry => unwrapDaftraRecord(entry, 'Treasury')).filter(t => t?.id)
      .map(t => ({ id: Number(t.id), name: String(t.name || '').trim() })),
    methodsInUse: [...new Set(payments.data.map(entry => String(unwrapDaftraRecord(entry, 'InvoicePayment')?.payment_method || '').trim())
      .filter(method => /^[A-Za-z0-9_-]{1,60}$/.test(method)))]
  }
}
