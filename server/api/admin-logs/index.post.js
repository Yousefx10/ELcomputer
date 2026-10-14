import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const body = await readBody(event)
  const description = String(body?.description || '').trim()

  if (String(body?.actionKey || '').trim() === 'treasury.salary_payment.created') {
    throw createError({ statusCode: 400, statusMessage: 'Salary audits are recorded with the payment.' })
  }

  if (!description) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Log description is required.'
    })
  }

  const result = await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: body?.actionKey,
    description,
    metadata: body?.metadata
  })

  return {
    success: Boolean(result?.success),
    missingTable: Boolean(result?.missingTable)
  }
})
