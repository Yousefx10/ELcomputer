// Proposed diagnostic analysis only: no transport, settings reads, secrets or writes.
// Literal field names are untrusted. Keep reports encrypted until owner review.
import { normalizePdcLookup, pdcResponseRows } from '../../server/utils/pdcLookups.js'
import { boundedPdcText } from '../../server/utils/pdcTracking.js'

const type = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
const scopeKeys = ['CompanyID', 'companyID', 'companyId', 'company_id']

export function inspectPdcLookupBytes(bytes, { companyId, productId, privateValues = [] } = {}) {
  const report = { version: 1, purpose: 'SCHEMA_ONLY', schema_complete: true,
    json: 'NOT_EVALUATED', row_extraction: 'NOT_EVALUATED', normalization: 'NOT_EVALUATED',
    company_echo: 'NOT_EVALUATED', saved_product: 'NOT_EVALUATED',
    account_ownership: 'UNPROVEN', provider_authentication: 'UNPROVEN' }
  if (!Buffer.isBuffer(bytes) || bytes.length > 65536) return { ...report, schema_complete: false, capture: 'BODY_REFUSED' }
  let body
  try { body = JSON.parse(bytes.toString('utf8')); report.json = 'PASS' }
  catch { return { ...report, schema_complete: false, json: 'REJECTED', capture: 'INVALID_JSON' } }
  const forbiddenNames = [...privateValues, companyId].filter(value => typeof value === 'string' && value)
  const collectValues = value => {
    if (typeof value === 'string' && value) forbiddenNames.push(value)
    else if (Array.isArray(value)) value.forEach(collectValues)
    else if (value && typeof value === 'object') Object.values(value).forEach(collectValues)
  }
  // A scalar reused as a dictionary key must not become a disclosed field name.
  // Arbitrary unknown keys still require owner review before disclosure.
  try { collectValues(body) } catch { return { ...report, schema_complete: false, capture: 'STRUCTURE_REFUSED' } }
  let nodes = 0
  const project = (value, depth = 0) => {
    if (++nodes > 512 || depth > 4) { report.schema_complete = false; return { type: type(value), withheld: 'STRUCTURE_LIMIT' } }
    if (Array.isArray(value)) {
      const elements = []
      for (const item of value) {
        if (nodes >= 512) { report.schema_complete = false; break }
        elements.push(project(item, depth + 1))
      }
      return { type: 'array', length: value.length, elements }
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value), fields = []
      for (const [key, item] of entries) {
        if (fields.length >= 64 || nodes >= 512) { report.schema_complete = false; break }
        const safe = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)
          && !forbiddenNames.some(secret => key === secret || (secret.length >= 4 && key.includes(secret)))
        if (!safe) report.schema_complete = false
        fields.push({ ...(safe ? { field: key } : { field_withheld: true }), schema: project(item, depth + 1) })
      }
      return { type: 'object', field_count: entries.length, fields }
    }
    return { type: type(value) }
  }
  report.shape = project(body)
  let rows, normalized
  try { rows = pdcResponseRows(body); report.row_extraction = 'PASS' }
  catch { report.row_extraction = 'REJECTED' }
  if (rows) {
    report.row_count = rows.length
    report.validation = { id_conversion_exceptions: 0, invalid_integer_ids: 0, duplicate_ids: 0,
      invalid_names: 0, nonprimitive_id_types: 0, first_invalid_row: null }
    const seen = new Set()
    rows.forEach((row, index) => {
      const rawId = row?.id ?? row?.ID
      let invalid = false, id
      if (!['number', 'string'].includes(typeof rawId)) report.validation.nonprimitive_id_types++
      try { id = Number(rawId) } catch { report.validation.id_conversion_exceptions++; invalid = true }
      if (!Number.isInteger(id) || id <= 0 || id > 2147483647) { report.validation.invalid_integer_ids++; invalid = true }
      else if (seen.has(id)) { report.validation.duplicate_ids++; invalid = true }
      else seen.add(id)
      try { boundedPdcText(row?.name ?? row?.Name, 200, true) }
      catch { report.validation.invalid_names++; invalid = true }
      if (invalid && report.validation.first_invalid_row === null) report.validation.first_invalid_row = index
    })
    try { normalized = normalizePdcLookup(body); report.normalization = 'PASS' }
    catch { report.normalization = 'REJECTED' }
    let echoes = 0, mismatch = false, unsupported = false
    for (const object of [body, ...rows]) {
      for (const key of scopeKeys) {
        if (!object || typeof object !== 'object' || object[key] == null) continue
        echoes++
        if (!['string', 'number'].includes(typeof object[key])) unsupported = true
        else if (typeof companyId !== 'string' || String(object[key]).trim() !== companyId) mismatch = true
      }
    }
    report.company_echo = !echoes ? 'ABSENT' : unsupported ? 'UNSUPPORTED_TYPE' : mismatch ? 'MISMATCH' : 'MATCH_ONLY'
    if (normalized && ['string', 'number'].includes(typeof productId) && Number.isInteger(Number(productId)) && Number(productId) > 0 && Number(productId) <= 2147483647) {
      report.saved_product = normalized.some(row => row.id === Number(productId)) ? 'MATCH' : 'MISMATCH'
    }
  }
  report.capture = 'SCHEMA_ANALYZED'
  if (Buffer.byteLength(JSON.stringify(report)) > 8192) {
    report.schema_complete = false
    report.shape = { type: type(body), withheld: 'OUTPUT_LIMIT' }
  }
  return report
}
