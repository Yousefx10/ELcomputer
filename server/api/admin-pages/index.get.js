import { selectWithSeo } from '../../../app/utils/seoQuery.js'
import { requireAdminRequest } from '../../utils/adminRequest'
import { sitePageSelect, throwSitePageError } from '../../utils/sitePages'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'pages.view' })
  const baseFields = sitePageSelect.split(',').filter(field => !field.trim().startsWith('seo_')).join(',')
  const { data, error } = await selectWithSeo(fields => supabaseAdmin
    .from('site_pages').select(fields).order('updated_at', { ascending: false }), baseFields,
    'seo_title,seo_description,seo_image_url,seo_noindex')

  if (error) throwSitePageError(error, 'Could not load pages.')
  return { items: data || [] }
})
