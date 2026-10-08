// Real H3 handlers + current RBAC + disposable application SQL. Auth and Storage
// transport are isolated fixtures, never production sessions or provider calls.
import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp, createRouter, toNodeListener } from 'h3'
import { createClaimsFixture } from './claimsFixture.mjs'

export const createClaimsHttpFixture = async () => {
  const f = await createClaimsFixture(), actors = { buyer: f.customer, owner: f.owner }, objects = new Map(), storageCalls = []
  const permissions = { viewer: [], reviewer: ['review'], manager: ['manage'], evidence: ['evidence'], notes: ['notes'], decider: ['decide'], resolver: ['resolution'] }
  for (const [name, keys] of Object.entries(permissions)) {
    actors[name] = randomUUID()
    await f.db.query('insert into auth.users(id,email) values($1,$2)', [actors[name], name + '@claims.example.invalid'])
    await f.db.query("insert into public.admin_users(id,email,role,permissions) values($1,$2,'admin',$3)", [actors[name], name + '@claims.example.invalid', JSON.stringify({ 'claims.view': true, ...Object.fromEntries(keys.map(key => ['claims.' + key, true])) })])
  }
  for (const name of ['stranger', 'anonymous', 'disabled']) {
    actors[name] = randomUUID()
    await f.db.query('insert into auth.users(id,email,is_anonymous) values($1,$2,$3)', [actors[name], name + '@claims.example.invalid', name === 'anonymous'])
  }
  await f.db.query('update public.customer_profiles set is_active=false where id=$1', [actors.disabled])
  f.client.auth = { getUser: async token => ({ data: { user: actors[token] ? { id: actors[token], is_anonymous: token === 'anonymous' } : null }, error: null }) }
  f.client.storage = { from: bucket => ({
    async upload(path, bytes, options) {
      storageCalls.push({ action: 'upload', bucket, path, upsert: options.upsert })
      if (objects.has(path)) return { error: { message: 'Already exists' } }
      objects.set(path, Buffer.from(bytes)); await f.db.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, path]); return { data: { path }, error: null }
    },
    async download(path) { storageCalls.push({ action: 'download', bucket, path }); return objects.has(path) ? { data: new Blob([objects.get(path)]), error: null } : { data: null, error: { message: 'Missing file' } } },
    async remove(paths) { storageCalls.push({ action: 'remove', bucket, paths }); for (const path of paths) { objects.delete(path); await f.db.query('delete from storage.objects where bucket_id=$1 and name=$2', [bucket, path]) }; return { error: null } }
  }) }
  const databaseKey = 'claimsFixture_' + randomUUID().replaceAll('-', '')
  globalThis[databaseKey] = f.client; globalThis.defineEventHandler = handler => handler
  const router = createRouter(), routes = []
  const visit = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = dir + '/' + entry.name
      if (entry.isDirectory()) await visit(file)
      else {
        const matched = /\.(get|post|delete)\.js$/.exec(file)
        if (!matched) continue
        const route = '/' + file.replace(/^server\//, '').replace(/\.(get|post|delete)\.js$/, '').replace(/\/index$/, '').replace(/\[([^\]]+)\]/g, ':$1')
        const compiled = await build({ entryPoints: [resolve(file)], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{ name: 'claims-database-fixture', setup(builder) {
          builder.onResolve({ filter: /\/supabaseAdmin(?:\.js)?$/ }, () => ({ path: 'database', namespace: 'claims-fixture' }))
          builder.onLoad({ filter: /.*/, namespace: 'claims-fixture' }, () => ({ contents: `export const getSupabaseAdminClient=()=>globalThis.${databaseKey}`, loader: 'js' }))
          builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
        } }] })
        router[matched[1]](route, (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default)
        routes.push({ method: matched[1].toUpperCase(), route })
      }
    }
  }
  await visit('server/api/account/after-sales'); await visit('server/api/admin-after-sales/claims')
  const app = createApp().use(router)
  return { ...f, actors, objects, storageCalls, routes, app,
    async start(extraHandler = null) {
      if (extraHandler) app.use(extraHandler)
      const server = createServer(toNodeListener(app)); await new Promise(done => server.listen(0, '127.0.0.1', done))
      const url = 'http://127.0.0.1:' + server.address().port
      const close = async () => { await new Promise(done => server.close(done)); delete globalThis[databaseKey]; await f.db.close() }
      return { server, url, close }
    }
  }
}
