import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  getAdminActivityAuthors,
  getAdminActivityLogs
} from '../../utils/adminLogs'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.view'
  })

  const query = getQuery(event)
  const author = String(query.author || '').trim()

  try {
    const [logsResult, authorsResult] = await Promise.all([
      getAdminActivityLogs(supabaseAdmin, {
        author
      }),
      getAdminActivityAuthors(supabaseAdmin)
    ])

    return {
      items: logsResult.items || [],
      authors: authorsResult.items || [],
      missingTable: Boolean(logsResult.missingTable || authorsResult.missingTable)
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Could not load admin logs.'
    })
  }
})
