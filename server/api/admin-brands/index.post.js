import { readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { brandPublicSelect, normalizeBrandPayload, throwBrandError } from '../../utils/brandPages'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'brands.add' })
  const payload = normalizeBrandPayload(await readBody(event))
  const { data, error } = await supabaseAdmin.from('brands').insert(payload).select(brandPublicSelect).single()
  if (error) throwBrandError(error)
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'brands.create', description: `Added brand ${data.name}.`, metadata: { brand_id: data.id, brand_slug: data.slug } })
  return { item: data }
})
