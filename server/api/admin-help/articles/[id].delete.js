import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpArticleFields, requireHelpId, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.edit' })
  const { data, error } = await supabaseAdmin.from('help_articles')
    .update({ status: 'archived', updated_by: adminUser.id })
    .eq('id', requireHelpId(getRouterParam(event, 'id')))
    .select(helpArticleFields).maybeSingle()
  if (error) throwHelpError(error)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  return { item: data }
})
