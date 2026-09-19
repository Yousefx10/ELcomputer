import { createError, getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpCategoryFields, normalizeHelpCategory, requireHelpId, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.edit' })
  const id = requireHelpId(getRouterParam(event, 'id'))
  const payload = normalizeHelpCategory(await readBody(event))
  const { data, error } = await supabaseAdmin.from('help_categories').update(payload)
    .eq('id', id).select(helpCategoryFields).maybeSingle()
  if (error) throwHelpError(error)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Category not found.' })
  return { item: data }
})
