import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpArticleFields, normalizeHelpArticle, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.edit' })
  const payload = normalizeHelpArticle(await readBody(event))
  const { data: category } = await supabaseAdmin.from('help_categories')
    .select('id').eq('id', payload.category_id).maybeSingle()
  if (!category) throw createError({ statusCode: 400, statusMessage: 'Choose a valid category.' })
  const { data, error } = await supabaseAdmin.from('help_articles')
    .insert({ ...payload, created_by: adminUser.id, updated_by: adminUser.id,
      published_at: payload.status === 'published' ? new Date().toISOString() : null })
    .select(helpArticleFields).single()
  if (error) throwHelpError(error)
  return { item: data }
})
