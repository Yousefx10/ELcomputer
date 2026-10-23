// Actual SQL and HTTP handlers in an owned laboratory. Auth token verification
// and Supabase transport are fixtures; no hosted endpoint or provider is used.
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp, createRouter, readBody, setHeader, toNodeListener } from 'h3'
import { createEmailNativeDatabase } from './emailNativeDatabase.mjs'
import { createProductSaveFixture } from './productSaveFixture.mjs'

export async function createCodCheckoutFixture(options = {}) {
  const db = await createEmailNativeDatabase(options)
  let fixture, server
  const key = '__codCheckout_' + randomUUID().replaceAll('-', '')
  const close = async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    delete globalThis[key]; delete globalThis[key + 'Runtime']; await db.close()
  }
  try {
    fixture = await createProductSaveFixture({ database: db })
    await db.query('update auth.users set email_confirmed_at=now()')
    fixture.client.auth = { getUser: async token => ({ data: { user: fixture.actors[token]
      ? { id: fixture.actors[token], email: token + '@product-save.example.invalid', is_anonymous: false } : null }, error: null }) }
    // Independent native connections make simultaneous checkout calls real.
    fixture.client.rpc = async (name, args = {}) => {
      const connection = await db.connect()
      try {
        await connection.query("select set_config('request.jwt.claim.sub',$1,false)", [fixture.actors.owner])
        const parameters = Object.keys(args).map((key, index) => key + '=>$' + (index + 1)).join(',')
        const values = Object.values(args).map(value => value !== null && typeof value === 'object' ? JSON.stringify(value) : value)
        return { data: (await connection.query('select public.' + name + '(' + parameters + ') value', values)).rows[0].value, error: null }
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } } }
      finally { await connection.end() }
    }
    globalThis[key] = fixture.client
    globalThis[key + 'Runtime'] = options.runtime || { paymobEnabled: false, public: { purchasingEnabled: true } }
    globalThis.defineEventHandler = handler => handler; globalThis.readBody = readBody; globalThis.setHeader = setHeader
    const controls = { loseResponse: false }, router = createRouter()
    for (const [method, path, file] of [
      ['post', '/api/checkout/quote', 'server/api/checkout/quote.post.js'],
      ['post', '/api/checkout', 'server/api/checkout/index.post.js'],
      ['get', '/api/checkout/shipping', 'server/api/checkout/shipping.get.js'],
      ['get', '/api/admin-orders', 'server/api/admin-orders/index.get.js'],
      ['get', '/api/admin-orders/:id', 'server/api/admin-orders/[id].get.js'],
      ['patch', '/api/admin-orders/:id', 'server/api/admin-orders/[id].patch.js'],
      ...(options.routes || [])
    ]) {
      const compiled = await build({ entryPoints: [resolve(file)], bundle: true, write: false, format: 'esm', platform: 'node',
        alias: { '~': resolve('app') }, banner: { js: 'const useRuntimeConfig=()=>globalThis[' + JSON.stringify(key + 'Runtime') + '];' }, plugins: [{ name: key, setup(builder) {
          builder.onResolve({ filter: /\/supabaseAdmin(?:\.js)?$/ }, () => ({ path: key, namespace: key }))
          builder.onLoad({ filter: /.*/, namespace: key }, () => ({ contents: 'export const getSupabaseAdminClient=()=>globalThis[' + JSON.stringify(key) + ']', loader: 'js' }))
          builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
        } }] })
      const handler = (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
      router[method](path, async event => {
        const result = await handler(event)
        if (path === '/api/checkout' && controls.loseResponse) { controls.loseResponse = false; event.node.res.destroy() }
        return result
      })
    }
    server = createServer(toNodeListener(createApp({ debug: false }).use(router)))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + server.address().port
    const call = async (path, { method = 'GET', body, actor = 'customer' } = {}) => {
      const response = await fetch(url + path, { method, headers: { ...(actor ? { authorization: 'Bearer ' + actor } : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      return { response, body: await response.json() }
    }
    return { ...fixture, db, call, controls, close }
  } catch (error) { await close(); throw error }
}
