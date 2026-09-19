import { requireAdminRequest } from '../../../utils/adminRequest'
import { helpCategoryFields, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'help.view' })
  const { data, error } = await supabaseAdmin.from('help_categories').select(helpCategoryFields)
    .order('sort_position').order('name')
  if (error) throwHelpError(error, 'Could not load categories.')
  return { items: data || [] }
})
