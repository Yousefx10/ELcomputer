import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp, createRouter, readBody, toNodeListener } from 'h3'
import { createProductSaveFixture } from './productSaveFixture.mjs'

// Actual routes, guards and SQL. Only hosted Auth verification and the
// Supabase transport are replaced. This server owns a disposable database.
export async function createProductSaveHttpFixture(options = {}) {
  const fixture = await createProductSaveFixture(options)
  const key = '__productSaveHttp_' + randomUUID().replaceAll('-', '')
  fixture.client.auth = { getUser: async token => ({ data: {
    user: fixture.actors[token] ? { id: fixture.actors[token], is_anonymous: false } : null
  }, error: null }) }
  globalThis[key] = fixture.client
  globalThis.defineEventHandler = handler => handler
  globalThis.readBody = readBody
  const router = createRouter()
  const controls = { loseResponse: false, delay: 0, writes: 0 }
  const rpc = fixture.client.rpc
  controls.rpcErrors = []
  fixture.client.rpc = async (name, args) => {
    const result = await rpc(name, args)
    if (result.error) controls.rpcErrors.push({ name, error: result.error })
    return result
  }
  let server
  const close = async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
    delete globalThis[key]
    await fixture.db.close()
  }
  try {
    for (const [method, path, file] of [
      ['post', '/api/admin-products', 'server/api/admin-products/index.post.js'],
      ['patch', '/api/admin-products/:id', 'server/api/admin-products/[id].patch.js'],
      ['get', '/api/admin-products', 'server/api/admin-products/index.get.js'],
      ['get', '/api/admin-products/:id', 'server/api/admin-products/[id].get.js']
    ]) {
      const compiled = await build({ entryPoints: [resolve(file)], bundle: true, write: false,
        format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{
          name: 'owned-product-save-transport', setup(builder) {
            builder.onResolve({ filter: /\/supabaseAdmin$/ }, () => ({ path: key, namespace: key }))
            builder.onLoad({ filter: /.*/, namespace: key }, () => ({
              contents: `export const getSupabaseAdminClient=()=>globalThis[${JSON.stringify(key)}]`, loader: 'js'
            }))
            builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
          }
        }] })
      const handler = (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
      router[method](path, async event => {
        const write = method !== 'get'
        if (write) { controls.writes++; if (controls.delay) await new Promise(resolve => setTimeout(resolve, controls.delay)) }
        const result = await handler(event)
        if (write && controls.loseResponse) {
          controls.loseResponse = false
          event.node.res.destroy() // Database commit completed; acknowledgement is lost.
        }
        return result
      })
    }
    const listener = toNodeListener(createApp({ debug: false }).use(router))
    server = createServer((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader('Access-Control-Allow-Headers', 'authorization,content-type')
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
      if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
      listener(request, response)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}`
    const call = async (path, { actor = 'owner', method = 'GET', body } = {}) => {
      const response = await fetch(url + path, { method, headers: {
        authorization: actor ? 'Bearer ' + actor : '', 'content-type': 'application/json'
      }, ...(body ? { body: JSON.stringify(body) } : {}) })
      return { response, body: await response.json() }
    }
    return { ...fixture, url, call, controls, close }
  } catch (error) { await close(); throw error }
}
