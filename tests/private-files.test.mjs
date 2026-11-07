import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, chmod, realpath, readFile, stat, symlink, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPrivateBucket, privateFileKey, vpsStorage, PRIVATE_BUCKET_LIMITS } from '../server/utils/privateFiles.js'

// Owner request 7 Nov 2026 (STORAGE-VPS-01): files live on the VPS private disk, Supabase is the database only.
const root = async () => { const dir = await realpath(await mkdtemp(join(tmpdir(), 'private-files-'))); await chmod(dir, 0o700); return dir }
const withRuntime = async (dir, fn) => {
  const previous = globalThis.useRuntimeConfig
  globalThis.useRuntimeConfig = () => ({ shippingDocumentsDir: dir, uploadsDir: 'storage/uploads' })
  try { return await fn() } finally { globalThis.useRuntimeConfig = previous }
}

test('stored paths map to private folders per former bucket; anything else is refused', () => {
  assert.equal(privateFileKey('admin-documents', 'root/7b6f3c1e-1111-4111-8111-111111111111.pdf'), 'vps-v1/storage/admin-documents/root/7b6f3c1e-1111-4111-8111-111111111111.pdf')
  assert.equal(privateFileKey('chat-attachments', 'a/b/c.png'), 'vps-v1/storage/chat-attachments/a/b/c.png')
  for (const bad of ['../x.pdf', 'a/../b.pdf', '/abs/x.pdf', 'x.pdf', 'a/b/c/d/e.pdf', 'a//b.pdf', 'a/b c.pdf']) assert.equal(privateFileKey('admin-documents', bad), null, bad)
  assert.equal(privateFileKey('public-bucket', 'a/b.pdf'), null)
  assert.deepEqual(Object.keys(PRIVATE_BUCKET_LIMITS).sort(), ['admin-documents', 'after-sales-evidence', 'chat-attachments', 'order-packing-videos', 'shipping-labels', 'support-attachments'])
})

test('upload, download and remove keep the Supabase Storage contract on the private disk', async () => {
  const dir = await root()
  await withRuntime(dir, async () => {
    const bucket = vpsStorage.from('support-attachments'), path = 'ticket/message/file.pdf', bytes = Buffer.from('%PDF-1.7 owned')
    assert.equal((await bucket.upload(path, bytes, { contentType: 'application/pdf', upsert: false })).error, null)
    const file = join(dir, 'vps-v1/storage/support-attachments', path)
    assert.deepEqual(await readFile(file), bytes); assert.equal((await stat(file)).mode & 0o777, 0o600); assert.equal((await stat(join(dir, 'vps-v1/storage'))).mode & 0o777, 0o700)
    const again = await bucket.upload(path, Buffer.from('other'), { upsert: false })
    assert.equal(again.error.statusCode, '409', 'no overwrite without upsert'); assert.deepEqual(await readFile(file), bytes)
    const read = await bucket.download(path); assert.deepEqual(Buffer.from(await read.data.arrayBuffer()), bytes)
    assert.equal((await bucket.download('ticket/message/missing.pdf')).error.statusCode, '404')
    assert.equal((await bucket.remove([path, 'ticket/message/missing.pdf', '../escape'])).error, null)
    assert.equal((await bucket.download(path)).error.statusCode, '404')
    assert.equal((await vpsStorage.from('avatars').upload('a/b.png', bytes)).error.statusCode, '404', 'unknown buckets never fall back to Supabase')
  })
})

test('size limits, linked folders and unsafe roots fail closed', async () => {
  const dir = await root()
  await withRuntime(dir, async () => {
    const big = Buffer.alloc(PRIVATE_BUCKET_LIMITS['chat-attachments'] + 1)
    assert.equal((await vpsStorage.from('chat-attachments').upload('a/b/c.png', big)).error.statusCode, '413')
    const outside = await root()
    await mkdir(join(dir, 'vps-v1/storage'), { recursive: true, mode: 0o700 })
    await symlink(outside, join(dir, 'vps-v1/storage/admin-documents'))
    assert.ok((await vpsStorage.from('admin-documents').upload('root/x.pdf', Buffer.from('%PDF-'))).error, 'a linked folder is refused')
    await mkdir(join(outside, 'root'), { mode: 0o700 }); await writeFile(join(outside, 'root/x.pdf'), 'secret')
    assert.ok((await vpsStorage.from('admin-documents').download('root/x.pdf')).error, 'never reads through a link')
  })
  await withRuntime('relative/path', async () => assert.ok((await createPrivateBucket('admin-documents').upload('root/x.pdf', Buffer.from('x'))).error))
})

test('the server admin client stores files on the VPS, never in Supabase Storage', async () => {
  const source = await readFile('server/utils/supabaseAdmin.js', 'utf8')
  assert.match(source, /Object\.defineProperty\(cachedSupabaseAdminClient, 'storage', \{ value: vpsStorage/)
  for (const file of ['server/utils/liveChatAttachments.js', 'server/utils/supportTickets.js', 'server/utils/afterSalesClaims.js', 'server/api/admin-documents/files/index.post.js', 'server/utils/systemReset.js']) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /createClient\(/, file + ' uses the shared admin client')
  }
})
