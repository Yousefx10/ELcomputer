import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp, createRouter, readBody, toNodeListener } from 'h3'
import { createProductSaveFixture } from './productSaveFixture.mjs'

// Actual guards, handlers and application SQL. Hosted Auth/token verification
// and Supabase transport are explicit fixtures, never production credentials.
export async function createDashboardAccessFixture() {
  const fixture = await createProductSaveFixture()
  const key = '__dashboardAccess_' + randomUUID().replaceAll('-', '')
  const { db, client, actors } = fixture
  await db.query('update public.admin_users set permissions=$2 where id=$1',
    [actors.disabled, JSON.stringify({ 'products.view': true, 'products.edit': true })])
  const restricted = randomUUID()
  await db.query('insert into auth.users(id,email) values($1,$2)', [restricted, 'staff@independent.example.test'])
  await db.query("insert into public.admin_users(id,email,role,permissions,is_active) values($1,$2,'admin','{}',true)",
    [restricted, 'staff@independent.example.test'])
  actors.restricted = restricted
  client.auth = { getUser: async token => ({ data: { user: actors[token] ? { id: actors[token] } : null }, error: null }) }
  const baseFrom = client.from
  client.from = table => {
    // Exact-count transport for the real summary handler. SQL is confined to
    // fixture tables/known columns; its permission branches remain unchanged.
    if (!['customer_orders', 'customer_profiles', 'storefront_products', 'categories'].includes(table)) return baseFrom(table)
    let count = false
    const parameters = [], predicates = []
    const identifier = value => {
      if (!/^[a-z_]+$/.test(value)) throw Error('Fixture column refused')
      return value
    }
    const parameter = value => { parameters.push(value); return '$' + parameters.length }
    const original = baseFrom(table)
    const query = {
      select(columns, options = {}) { count = options.count === 'exact'; if (!count) original.select(columns, options); return query },
      eq(column, value) { predicates.push(identifier(column) + '=' + parameter(value)); if (!count) original.eq(column, value); return query },
      in(column, values) { predicates.push(identifier(column) + '=any(' + parameter(values) + ')'); return query },
      gte(column, value) { predicates.push(identifier(column) + '>=' + parameter(value)); return query },
      async then(resolve, reject) {
        if (!count) return original.then(resolve, reject)
        try {
          const result = await db.query('select count(*)::int as n from public.' + table + (predicates.length ? ' where ' + predicates.join(' and ') : ''), parameters)
          resolve({ count: result.rows[0].n, error: null })
        } catch (error) { resolve({ error }) }
      }
    }
    return query
  }
  globalThis[key] = client
  const router = createRouter()
  const handlerFiles = [
    ['get', '/api/admin-erp/state', 'server/api/admin-erp/state.get.js'],
    ['get', '/api/admin-dashboard/summary', 'server/api/admin-dashboard/summary.get.js'],
    ['get', '/api/admin-products/list', 'server/api/admin-products/list.get.js'],
    ['get', '/api/admin-products/filter-options', 'server/api/admin-products/filter-options.get.js'],
    ['get', '/api/admin-inventory/items', 'server/api/admin-inventory/items/index.get.js'],
    ['get', '/api/admin-inventory/options', 'server/api/admin-inventory/options.get.js'],
    ['get', '/api/admin-products/:id', 'server/api/admin-products/[id].get.js'],
    ['post', '/api/admin-logs', 'server/api/admin-logs/index.post.js']
  ]
  let server
  try {
    for (const [method, path, file] of handlerFiles) {
      const compiled = await build({ entryPoints: [resolve(file)], bundle: true, write: false, format: 'esm', platform: 'node',
        alias: { '~': resolve('app') }, plugins: [{ name: 'isolated-dashboard-transport', setup(builder) {
          builder.onResolve({ filter: /\/supabaseAdmin$/ }, () => ({ path: key, namespace: key }))
          builder.onLoad({ filter: /.*/, namespace: key }, () => ({ contents: `export const getSupabaseAdminClient=()=>globalThis[${JSON.stringify(key)}]`, loader: 'js' }))
          builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
        } }], banner: { js: 'const defineEventHandler=handler=>handler;const readBody=globalThis[' + JSON.stringify(key + '_readBody') + '];' } })
      globalThis[key + '_readBody'] = readBody
      const handler = (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
      router[method](path, handler)
    }
    const app = createApp({ onError: error => { if (error.statusCode >= 500) error.unhandled = false } })
    app.use(router)
    server = createServer(toNodeListener(app))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + server.address().port
    return { ...fixture, origin, async call(path, { token, body, headers = {} } = {}) {
      const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST',
        headers: { ...headers, ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: response.status, data: await response.json(), headers: response.headers }
    }, async close() {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
      delete globalThis[key]
      delete globalThis[key + '_readBody']
      await db.close()
    } }
  } catch (error) {
    if (server?.listening) server.close()
    delete globalThis[key]
    delete globalThis[key + '_readBody']
    await db.close()
    throw error
  }
}
