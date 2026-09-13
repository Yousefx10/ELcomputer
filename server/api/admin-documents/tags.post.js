import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { throwDocumentsDataError } from '../../utils/documents'

const COLORS = new Set(['blue', 'violet', 'emerald', 'amber', 'rose', 'slate'])

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'documents.manage'
  })
  const body = await readBody(event)
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ')
  const color = COLORS.has(body?.color) ? body.color : 'blue'

  if (!name || name.length > 32) {
    throw createError({ statusCode: 400, statusMessage: 'Tag names must be 1–32 characters.' })
  }

  const { data, error } = await supabaseAdmin
    .from('document_tags')
    .insert({ name, color, created_by: adminUser.id })
    .select('id, name, color, created_at, updated_at')
    .single()

  if (error?.code === '23505') {
    throw createError({ statusCode: 409, statusMessage: 'That tag already exists.' })
  }
  if (error) throwDocumentsDataError(error, 'Could not create the tag.')

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.tag.created',
    description: `Created document tag ${name}.`,
    metadata: { tag_id: data.id }
  })

  return { item: data }
})
