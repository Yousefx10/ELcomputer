import { spawn } from 'node:child_process'
import { randomBytes, createHmac } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { createEmailNativeDatabase } from './emailNativeDatabase.mjs'
import { createCatalogFixture, reproduceCatalogCorrection, migrateCatalog, catalogMigration } from './catalogFixture.mjs'

// A real PostgREST instance connected only to an owned disposable loopback DB.
// Authentication uses synthetic signed fixture claims; no hosted Auth or API keys.
export const createCatalogRestFixture = async ({ afterCatalog = null } = {}) => {
  const db = await createEmailNativeDatabase({ stopBefore: catalogMigration })
  const dir = await mkdtemp(join(tmpdir(), 'catalog-rest-'))
  let server, logs = ''
  const close = async () => {
    if (server && server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve))
      server.kill('SIGTERM'); await ended
    }
    await db.close(); await rm(dir, { recursive: true, force: true })
  }
  try {
    const fixture = await createCatalogFixture({ database: db })
    await reproduceCatalogCorrection(db); await migrateCatalog(db)
    if (afterCatalog) await afterCatalog(db)
    // Hosted grants are absent from the schema-only fixture. Built Dashboard
    // handlers need the same server-role Auth lookup and audit access. Browser
    // roles, permissions and RLS remain unchanged in this disposable database.
    await db.exec('grant select on public.admin_users to service_role; grant select,insert,delete on public.admin_activity_logs to service_role')
    // Modern PostgREST provides request.jwt.claims; existing SQL fixtures also
    // support legacy individual claim GUCs. Only fixture auth functions change.
    await db.exec(`
      create or replace function auth.uid() returns uuid language sql as $$
        select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
      $$;
      create or replace function auth.role() returns text language sql as $$
        select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')
      $$;
      create role catalog_authenticator login noinherit;
      grant anon,authenticated,service_role to catalog_authenticator;
    `)
    const port = Number((await db.query('show port')).rows[0].port)
    const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
    const restPort = probe.address().port; await new Promise(resolve => probe.close(resolve))
    const secret = randomBytes(32).toString('hex')
    const config = join(dir, 'postgrest.conf')
    await writeFile(config, `db-uri = "postgresql://catalog_authenticator@127.0.0.1:${port}/postgres"\ndb-schemas = "public"\ndb-anon-role = "anon"\nserver-host = "127.0.0.1"\nserver-port = ${restPort}\njwt-secret = "${secret}"\ndb-pool = 2\n`, { mode: 0o600 })
    server = spawn(process.env.CATALOG_REVIEW_POSTGREST_BIN, [config], { stdio: ['ignore', 'ignore', 'pipe'] })
    server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-3000) })
    const url = `http://127.0.0.1:${restPort}`
    let ready = false
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(url + '/storefront_products?select=id', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break } } catch {}
      if (server.exitCode !== null || server.signalCode !== null) throw Error('Disposable PostgREST exited: ' + logs)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (!ready) throw Error('Disposable PostgREST did not become ready: ' + logs)
    // A fixture session keeps one token. Mock Auth maps and later requests must
    // agree even when their setup crosses a wall-clock second.
    const tokens = new Map()
    const token = name => {
      if (tokens.has(name)) return tokens.get(name)
      const payload = Buffer.from(JSON.stringify({ role: name === 'service' ? 'service_role' : name === 'anon' ? 'anon' : 'authenticated', sub: fixture.actors[name], exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
      const signed = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + payload
      const value = signed + '.' + createHmac('sha256', secret).update(signed).digest('base64url')
      tokens.set(name, value)
      return value
    }
    const request = async (path, { actor = null, method = 'GET', body } = {}) => {
      const headers = { 'content-type': 'application/json' }
      if (actor) headers.authorization = 'Bearer ' + token(actor)
      const response = await fetch(url + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
      const text = await response.text()
      return { status: response.status, body: text ? JSON.parse(text) : null }
    }
    return { ...fixture, db, request, token, close, url }
  } catch (error) { await close(); throw error }
}
