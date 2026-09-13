import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'
import { normalizeSitePageId, throwSitePageError } from '../../utils/sitePages'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'pages.edit' })
  const id = normalizeSitePageId(getRouterParam(event, 'id'))
  const { data: page, error: loadError } = await supabaseAdmin
    .from('site_pages')
    .select('id, title, path')
    .eq('id', id)
    .maybeSingle()

  if (loadError) throwSitePageError(loadError, 'Could not load the page.')
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })

  const { error } = await supabaseAdmin.from('site_pages').delete().eq('id', id)
  if (error) throwSitePageError(error, 'Could not delete the page.')
  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'pages.delete',
    description: `Deleted page ${page.title}.`,
    metadata: { page_id: page.id, path: page.path }
  })
  return { id }
})
