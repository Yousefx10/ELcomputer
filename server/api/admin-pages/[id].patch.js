import { createError, getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'
import { normalizeSitePageId, normalizeSitePagePayload, sitePageSelect, throwSitePageError } from '../../utils/sitePages'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'pages.edit' })
  const id = normalizeSitePageId(getRouterParam(event, 'id'))
  const payload = normalizeSitePagePayload(await readBody(event))
  const { data, error } = await supabaseAdmin
    .from('site_pages')
    .update({ ...payload, updated_by: adminUser.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(sitePageSelect)
    .maybeSingle()

  if (error) throwSitePageError(error)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'pages.update',
    description: `Updated page ${data.title}.`,
    metadata: { page_id: data.id, path: data.path }
  })
  return { item: data }
})
