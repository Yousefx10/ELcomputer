const ADMIN_LOGS_TABLE = 'admin_activity_logs'
const ADMIN_LOG_LIMIT_PER_USER = 50

export const isMissingAdminLogsTableError = (error) => {
  return error?.code === '42P01'
}

const normalizeLogDescription = (value) => {
  return String(value || '').trim().slice(0, 220)
}

const normalizeLogMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value
}

const getLogAuthorFilterValue = (record) => {
  return String(record?.admin_user_id || record?.author_email || '').trim()
}

const getNormalizedLogAuthor = (adminUser = {}) => {
  const fullName = String(adminUser.full_name || '').trim()
  const email = String(adminUser.email || '').trim().toLowerCase()

  return {
    name: fullName || email || 'Admin',
    email,
    role: adminUser.role === 'owner' ? 'owner' : 'admin'
  }
}

const cleanupAdminLogs = async ({ supabaseAdmin, adminUserId, authorEmail }) => {
  let cleanupQuery = supabaseAdmin
    .from(ADMIN_LOGS_TABLE)
    .select('id')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(ADMIN_LOG_LIMIT_PER_USER, ADMIN_LOG_LIMIT_PER_USER + 5000)

  if (adminUserId) {
    cleanupQuery = cleanupQuery.eq('admin_user_id', adminUserId)
  } else if (authorEmail) {
    cleanupQuery = cleanupQuery.eq('author_email', authorEmail)
  } else {
    return
  }

  const { data: overflowLogs, error: overflowError } = await cleanupQuery

  if (overflowError) {
    if (!isMissingAdminLogsTableError(overflowError)) {
      console.error('Could not load admin log overflow rows:', overflowError.message)
    }

    return
  }

  if (!overflowLogs?.length) {
    return
  }

  const { error: deleteError } = await supabaseAdmin
    .from(ADMIN_LOGS_TABLE)
    .delete()
    .in('id', overflowLogs.map((log) => log.id))

  if (deleteError && !isMissingAdminLogsTableError(deleteError)) {
    console.error('Could not trim admin logs:', deleteError.message)
  }
}

export const recordAdminActivity = async ({
  supabaseAdmin,
  adminUser,
  actionKey = '',
  description = '',
  metadata = {}
} = {}) => {
  const normalizedDescription = normalizeLogDescription(description)

  if (!supabaseAdmin || !adminUser?.id || !normalizedDescription) {
    return {
      success: false
    }
  }

  const author = getNormalizedLogAuthor(adminUser)
  const { error } = await supabaseAdmin
    .from(ADMIN_LOGS_TABLE)
    .insert({
      admin_user_id: adminUser.id,
      author_name: author.name,
      author_email: author.email,
      author_role: author.role,
      action_key: String(actionKey || '').trim() || null,
      description: normalizedDescription,
      metadata: normalizeLogMetadata(metadata)
    })

  if (error) {
    if (!isMissingAdminLogsTableError(error)) {
      console.error('Could not record admin activity log:', error.message)
    }

    return {
      success: false,
      missingTable: isMissingAdminLogsTableError(error)
    }
  }

  await cleanupAdminLogs({
    supabaseAdmin,
    adminUserId: adminUser.id,
    authorEmail: author.email
  })

  return {
    success: true
  }
}

export const getAdminActivityAuthors = async (supabaseAdmin, limit = 500) => {
  const { data, error } = await supabaseAdmin
    .from(ADMIN_LOGS_TABLE)
    .select('admin_user_id, author_name, author_email, author_role, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingAdminLogsTableError(error)) {
      return {
        items: [],
        missingTable: true
      }
    }

    throw error
  }

  const seen = new Set()
  const items = []

  for (const author of data || []) {
    const value = getLogAuthorFilterValue(author)

    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    items.push({
      value,
      name: author.author_name || author.author_email || 'Admin',
      email: author.author_email || '',
      role: author.author_role === 'owner' ? 'owner' : 'admin'
    })
  }

  return {
    items
  }
}

export const getAdminActivityLogs = async (supabaseAdmin, { author = '', limit = 200 } = {}) => {
  const normalizedAuthor = String(author || '').trim()
  let query = supabaseAdmin
    .from(ADMIN_LOGS_TABLE)
    .select('id, admin_user_id, author_name, author_email, author_role, action_key, description, metadata, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(500, Math.max(1, Number(limit) || 200)))

  if (normalizedAuthor) {
    if (normalizedAuthor.includes('@')) {
      query = query.eq('author_email', normalizedAuthor.toLowerCase())
    } else {
      query = query.eq('admin_user_id', normalizedAuthor)
    }
  }

  const { data, error } = await query

  if (error) {
    if (isMissingAdminLogsTableError(error)) {
      return {
        items: [],
        missingTable: true
      }
    }

    throw error
  }

  return {
    items: data || []
  }
}
