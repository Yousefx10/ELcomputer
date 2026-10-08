import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClaimsHttpFixture } from './helpers/claimsHttpFixture.mjs'

test('actual Claims HTTP APIs enforce customer ownership, RBAC, evidence boundaries and server decisions', async t => {
  const f = await createClaimsHttpFixture(), { url, close } = await f.start()
  const call = async (path, { actor = 'buyer', method = 'GET', body, raw } = {}) => {
    const response = await fetch(url + path, { method, headers: { ...(actor ? { authorization: 'Bearer ' + actor } : {}), ...(body && !(body instanceof FormData) || raw ? { 'content-type': 'application/json' } : {}) }, ...(body || raw ? { body: raw ?? (body instanceof FormData ? body : JSON.stringify(body)) } : {}) })
    const parsed = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())
    return { response, body: parsed }
  }
  const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
  const upload = (type, file = png, mime = 'image/png', name = 'photo.png', id = randomUUID(), reason = 'changed_mind', target = null) => {
    const form = new FormData(); form.append('attachmentId', id); form.append('type', type); if (target) form.append('claimId', target); else if (type === 'return') form.append('reasonKey', reason); form.append('file', new Blob([file], { type: mime }), name); return form
  }
  try {
    await f.enable(); const item = await f.purchase(2), path = '/api/account/after-sales/items/' + item.id
    await t.test('anonymous, disabled and foreign customers are denied; browser staff fields are never accepted', async () => {
      for (const [actor, status] of [[null,401],['anonymous',403],['disabled',403]]) assert.equal((await call('/api/account/after-sales/claims', { actor })).response.status, status)
      assert.equal((await call(path, { actor: 'stranger', method: 'POST', body: f.body(item) })).response.status, 404)
      for (const extra of [{ status: 'approved' }, { serial_verified: true }, { eligibility: true }, { policy_version_id: randomUUID() }, { evidence: true }]) assert.equal((await call('/api/account/after-sales/claims', { method: 'POST', body: { ...f.body(item), ...extra } })).response.status, 400)
      for (const actor of ['buyer','stranger','anonymous']) assert.equal((await call('/api/admin-after-sales/claims', { actor })).response.status, 403)
      assert.equal((await call('/api/admin-after-sales/claims', { actor: 'viewer' })).response.status, 200)
      assert.equal((await call(path, { method: 'POST', raw: '[' })).response.status, 400)
      assert.equal((await call(path, { method: 'POST', raw: JSON.stringify({ padding: 'x'.repeat(33000) }) })).response.status, 413)
    })
    let attachment, claim
    await t.test('private upload validates MIME, signature, extension and bytes; server preview uses owned ready files', async () => {
      for (const body of [upload('return', png, 'image/png', 'run.exe'), upload('return', Buffer.from('fake'), 'image/png'), upload('return', png, 'video/mp4', 'movie.mp4')]) assert.equal((await call(path + '/evidence', { method: 'POST', body })).response.status, 400)
      const oversized = await call(path + '/evidence', { method: 'POST', body: upload('return', Buffer.concat([png,Buffer.alloc(5242881-png.length)]), 'image/png', 'large.png') })
      assert.equal(oversized.response.status, 400); assert.equal(oversized.body.data.code, 'size')
      const uploaded = await call(path + '/evidence', { method: 'POST', body: upload('return') }); assert.equal(uploaded.response.status, 200, JSON.stringify(uploaded.body)); attachment = uploaded.body.item
      assert.ok(!JSON.stringify(uploaded.body).includes('storage_path'))
      assert.equal((await call(path + '/evidence?type=return')).response.status, 200)
      const input = f.body(item, 'return', { attachment_ids: [attachment.id] })
      const preview = await call(path, { method: 'POST', body: input }); assert.equal(preview.body.can_submit, true)
      const result = await call('/api/account/after-sales/claims', { method: 'POST', body: input }); assert.equal(result.response.status, 200, JSON.stringify(result.body)); claim = result.body
      const retry = await call('/api/account/after-sales/claims', { method: 'POST', body: input }); assert.deepEqual(retry.body, claim)
      const detail = await call('/api/account/after-sales/claims/' + claim.id); assert.equal(detail.response.headers.get('cache-control'), 'private, no-store'); assert.equal(detail.body.attachments.length, 1)
      assert.equal((await call('/api/account/after-sales/claims/' + claim.id, { actor: 'stranger' })).response.status, 404)
    })
    await t.test('retrieval is authorized, integrity checked and forced download; submitted evidence cannot be erased', async () => {
      const filePath = '/api/account/after-sales/evidence/' + attachment.id
      const result = await call(filePath); assert.deepEqual(result.body, png); assert.equal(result.response.headers.get('content-type'), 'application/octet-stream'); assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff'); assert.match(result.response.headers.get('content-security-policy'), /sandbox/)
      assert.equal((await call(filePath, { actor: 'stranger' })).response.status, 404)
      assert.equal((await call(filePath, { method: 'DELETE' })).response.status, 404)
      assert.equal((await call('/api/admin-after-sales/claims/evidence/' + attachment.id, { actor: 'viewer' })).response.status, 403)
      assert.deepEqual((await call('/api/admin-after-sales/claims/evidence/' + attachment.id, { actor: 'evidence' })).body, png)
      assert.equal((await call('/api/admin-after-sales/claims/' + claim.id, { actor: 'viewer' })).body.attachments.length, 0)
      const objectKey = [...f.objects.keys()][0]; f.objects.set(objectKey, Buffer.from('corrupted')); assert.equal((await call(filePath)).response.status, 404); f.objects.set(objectKey, png)
    })
    await t.test('granular staff actions, private notes, stale revisions and foreign mutation attempts are denied', async () => {
      const staffPath = '/api/admin-after-sales/claims/' + claim.id
      let detail = (await call(staffPath, { actor: 'reviewer' })).body
      assert.ok(detail.allowed_actions.includes('review')); assert.ok(!detail.allowed_actions.includes('note'))
      assert.equal((await call(staffPath + '/actions', { actor: 'viewer', method: 'POST', body: { action: 'review', revision: detail.claim.revision } })).response.status, 403)
      assert.equal((await call(staffPath + '/actions', { actor: 'reviewer', method: 'POST', body: { action: 'review', revision: detail.claim.revision } })).response.status, 200)
      assert.equal((await call(staffPath + '/actions', { actor: 'reviewer', method: 'POST', body: { action: 'review', revision: detail.claim.revision } })).response.status, 409)
      detail = (await call(staffPath, { actor: 'notes' })).body
      assert.equal((await call(staffPath + '/actions', { actor: 'notes', method: 'POST', body: { action: 'note', revision: detail.claim.revision, text: 'INTERNAL-CLAIM-NOTE' } })).response.status, 200)
      assert.ok(!JSON.stringify((await call('/api/account/after-sales/claims/' + claim.id)).body).includes('INTERNAL-CLAIM-NOTE'))
      assert.equal((await call('/api/account/after-sales/claims/' + claim.id + '/actions', { actor: 'stranger', method: 'POST', body: { action: 'cancel', revision: 3, text: 'Foreign request' } })).response.status, 404)
      assert.equal((await call('/api/account/after-sales/claims/' + claim.id + '/actions', { method: 'POST', body: { action: 'approve', revision: 3, text: 'Forged decision' } })).response.status, 400)
    })
    await t.test('stored submission snapshot is re-evaluated server-side; earlier preview cannot authorize a later expired claim', async () => {
      const fresh = await f.purchase(), input = f.body(fresh), preview = await call('/api/account/after-sales/items/' + fresh.id, { method: 'POST', body: input }); assert.equal(preview.body.can_submit, true)
      await f.db.query("update public.customer_orders set created_at=clock_timestamp()-interval '2 years' where id=$1", [fresh.order_id])
      assert.equal((await call('/api/account/after-sales/claims', { method: 'POST', body: input })).response.status, 409)
      const list = await call('/api/admin-after-sales/claims?type=return&search=' + encodeURIComponent(claim.reference), { actor: 'viewer' }); assert.equal(list.body.total, 1)
      for (const call of f.storageCalls) assert.equal(call.bucket, 'after-sales-evidence')
      assert.equal(Number((await f.db.query('select count(*) n from public.shipping_order_jobs')).rows[0].n), 0)
      assert.equal(Number((await f.db.query('select count(*) n from public.sms_batches')).rows[0].n), 0)
    })
  } finally { await close() }
})
