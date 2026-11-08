import { PDC_PROVIDER_ID } from './pdcShipping.js'

// The courier name customers see, set in Dashboard → Commerce → Shipping.
export const readCourierName = async db => {
  const { data, error } = await db.from('shipping_provider_settings').select('display_name').eq('id', PDC_PROVIDER_ID).maybeSingle()
  return error ? '' : String(data?.display_name || '').trim()
}
