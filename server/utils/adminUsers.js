import {
  createFullAdminPermissions,
  normalizeAdminPermissions,
  countGrantedAdminPermissions
} from '~/utils/adminPermissions'
import { createError } from 'h3'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeAdminUserInput = (body = {}, options = {}) => {
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const fullName = String(body.full_name ?? body.fullName ?? '').trim()
  const role = body.role === 'owner' ? 'owner' : 'admin'
  const isActive = body.is_active ?? body.isActive ?? true
  const permissions = role === 'owner'
    ? createFullAdminPermissions()
    : normalizeAdminPermissions(body.permissions, role)

  if (!emailPattern.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid email is required.'
    })
  }

  if (options.requirePassword && password.trim().length < 6) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 6 characters.'
    })
  }

  if (!options.requirePassword && password && password.trim().length > 0 && password.trim().length < 6) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 6 characters.'
    })
  }

  return {
    email,
    password: password.trim(),
    full_name: fullName || null,
    role,
    is_active: Boolean(isActive),
    permissions
  }
}

export const mapAdminUserRecord = (record) => {
  if (!record) {
    return null
  }

  const normalizedPermissions = normalizeAdminPermissions(record.permissions, record.role)

  return {
    ...record,
    permissions: normalizedPermissions,
    granted_permissions_count: countGrantedAdminPermissions(normalizedPermissions, record.role)
  }
}
