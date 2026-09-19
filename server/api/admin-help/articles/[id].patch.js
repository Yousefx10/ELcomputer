import { createError, getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpArticleFields, normalizeHelpArticle, requireHelpId, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.edit' })
  const id = requireHelpId(getRouterParam(event, 'id'))
  const payload = normalizeHelpArticle(await readBody(event))
  const [existingResult, categoryResult] = await Promise.all([
    supabaseAdmin.from('help_articles').select('id, status, published_at').eq('id', id).maybeSingle(),
    supabaseAdmin.from('help_categories').select('id').eq('id', payload.category_id).maybeSingle()
  ])
  if (existingResult.error) throwHelpError(existingResult.error)
  if (!existingResult.data) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  if (!categoryResult.data) throw createError({ statusCode: 400, statusMessage: 'Choose a valid category.' })
  const publishedAt = payload.status === 'published'
    ? existingResult.data.published_at || new Date().toISOString()
    : existingResult.data.published_at
  const { data, error } = await supabaseAdmin.from('help_articles')
    .update({ ...payload, updated_by: adminUser.id, published_at: publishedAt })
    .eq('id', id).select(helpArticleFields).maybeSingle()
  if (error) throwHelpError(error)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  return { item: data }
})
