// A rejected compare-and-swap never overwrites another device's cart.
// Retries retain the command UUID and exact request after a lost response.
export const cartWriteBody = (snapshot, action = 'replace') => ({
  action,
  items: snapshot.items.map(item => ({id:item.id,variant_id:item.variant_id || null,
    quantity:item.quantity,cart_line_id:item.cart_line_id})),
  ...(action === 'replace' ? {cart_id:snapshot.id || null,coupon_code:snapshot.coupon?.code || null} : {})
})

export function createCartSync({request, current, apply, status, uuid}) {
  let version = 0, busy = false, pending = null, next = null, rejected = null
  const flush = async () => {
    if (busy || !pending || !current()) return
    busy = true; status('saving')
    let continueFlush = false
    try {
      const result = await request(pending)
      if (!current()) return
      if (result.conflict) {
        rejected = next || pending.body; next = null; pending = null
        status('conflict'); return
      }
      if (next && result.appliedVersion !== undefined && result.cart.version !== result.appliedVersion) {
        // A recovered receipt may precede another device's edit. The queued
        // snapshot was based on our old state and cannot adopt that new version.
        rejected = next; next = null; pending = null; status('conflict'); return
      }
      version = result.cart.version
      pending = null
      if (next) { pending = {command_id:uuid(),expected_version:version,body:next}; next = null }
      else apply(result.cart)
      status(pending ? 'saving' : 'ready')
      continueFlush = !!pending
    } catch { if (current()) status('error') }
    finally { busy = false }
    if (continueFlush && current()) await flush()
  }
  return {
    initialize(cart) { version = cart.version; apply(cart); status('ready') },
    write(snapshot) {
      if (rejected) return false
      const body = cartWriteBody(snapshot)
      if (pending) next = body
      else pending = {command_id:uuid(),expected_version:version,body}
      void flush(); return true
    },
    async retry() { await flush() },
    async review() {
      const result = await request()
      if (!current()) return
      pending = null; next = null; rejected = null; version = result.cart.version
      apply(result.cart); status('ready')
    },
    get clean() { return !busy && !pending && !next && !rejected },
    get rejected() { return rejected }
  }
}
