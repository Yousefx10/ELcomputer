import { processSmsQueue } from './service.js'
import { processTransactionalSms } from './transactional.js'

const on = value => [true, 'true'].includes(value)
let running = false, again = false

const drain = async (db, runtime) => {
  if (!on(runtime.smsTransactionalEnabled)) return
  const state = await db.rpc('sms_channel_state')
  if (state.error || !state.data?.transactionalEnabled) return
  await processTransactionalSms(db, { limit: 3, siteOrigin: runtime.public?.siteUrl })
  await processSmsQueue(db, { limit: 3, trafficTypes: ['notification'] })
}

// Sends order SMS straight after the order commits. It never affects the order,
// and the worker timer stays as the backstop if this run fails.
export const sendOrderSmsNow = (db, runtime) => {
  if (running) { again = true; return Promise.resolve() }
  running = true
  return (async () => {
    try { do { again = false; await drain(db, runtime) } while (again) }
    catch { console.error('Instant order SMS did not run. The worker will retry.') }
    finally { running = false }
  })()
}
