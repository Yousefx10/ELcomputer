// Owned native PostgreSQL + real disk/ffprobe + compiled handlers.
// Auth verification/Supabase transport are explicit fixtures, never hosted calls.
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { build } from 'esbuild'
import { createApp, createRouter, toNodeListener } from 'h3'
import { createEmailNativeDatabase } from './emailNativeDatabase.mjs'
import { createProductSaveFixture } from './productSaveFixture.mjs'

export async function createPrivatePackingFixture(options = {}) {
  const db = await createEmailNativeDatabase(options)
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'packing-vps-'))
  const key = '__packingVps_' + randomUUID().replaceAll('-', '')
  const config = { uploadsDir: join(directory, 'public'), packingVideosDir: join(directory, 'private-a'), packingVideoProbePath: 'ffprobe' }
  let server
  const close = async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
    delete globalThis[key]; await db.close(); await rm(directory, { recursive: true, force: true })
  }
  try {
    const fixture = await createProductSaveFixture({ database: db })
    const { client, actors } = fixture
    const setupRpc = client.rpc
    await mkdir(config.uploadsDir, { mode: 0o750 })
    await db.query("update public.admin_users set permissions=permissions||'{\"dashboard.view\":true,\"dashboard.orders\":true}'::jsonb where id=$1", [actors.editor])
    await db.query('update auth.users set email_confirmed_at=now()')
    const controls = { dropResponseFor: null, failFinishOnce: false, beforeFinish: null, storageCalls: 0 }
    client.auth = {
      getUser: async token => ({ data: { user: actors[token] ? { id: actors[token], email: token + '@product-save.example.invalid' } : null }, error: null }),
      admin: { deleteUser: async id => { await db.query('delete from auth.users where id=$1', [id]); return { error: null } } }
    }
    client.storage = { from() { controls.storageCalls++; throw Error('Supabase Storage object access is forbidden in this fixture') } }
    client.rpc = async (name, args = {}) => {
      if (name === 'packing_video_finish') {
        if (controls.beforeFinish) { const hook = controls.beforeFinish; controls.beforeFinish = null; await hook() }
        if (controls.failFinishOnce) { controls.failFinishOnce = false; return { data: null, error: { code: '08006', message: 'Owned SQL acknowledgement failure' } } }
      }
      const connection = await db.connect('service_role')
      try {
        await connection.query("select set_config('request.jwt.claim.sub',$1,false)", [actors.owner])
        const parameters = Object.keys(args).map((name, i) => name + '=>$' + (i + 1)).join(',')
        const values = Object.values(args).map(value => value !== null && typeof value === 'object' ? JSON.stringify(value) : value)
        return { data: (await connection.query('select public.' + name + '(' + parameters + ') value', values)).rows[0].value, error: null }
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } } }
      finally { await connection.end() }
    }
    globalThis[key] = { client, config }
    const router = createRouter()
    for (const [method, path, file] of [
      ['post', '/api/admin-orders/packing/work-session', 'work-session.post.js'],
      ['post', '/api/admin-orders/packing', 'index.post.js'],
      ['get', '/api/admin-orders/packing/:sessionId', '[sessionId]/index.get.js'],
      ...['scan', 'complete', 'release', 'video-upload', 'video-complete'].map(name => ['post', '/api/admin-orders/packing/:sessionId/' + name, '[sessionId]/' + name + '.post.js']),
      ['put', '/api/admin-orders/packing/:sessionId/video-content', '[sessionId]/video-content.put.js'],
      ['get', '/api/admin-orders/packing/:sessionId/video', '[sessionId]/video.get.js'],
      ...(options.extraRoutes || [])
    ]) {
      const compiled = await build({ entryPoints: [resolve('server/api/admin-orders/packing', file)], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') },
        banner: { js: `const useRuntimeConfig=()=>globalThis[${JSON.stringify(key)}].config; const defineEventHandler=handler=>handler;` }, plugins: [{ name: key, setup(builder) {
          builder.onResolve({ filter: /\/supabaseAdmin(?:\.js)?$/ }, () => ({ path: key, namespace: key }))
          builder.onLoad({ filter: /.*/, namespace: key }, () => ({ contents: `export const getSupabaseAdminClient=()=>globalThis[${JSON.stringify(key)}].client`, loader: 'js' }))
          builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
        } }] })
      const handler = (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
      router[method](path, async event => {
        const result = await handler(event)
        if (controls.dropResponseFor === path) { controls.dropResponseFor = null; event.node.res.destroy() }
        return result
      })
    }
    server = createServer(toNodeListener(createApp({ debug: false }).use(router)))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + server.address().port
    const call = async (path, { method = 'GET', body, actor = 'editor', headers = {}, raw = false, ...rest } = {}) => {
      const response = await fetch(url + path, { method, headers: { ...(actor ? { authorization: 'Bearer ' + actor } : {}), ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}), ...rest })
      return { response, body: response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()) }
    }
    const product = (await db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Owned packing fixture',$1,100,true,true,$2) returning id", ['packing-' + randomUUID(), fixture.warehouse])).rows[0].id
    const variant = (await db.query('select id from public.product_variants where product_id=$1', [product])).rows[0].id
    const receipt = await setupRpc('commerce_create_procurement_order', { p_supplier_id: fixture.supplier, p_warehouse_id: fixture.warehouse, p_invoice_number: 'PACKING-' + randomUUID(), p_notes: 'Owned synthetic stock', p_paid_amount: 0, p_items: [{ product_id: product, variant_id: variant, quantity: 60, unit_cost: 40 }] })
    if (receipt.error) throw Error(receipt.error.message)
    await db.query("update public.site_settings set payment_cash_enabled=true,payment_cash_fee=0,allow_out_of_stock_purchases=false where key='default'")
    const company = (await db.query("insert into public.commerce_shipping_companies(name,checkout_enabled,checkout_governorates,client_shipping_price) values('Fixture delivery',true,array['Cairo'],7) returning id")).rows[0].id
    const claimOrder = async (order, actor = 'editor') => {
      const work = await call('/api/admin-orders/packing/work-session', { actor, method: 'POST', body: { action: 'start' } })
      if (work.response.status !== 200) throw Error(JSON.stringify(work.body))
      const claim = await call('/api/admin-orders/packing', { actor, method: 'POST', body: { orderId: order, workSessionId: work.body.workSession.id, cameraReady: true, cameraLabel: 'Owned generated camera fixture' } })
      if (claim.response.status !== 200) throw Error(JSON.stringify(claim.body))
      const session = (await db.query("select * from public.order_packing_sessions where order_id=$1 and status='active'", [order])).rows[0]
      const units = (await db.query('select * from public.commerce_serialized_units where customer_order_id=$1 order by unit_code', [order])).rows
      return { order, session, units, actor, path: '/api/admin-orders/packing/' + session.id }
    }
    const newPack = async (quantity = 2, actor = 'editor', { paymentMethod = 'cash', beforePack = async () => {} } = {}) => {
      const p_order = { first_name: 'Fixture buyer', email: 'customer@product-save.example.invalid', street_address: 'Owned street', city: 'Fixture city', governorate: 'Cairo', phone: '01012345678', shipping_method: 'shipping', shipping_company_id: company, payment_method: paymentMethod, locale: 'en' }
      const p_items = [{ product_id: product, variant_id: variant, quantity }], p_cart_id = randomUUID(), p_user_id = actors.customer
      const quote = await client.rpc('commerce_checkout_quote', { p_user_id, p_cart_id, p_order, p_items })
      if (quote.error) throw Error(quote.error.message)
      const command = await client.rpc('commerce_checkout_command', { p_user_id, p_cart_id, p_order, p_items, p_quote_id: quote.data.quoteId })
      if (command.error) throw Error(command.error.message)
      await beforePack(command.data.order.id)
      return claimOrder(command.data.order.id, actor)
    }
    const scan = async pack => {
      for (const unit of pack.units) {
        const result = await call(pack.path + '/scan', { actor: pack.actor, method: 'POST', body: { code: unit.unit_code } })
        if (result.response.status !== 200) throw Error(JSON.stringify(result.body))
      }
    }
    return { ...fixture, directory, config, controls, url, call, newPack, claimOrder, scan, close }
  } catch (error) { await close(); throw error }
}
