import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { testAndRecordDaftraConnection } from '../../utils/daftraSync'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.edit'
  })
  const connection = await testAndRecordDaftraConnection(supabaseAdmin)

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'settings.erp.connection-test',
    description: 'Tested the Daftra connection.',
    metadata: { connected: true, accountHost: connection.accountHost }
  })

  return { connection }
})
