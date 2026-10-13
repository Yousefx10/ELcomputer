// Early field feedback; the existing API/transaction remains authoritative.
export function productEditorErrors(fields) {
  const errors = {}
  if (typeof fields.title !== 'string' || !fields.title.trim() || fields.title.trim().length > 500) errors.title = 'title'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.slug || '') || fields.slug.length > 200) errors.slug = 'slug'
  for (const field of ['price', 'old_price']) {
    if (field === 'old_price' && ['', null, undefined].includes(fields[field])) continue
    if (!['string', 'number'].includes(typeof fields[field]) || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(fields[field]))) errors[field] = field
  }
  if (fields.sku && (typeof fields.sku !== 'string' || fields.sku.length > 120 || /[\u0000-\u001f\u007f]/.test(fields.sku))) errors.sku = 'sku'
  if (fields.is_serialized && !fields.primary_warehouse_id) errors.primary_warehouse_id = 'warehouse'
  if (fields.is_serialized && (!Array.isArray(fields.variants) || !fields.variants.length)) errors.variants = 'variants'
  if (!fields.is_serialized && (!/^\d+$/.test(String(fields.stock_quantity)) || Number(fields.stock_quantity) > 2147483647)) errors.stock_quantity = 'stock_quantity'
  return errors
}
