import { readBody } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'
import { normalizeSitePagePayload, sitePageSelect, throwSitePageError } from '../../utils/sitePages'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'pages.edit' })
  const payload = normalizeSitePagePayload(await readBody(event))
  const { data, error } = await supabaseAdmin
    .from('site_pages')
    .insert({ ...payload, created_by: adminUser.id, updated_by: adminUser.id })
    .select(sitePageSelect)
    .single()

  if (error) throwSitePageError(error)
  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'pages.create',
    description: `Created page ${data.title}.`,
    metadata: { page_id: data.id, path: data.path }
  })
  return { item: data }
})
