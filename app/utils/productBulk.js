export const PRODUCT_BULK_LIMIT = 25
export const PRODUCT_BULK_OPERATIONS = ['publish', 'draft', 'category', 'brand']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const bulkUuid = value => typeof value === 'string' && uuid.test(value)
export function productBulkCommand(body) {
  const invalid = () => { throw Error('Invalid bulk command') }
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 12000 ||
    Object.keys(body).some(key => !['request_id','operation','reference_id','items'].includes(key)) ||
    !bulkUuid(body.request_id) || !PRODUCT_BULK_OPERATIONS.includes(body.operation) || !Array.isArray(body.items) ||
    body.items.length < 1 || body.items.length > PRODUCT_BULK_LIMIT) invalid()
  const assigns = ['category','brand'].includes(body.operation)
  if (assigns ? !bulkUuid(body.reference_id) : body.reference_id != null) invalid()
  const items = body.items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(key => !['id','expected_revision'].includes(key)) || !bulkUuid(item.id) ||
      !Number.isSafeInteger(item.expected_revision) || item.expected_revision < 0) invalid()
    return { id: item.id.toLowerCase(), expected_revision: item.expected_revision }
  }).sort((a,b) => a.id.localeCompare(b.id))
  if (new Set(items.map(item => item.id)).size !== items.length) invalid()
  return { request_id: body.request_id.toLowerCase(), operation: body.operation,
    reference_id: assigns ? body.reference_id.toLowerCase() : null, items }
}

// Reject malformed acknowledgements: they cannot unlock another submission.
export function productBulkResult(result, command) {
  if (!result || result.request_id !== command.request_id || result.operation !== command.operation ||
    typeof result.replayed !== 'boolean' || !Array.isArray(result.items) || result.items.length !== command.items.length) throw Error('Invalid bulk result')
  const expected = new Set(command.items.map(item => item.id)), counts = { succeeded: 0, unchanged: 0, conflicted: 0, failed: 0 }
  for (const item of result.items) {
    if (!expected.delete(item.id) || !Object.hasOwn(counts,item.status) ||
      ![null,'conflict','not_found','incomplete','reference','failed'].includes(item.reason) ||
      (['succeeded','unchanged'].includes(item.status) ? !Number.isSafeInteger(item.revision) || item.revision < 0 || item.reason !== null :
        item.revision !== null || (item.status === 'conflicted' ? item.reason !== 'conflict' : !['not_found','incomplete','reference','failed'].includes(item.reason)))) throw Error('Invalid bulk result')
    counts[item.status]++
  }
  if (Object.entries(counts).some(([key,count]) => result[key] !== count)) throw Error('Invalid bulk counts')
  return result
}
