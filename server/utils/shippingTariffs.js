import { createError, getRouterParam } from 'h3'
import { normalizeTariff, tariffDiff, tariffReadiness, TariffError } from '../../app/utils/shippingTariffs.js'

export const tariffUuid = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw createError({ statusCode: 400, statusMessage: 'Invalid tariff request.' })
  return value.toLowerCase()
}
export const tariffCompanyId = event => tariffUuid(getRouterParam(event, 'id'))
export const tariffRpc = async (db, name, args) => {
  const request = db.rpc(name, args)
  const { data, error } = await (typeof request.abortSignal === 'function' ? request.abortSignal(AbortSignal.timeout(10000)) : request)
  if (error) throw createError({ statusCode: error.code === '42501' ? 403 : error.code === '40001' ? 409 : error.code === '22023' ? 400 : 503, statusMessage: error.code === '40001' ? 'Tariff changed. Reload before saving.' : 'Tariff request could not complete.' })
  return data
}
export const tariffContext = async db => {
  const [locations, settings] = await Promise.all([
    db.from('shipping_city_mappings').select('provider_city_id,governorate,city,city_arabic', { count: 'exact' }).eq('provider', 'pdc').order('provider_city_id').limit(5000),
    db.from('shipping_provider_settings').select('cities_cache,products_cache').eq('id', 'pdc').maybeSingle()
  ])
  if (locations.error || settings.error || !settings.data || locations.count !== locations.data?.length || locations.count > 5000) throw createError({ statusCode: 503, statusMessage: 'Tariff locations are unavailable.' })
  return { aliases: locations.data, cities: settings.data.cities_cache || [], products: settings.data.products_cache || [] }
}
export const normalizeTariffRequest = input => {
  try { return normalizeTariff(input) } catch (error) {
    if (error instanceof TariffError) throw createError({ statusCode: 400, statusMessage: 'Invalid tariff.', data: { field: error.field } })
    throw error
  }
}
export { tariffDiff, tariffReadiness }
