import { hasAdminPermission } from '~/utils/adminPermissions'
import { requireAdminRequest } from '../../utils/adminRequest'
import { throwSupportError } from '../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'support.view' })
  const { data, error } = await supabaseAdmin.from('admin_users')
    .select('id, email, full_name, role, is_active, permissions').eq('is_active', true)
    .order('full_name')
  if (error) throwSupportError(error, 'Could not load staff.')
  return { items: (data || []).filter(user => hasAdminPermission(user, 'support.reply'))
    .map(user => ({ id: user.id, name: user.full_name || user.email })) }
})
