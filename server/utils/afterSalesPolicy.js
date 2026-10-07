import { createError, setHeader } from 'h3'
import { readPaymentCallbackBody } from './payments/body.js'
import { afterSalesFields, afterSalesEvidence } from '../../app/utils/afterSalesFields.js'

const invalid = () => { throw createError({ statusCode: 400, statusMessage: 'Enter valid after-sales policy values.' }) }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const afterSalesScope = (kind, id) => {
  if (!['global', 'category', 'product'].includes(kind) || (kind !== 'global' && !uuid.test(id || ''))) invalid()
  return kind === 'global' ? 'global' : `${kind}:${id}`
}
export const validateAfterSalesValues = (values, { scope = 'global', section = 'overrides' } = {}) => {
  if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length) invalid()
  const allowed = afterSalesFields.filter(field => scope !== 'global' || field.group === section || field.group === 'shared')
  if (!['warranty', 'returns', 'overrides'].includes(section) || (scope === 'global' && section === 'overrides')) invalid()
  const result = {}
  for (const [key, value] of Object.entries(values)) {
    const field = allowed.find(field => field.key === key)
    if (!field) invalid()
    if (value === null && scope !== 'global') { result[key] = null; continue }
    if (field.type === 'boolean' && typeof value !== 'boolean') invalid()
    if (field.type === 'enum' && !field.options.includes(value)) invalid()
    if (field.type === 'list' && (!Array.isArray(value) || value.length > field.options.length || new Set(value).size !== value.length || value.some(item => !field.options.includes(item)))) invalid()
    if (field.type === 'integer' && (!Number.isInteger(value) || value < field.min || value > field.max)) invalid()
    if (field.type === 'timezone') {
      if (typeof value !== 'string' || value.length > 64) invalid()
      try { new Intl.DateTimeFormat('en', { timeZone: value }).format() } catch { invalid() }
    }
    result[key] = value
  }
  return result
}
export const validateAfterSalesReason = body => {
  const keys = ['key', 'label_en', 'label_ar', 'is_enabled', 'sort_order', 'fault', 'shipping', 'opened', 'evidence', 'revision']
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) invalid()
  if (typeof body.key !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(body.key)) invalid()
  for (const key of ['label_en', 'label_ar']) if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > 160) invalid()
  if (typeof body.is_enabled !== 'boolean' || !Number.isInteger(body.sort_order) || body.sort_order < 0 || body.sort_order > 10000 || !Number.isInteger(body.revision) || body.revision < 0) invalid()
  if (!['customer', 'seller', 'neutral'].includes(body.fault)) invalid()
  for (const [key, options] of [['shipping', ['elcomputer', 'customer', 'manual']], ['opened', ['allowed', 'not_allowed', 'manual']], ['evidence', afterSalesEvidence]]) {
    if (body[key] !== null && !options.includes(body[key])) invalid()
  }
  return { ...body, label_en: body.label_en.trim(), label_ar: body.label_ar.trim() }
}
export const afterSalesRpc = async (db, name, args) => {
  const { data, error } = await db.rpc(name, args)
  if (error) throw createError({ statusCode: error.code === '40001' ? 409 : error.code === '22023' ? 400 : 503, statusMessage: error.code === '40001' ? 'Reload after-sales policies before saving.' : 'After-sales policies are unavailable.' })
  return data
}
export const resolveAfterSalesPolicy = (db, productId = null) => afterSalesRpc(db, 'after_sales_resolve_policy', { p_product_id: productId })
export const readOwnedAfterSalesEntitlements = (db, orderId, customerId) => afterSalesRpc(db, 'after_sales_order_entitlements', { p_order_id: orderId, p_customer_id: customerId })
// Future claim callers must establish ownership and supply independently verified
// facts. This helper previews rules; it does not submit, approve or execute a claim.
export const getWarrantyEligibility = (db, itemId, facts = {}) => afterSalesRpc(db, 'after_sales_item_eligibility', { p_item_id: itemId, p_facts: facts }).then(result => result.warranty)
export const getReturnEligibility = (db, itemId, facts = {}) => afterSalesRpc(db, 'after_sales_item_eligibility', { p_item_id: itemId, p_facts: facts }).then(result => result.returns)

export const readAfterSalesBody = async event => {
  try {
    const body = JSON.parse(await readPaymentCallbackBody(event, 16384, 5000))
    if (!body || typeof body !== 'object' || Array.isArray(body)) invalid()
    return body
  } catch (error) { throw createError({ statusCode: [408, 413].includes(error.statusCode) ? error.statusCode : 400, statusMessage: 'Enter valid after-sales policy values.' }) }
}
export const afterSalesHandler = handler => async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  try { return await handler(event) } catch (error) {
    if (error.statusCode && error.statusCode < 500) throw error
    throw createError({ statusCode: 503, statusMessage: 'After-sales policies are unavailable.' })
  }
}
