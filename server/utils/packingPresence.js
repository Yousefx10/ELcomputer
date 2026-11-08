// The page reports every 20 seconds. Browsers slow hidden tabs, so this allows several missed reports.
export const PACKING_STALE_MS = 150000
export const isPackingWorkSessionStale = (workSession, now = Date.now()) => {
  if (!workSession || workSession.status !== 'active') return true
  const seen = new Date(workSession.last_seen_at || 0).getTime()
  return !Number.isFinite(seen) || now - seen > PACKING_STALE_MS
}
