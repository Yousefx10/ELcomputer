export const ERP_MODES = Object.freeze({ BUILT_IN: 'built_in', DAFTRA: 'daftra' })

// Ownership never depends on external availability.
export const getActiveErpMode = settings => settings?.mode === ERP_MODES.DAFTRA
  || settings?.erp_mode === ERP_MODES.DAFTRA ? ERP_MODES.DAFTRA : ERP_MODES.BUILT_IN
export const isDaftraErp = settings => getActiveErpMode(settings) === ERP_MODES.DAFTRA
export const isBuiltInErp = settings => !isDaftraErp(settings)

export function resolveErpState(settings = {}, credentials = settings) {
  const mode = getActiveErpMode(settings)
  const configured = credentials.configured === true
  const saved = credentials.credentialsSaved ?? configured
  const rawHealth = settings.connectionStatus || settings.daftra_connection_status
  const checkedAt = settings.lastCheckedAt || settings.daftra_last_checked_at
  const revisionChanged = credentials.revision !== undefined
    && (settings.daftra_tested_revision == null || Number(credentials.revision) !== Number(settings.daftra_tested_revision))
  const health = !configured || !checkedAt || revisionChanged ? 'not_tested'
    : rawHealth === 'connected' ? 'connected' : rawHealth === 'error' ? 'failed' : 'not_tested'
  return {
    mode,
    credentialState: saved ? 'saved' : 'not_configured',
    connectionHealth: health,
    activationState: mode === ERP_MODES.DAFTRA ? 'active'
      : health === 'connected' ? 'connected_inactive' : 'inactive',
    canActivateDaftra: configured && health === 'connected'
  }
}

export function isBuiltInErpRoute(route = {}) {
  const value = key => String(Array.isArray(route.query?.[key]) ? route.query[key][0] : route.query?.[key] || '').toLowerCase()
  return route.path === '/dashboard/treasury'
    || route.path === '/dashboard/commerce' && !['returns', 'shipping', 'serialized', 'scan'].includes(value('tab'))
    || route.path === '/dashboard/hr' && value('tab') !== 'users'
    || route.path === '/dashboard' && value('view') === 'stock'
}

export function getErpOwnershipRedirect(route, state, canViewErp = false) {
  if (!isBuiltInErpRoute(route)) return null
  if (!state) return { path:'/dashboard',query:{erpUnavailable:'1'} }
  return isDaftraErp(state) ? {
    path:canViewErp ? '/dashboard/erp':'/dashboard',query:{blocked:'built_in'}
  } : null
}
