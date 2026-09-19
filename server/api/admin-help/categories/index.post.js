import { readBody } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpCategoryFields, normalizeHelpCategory, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.edit' })
  const payload = normalizeHelpCategory(await readBody(event))
  const { data, error } = await supabaseAdmin.from('help_categories').insert(payload)
    .select(helpCategoryFields).single()
  if (error) throwHelpError(error)
  return { item: data }
})
