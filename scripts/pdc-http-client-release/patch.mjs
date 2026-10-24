// Patch the accepted server artifact only. Every other deployed byte is retained.
import assert from 'node:assert/strict'
import { transform } from 'esbuild'
import { createHash } from 'node:crypto'

export const sourceFiles = ['server/utils/pdcShipping.js', 'server/utils/pdcLookups.js', 'server/utils/pdcOrderShipping.js', 'server/utils/pdcReverseLogistics.js']
const hash = value => createHash('sha256').update(value).digest('hex')

export async function patchNitro(original, sources) {
  let code = original
  const edits = []
  const replace = (before, after) => {
    assert.equal(code.split(before).length, 2, 'Expected one exact accepted artifact anchor')
    edits.push({ before, after, index: code.indexOf(before) })
    code = code.replace(before, after)
  }
  const shipping = sources['server/utils/pdcShipping.js'], lookups = sources['server/utils/pdcLookups.js']
  assert.ok(shipping.includes("export const PDC_HTTP_USER_AGENT = 'Storefront-PDC/1.0'"))
  replace('const PDC_ENDPOINTS = {\n  exportLabel: "ExportPDF"\n};', 'const PDC_HTTP_USER_AGENT = "Storefront-PDC/1.0";\nconst PDC_ENDPOINTS = {\n  exportLabel: "ExportPDF"\n};')
  const headers = shipping.slice(shipping.indexOf('export const getPdcHeaders'), shipping.indexOf('export const PDC_TEST_BASE_URL')).replace('export const', 'const')
  const compiledHeaders = (await transform(headers, { target: 'node22', loader: 'js' })).code.trim()
  const oldHeaders = 'const getPdcHeaders = (settings) => ({\n  AccessToken: decryptShippingSecret(settings.access_token_encrypted),\n  CompanyID: cleanText(settings.company_id),\n  "Content-Type": "application/json",\n  Accept: "application/json"\n});'
  replace(oldHeaders, compiledHeaders)
  const dates = lookups.slice(lookups.indexOf('// Cover this shipment'), lookups.indexOf('export const requirePdcReadAccess'))
    .replaceAll('export const', 'const').replaceAll('unavailable()', 'unavailable$2()')
  assert.ok(dates.includes('const getPdcStatusFilters') && dates.includes('const requirePdcStatusDates'))
  const compiledDates = (await transform(dates, { target: 'node22', loader: 'js' })).code.trim()
  const anchor = 'const unavailable$2 = () => createError$1({ statusCode: 502, statusMessage: "Courier lookup is unavailable." });'
  replace(anchor, anchor + '\n' + compiledDates)
  replace('  if (!["GetCities", "GetProducts", "GetShipmentsStatus"].includes(operation)) throw unavailable$2();',
    '  if (!["GetCities", "GetProducts", "GetShipmentsStatus"].includes(operation)) throw unavailable$2();\n  if (operation === "GetShipmentsStatus") requirePdcStatusDates(body);')
  replace('headers: { AccessToken: decryptShippingSecret(settings.access_token_encrypted), CompanyID: String(settings.company_id), Accept: "application/json", "Content-Type": "application/json" },', 'headers: getPdcHeaders(settings),')
  for (const [before, after] of [
    ['const response = await requestPdcLookup(settings, "GetShipmentsStatus", { awBs: claim.awb, reFs: claim.ref }, fetcher);', 'const filters = await getPdcStatusFilters(db, { orderId, awb: claim.awb, ref: claim.ref });\n  const response = await requestPdcLookup(settings, "GetShipmentsStatus", filters, fetcher);'],
    ['const response = await requestPdcLookup(settings, "GetShipmentsStatus", { awBs: "", reFs: job2.to_ref }, fetcher);', 'const filters = await getPdcStatusFilters(db, { orderId, ref: job2.to_ref });\n    const response = await requestPdcLookup(settings, "GetShipmentsStatus", filters, fetcher);'],
    ['const response = await requestPdcLookup(settings, "GetShipmentsStatus", { awBs: job.awb || "", reFs: job.ref }, fetcher);', 'const filters = await getPdcStatusFilters(actor.db, { jobId: job.id, awb: job.awb || "", ref: job.ref });\n  const response = await requestPdcLookup(settings, "GetShipmentsStatus", filters, fetcher);']
  ]) replace(before, after)
  let reversed = code
  for (const { before, after, index } of [...edits].reverse()) {
    assert.equal(reversed.slice(index, index + after.length), after)
    reversed = reversed.slice(0, index) + before + reversed.slice(index + after.length)
  }
  assert.equal(reversed, original, 'No unrelated server change is permitted')
  return { code, proof: { result: 'EXACT_SCOPED_SERVER_PATCH_PASS', before_sha256: hash(original), after_sha256: hash(code), changed_runtime_files: ['server/chunks/nitro/nitro.mjs'], edits, source_sha256: Object.fromEntries(sourceFiles.map(name => [name, hash(sources[name])])), reverse_patch_restores_original_bytes: true } }
}
