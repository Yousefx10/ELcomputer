import { getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpArticleFields, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.view' })
  const query = getQuery(event)
  let request = supabaseAdmin.from('help_articles').select(helpArticleFields)
    .order('updated_at', { ascending: false }).limit(200)
  if (['draft', 'published', 'archived'].includes(query.status)) request = request.eq('status', query.status)
  if (query.category) request = request.eq('category_id', String(query.category))
  const search = String(query.q || '').trim().slice(0, 120)
  if (search) request = request.textSearch('search_vector', search, { type: 'plain', config: 'simple' })
  const { data, error } = await request
  if (error) throwHelpError(error, 'Could not load articles.')
  return { items: data || [] }
})
