import assert from 'node:assert/strict'

// A private operator supplies the origins and exact account/profile payload.
// Password/token request bodies must never be inspected or logged here.
export class OwnerBrowserGuard {
  constructor({ origin, authOrigin, a, b }) {
    this.origin = new URL(origin).origin
    this.authOrigin = new URL(authOrigin).origin
    this.a = a; this.b = b
    this.stage = 'LOGIN_A'
    this.expectedProfile = null
    this.counts = { loginA: 0, loginB: 0, profileWrites: 0, logoutA: 0, logoutB: 0 }
  }
  armProfile(payload) {
    assert.equal(this.stage, 'PROFILE_A')
    assert.equal(payload.id, this.a)
    assert.equal(payload.address_line_1, null)
    assert.equal(this.counts.profileWrites, 0)
    this.expectedProfile = payload
  }
  decide(request) {
    const u = new URL(request.url()), method = request.method()
    const read = ['GET', 'HEAD'].includes(method)
    if (u.origin === 'https://challenges.cloudflare.com' && ['GET','POST'].includes(method)) return 'allow'
    if (u.origin === this.authOrigin) {
      if (read && ['/auth/v1/settings','/auth/v1/user'].includes(u.pathname)) return 'allow'
      if (u.pathname === '/auth/v1/token' && method === 'POST') {
        if (u.searchParams.get('grant_type') === 'refresh_token' && ['PROFILE_A','ORDERS_B'].includes(this.stage)) return 'allow'
        if (u.searchParams.get('grant_type') !== 'password') return 'deny'
        const counter = this.stage === 'LOGIN_A' ? 'loginA' : this.stage === 'LOGIN_B' ? 'loginB' : null
        if (!counter || this.counts[counter] !== 0) return 'deny'
        this.counts[counter]++; return 'allow'
      }
      if (u.pathname === '/auth/v1/logout' && method === 'POST') {
        const counter = this.stage === 'LOGOUT_A' ? 'logoutA' : this.stage === 'LOGOUT_B' ? 'logoutB' : null
        if (!counter || this.counts[counter] !== 0) return 'deny'
        this.counts[counter]++; return 'allow'
      }
      if (u.pathname === '/rest/v1/customer_profiles') {
        const id = ['LOGIN_A','PROFILE_A','LOGOUT_A'].includes(this.stage) ? this.a : this.b
        if (read) return u.searchParams.get('id') === 'eq.' + id ? 'allow' : 'deny'
        if (method !== 'POST' || this.stage !== 'PROFILE_A' || !this.expectedProfile || this.counts.profileWrites !== 0) return 'deny'
        let payload
        try { payload = JSON.parse(request.postData()) } catch { return 'deny' }
        try { assert.deepEqual(payload, this.expectedProfile) } catch { return 'deny' }
        this.counts.profileWrites++; this.expectedProfile = null; return 'allow'
      }
      if (u.pathname === '/rest/v1/customer_orders') {
        const id = ['LOGIN_A','PROFILE_A','LOGOUT_A'].includes(this.stage) ? this.a : this.b
        return read && u.searchParams.get('user_id') === 'eq.' + id ? 'allow' : 'deny'
      }
      if (u.pathname.startsWith('/rest/v1/rpc/')) return 'deny'
      if (read && /^\/rest\/v1\/(site_settings|products|categories|brands|product_variants)$/.test(u.pathname)) return 'allow'
      if (read && u.pathname.startsWith('/storage/v1/object/public/')) return 'allow'
      return 'deny'
    }
    if (u.origin === this.origin) {
      if (/^\/api\/(?:analytics|store-analytics)(?:\/|$)/.test(u.pathname) && method === 'POST') return 'telemetry'
      if (/^\/(?:checkout|cart|dashboard)(?:\/|$)/.test(u.pathname) || /^\/api\/(?:checkout|payments|admin|internal|webhooks)(?:[-/]|$)/.test(u.pathname)) return 'deny'
      if (u.pathname.startsWith('/api/account/history')) return read && u.pathname === '/api/account/history' && ['LOGIN_B','ORDERS_B'].includes(this.stage) ? 'allow' : 'deny'
      return read ? 'allow' : 'deny'
    }
    if (read && ['https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(u.origin)) return 'allow'
    return 'deny'
  }
}
