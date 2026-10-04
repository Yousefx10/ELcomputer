import { createError, getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { brandPublicSelect, normalizeBrandPayload, throwBrandError } from '../../utils/brandPages'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'brands.edit' })
  const id = getRouterParam(event, 'id')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) throw createError({ statusCode: 400, statusMessage: 'Brand id is invalid.' })
  const existing = await supabaseAdmin.from('brands').select('id,slug').eq('id', id).maybeSingle()
  if (existing.error) throwBrandError(existing.error)
  if (!existing.data) throw createError({ statusCode: 404, statusMessage: 'Brand not found.' })
  const payload = normalizeBrandPayload(await readBody(event), existing.data.slug)
  const { data, error } = await supabaseAdmin.from('brands').update(payload).eq('id', id).select(brandPublicSelect).single()
  if (error) throwBrandError(error)
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'brands.update', description: `Updated brand ${data.name}.`, metadata: { brand_id: id, brand_slug: data.slug } })
  return { item: data }
})
