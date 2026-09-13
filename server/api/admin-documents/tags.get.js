import { requireAdminRequest } from '../../utils/adminRequest'
import { throwDocumentsDataError } from '../../utils/documents'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'documents.view'
  })
  const { data, error } = await supabaseAdmin
    .from('document_tags')
    .select('id, name, color, created_at, updated_at')
    .order('name', { ascending: true })

  if (error) throwDocumentsDataError(error, 'Could not load document tags.')
  return { items: data || [] }
})
