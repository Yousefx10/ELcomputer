import { requireAdminRequest } from '../../utils/adminRequest'
import { sitePageSelect, throwSitePageError } from '../../utils/sitePages'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'pages.view' })
  const { data, error } = await supabaseAdmin
    .from('site_pages')
    .select(sitePageSelect)
    .order('updated_at', { ascending: false })

  if (error) throwSitePageError(error, 'Could not load pages.')
  return { items: data || [] }
})
