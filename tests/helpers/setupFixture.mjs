import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { createApp, createRouter, toNodeListener } from 'h3'
import { createEmailFixture, emailFixtureRuntime } from './emailFixture.mjs'

export const SETUP_CANARY = 'setup-private-value-must-never-reach-browser-123456'
export const createSetupFixture = async () => {
  const f = await createEmailFixture()
  const runtime = { ...emailFixtureRuntime, shippingCredentialsEncryptionKey: SETUP_CANARY, shippingWorkerSecret: SETUP_CANARY,
    supabaseServiceRoleKey: SETUP_CANARY, daftraApiKey: SETUP_CANARY, daftraAccountUrl: '', paymobEnabled: false, paymobMode: 'test',
    smsWorkerSecret: SETUP_CANARY, emailWorkerSecret: SETUP_CANARY, erpWorkerSecret: SETUP_CANARY,
    public: { siteUrl: 'https://store.example.invalid', supabaseUrl: 'https://setup.example.invalid', supabase: { key: 'fixture-public-key' } } }
  globalThis.useRuntimeConfig = () => runtime
  await f.db.query("insert into public.site_settings(key,site_name,site_logo_url,footer_email,footer_address,payment_cash_enabled) values('default','Fixture Store','/uploads/logo.png','store@example.invalid','Fixture address',true)")
  await f.db.query("insert into public.commerce_shipping_companies(name,is_active) values('Fixture courier',true)")
  const queries = [], originalQuery = f.db.query.bind(f.db)
  f.db.query = async (sql, values) => {
    queries.push(sql)
    const result = await originalQuery(sql, values)
    // PostgREST serializes timestamps to strings; PGlite returns Date objects.
    return { ...result, rows: JSON.parse(JSON.stringify(result.rows)) }
  }
  const key = 'setupFixture_' + randomUUID().replaceAll('-', '')
  globalThis[key] = f.client
  globalThis.defineEventHandler = fn => fn
  const output = await build({ entryPoints: [resolve('server/api/admin-setup/status.get.js')], bundle: true, write: false,
    format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{ name: 'isolated-setup-database', setup(builder) {
      builder.onResolve({ filter: /\/supabaseAdmin(?:\.js)?$/ }, () => ({ path: 'database', namespace: 'setup-fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'setup-fixture' }, () => ({ contents: `export const getSupabaseAdminClient=()=>globalThis.${key}`, loader: 'js' }))
      builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
    } }] })
  const handler = (await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))).default
  const router = createRouter().get('/api/admin-setup/status', handler)
  const app = createApp().use(router)
  const snapshot = async () => {
    const tables = (await originalQuery("select tablename from pg_tables where schemaname='public' order by tablename")).rows
    return Object.fromEntries(await Promise.all(tables.map(async ({ tablename }) => [tablename,
      (await originalQuery(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) hash from public.${tablename} t`)).rows[0].hash])))
  }
  return { ...f, runtime, queries, snapshot, async start(extra = null) {
    if (extra) app.use(extra)
    const server = createServer(toNodeListener(app))
    await new Promise(done => server.listen(0, '127.0.0.1', done))
    return { url: 'http://127.0.0.1:' + server.address().port, close: async () => {
      await new Promise(done => server.close(done)); delete globalThis[key]; await f.db.close()
    } }
  } }
}
