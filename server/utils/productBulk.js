import { createError } from 'h3'
import { productBulkCommand } from '../../app/utils/productBulk.js'

export function prepareProductBulk(body) {
  try { return productBulkCommand(body) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Choose up to 25 products and a supported action.', data: { productBulkError: 'invalid' } }) }
}
export function throwProductBulkError(error) {
  const reason = error?.message?.match(/^catalog:(permission|invalid|reference|request_reused)$/)?.[1]
  const statusCode = reason === 'permission' || error?.code === '42501' ? 403 : reason ? 400 : 503
  const message = reason === 'reference' ? 'Choose an existing category or brand.' : reason === 'request_reused'
    ? 'This batch request was already used. Check its result.' : statusCode === 403
      ? 'You do not have permission to update products.' : statusCode === 400
        ? 'Check the selected products and action.' : 'The batch result is unknown. Check or retry it.'
  throw createError({ statusCode, statusMessage: message, data: { productBulkError: reason || (statusCode === 403 ? 'permission' : 'unknown') } })
}
