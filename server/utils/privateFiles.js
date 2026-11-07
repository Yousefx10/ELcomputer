import { constants, promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { getShippingDocumentsRoot } from './privateShippingDocuments.js'

// Owner request 7 Nov 2026 (STORAGE-VPS-01): files live on the VPS disk; Supabase is only the
// database. The former Supabase Storage buckets become private folders on the VPS private disk:
//   <private documents root>/vps-v1/storage/<bucket>/<stored path>
// Stored paths in the database are unchanged. The server's Supabase admin client uses this store
// for `.storage`, so features keep their upload/retry/cleanup logic and never call Supabase Storage.
export const PRIVATE_BUCKET_LIMITS = Object.freeze({
  'admin-documents': 26214400, 'chat-attachments': 5242880, 'support-attachments': 5242880,
  'after-sales-evidence': 5242880, 'order-packing-videos': 50000000, 'shipping-labels': 10485760
})
const PATH = /^(?:[A-Za-z0-9_-]{1,64}\/){1,3}[A-Za-z0-9_-]{1,64}(?:\.[A-Za-z0-9]{1,10})?$/
export const isPrivateStoredPath = value => typeof value === 'string' && PATH.test(value)
export const privateFileKey = (bucket, path) => {
  if (!Object.hasOwn(PRIVATE_BUCKET_LIMITS, bucket) || !isPrivateStoredPath(path)) return null
  return `vps-v1/storage/${bucket}/${path}`
}

const problem = (message, statusCode = '500') => ({ message, statusCode, name: 'StorageError' })
const insecure = () => Object.assign(new Error('Private file storage is unavailable.'), { insecure: true })
const inside = (root, path) => path === root || path.startsWith(root + '/')
const checkDirectory = async path => {
  const s = await fs.lstat(path)
  if (s.isSymbolicLink() || !s.isDirectory() || s.mode & 0o077 || (typeof process.getuid === 'function' && s.uid !== process.getuid())) throw insecure()
  if (await fs.realpath(path) !== path) throw insecure()
}
const checkFile = s => {
  if (s.isSymbolicLink() || !s.isFile() || s.mode & 0o077 || s.nlink !== 1 || (typeof process.getuid === 'function' && s.uid !== process.getuid())) throw insecure()
}
const syncPath = async path => { const h = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { await h.sync() } finally { await h.close() } }

// Resolves the file location, creating 0700 folders when asked. Never follows links.
const locate = async (key, create, configuredRoot) => {
  const root = await getShippingDocumentsRoot({ create, configuredRoot })
  let parent = root
  for (const part of key.split('/').slice(0, -1)) {
    parent = join(parent, part)
    if (create) {
      try { await fs.mkdir(parent, { mode: 0o700 }); await syncPath(dirname(parent)) }
      catch (error) { if (error.code !== 'EEXIST') throw error }
    }
    await checkDirectory(parent)
  }
  const path = join(parent, key.split('/').at(-1))
  if (!inside(root, path)) throw insecure()
  return { path, parent }
}
const toBuffer = async body => {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (body && typeof body.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer())
  throw new Error('Unsupported file body.')
}

export const createPrivateBucket = (bucket, { configuredRoot = null } = {}) => ({
  // Same contract as Supabase Storage: no overwrite unless upsert; { data, error } results.
  async upload(path, body, { upsert = false } = {}) {
    const key = privateFileKey(bucket, path)
    if (!key) return { data: null, error: problem('Invalid file path.', '400') }
    let temporary, handle
    try {
      const bytes = await toBuffer(body)
      if (bytes.length > PRIVATE_BUCKET_LIMITS[bucket]) return { data: null, error: problem('The file is too large.', '413') }
      const { path: target, parent } = await locate(key, true, configuredRoot)
      temporary = join(parent, '.' + randomUUID() + '.pending')
      handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null
      if (upsert) await fs.rename(temporary, target)
      else {
        try { await fs.link(temporary, target) }
        catch (error) { if (error.code === 'EEXIST') return { data: null, error: problem('The resource already exists', '409') }; throw error }
        await fs.unlink(temporary)
      }
      temporary = null; await syncPath(parent)
      return { data: { path, id: key, fullPath: `${bucket}/${path}` }, error: null }
    } catch (error) {
      return { data: null, error: problem(error?.insecure ? error.message : 'Could not save the file.') }
    } finally {
      await handle?.close().catch(() => {})
      if (temporary) await fs.unlink(temporary).catch(() => {})
    }
  },
  async download(path) {
    const key = privateFileKey(bucket, path)
    if (!key) return { data: null, error: problem('Invalid file path.', '400') }
    let handle
    try {
      const { path: target } = await locate(key, false, configuredRoot)
      handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW)
      const s = await handle.stat(); checkFile(s)
      if (s.size > PRIVATE_BUCKET_LIMITS[bucket]) throw insecure()
      const bytes = await handle.readFile()
      return { data: new Blob([bytes]), error: null }
    } catch (error) {
      return { data: null, error: problem(error?.code === 'ENOENT' ? 'Object not found' : 'Could not read the file.', error?.code === 'ENOENT' ? '404' : '500') }
    } finally { await handle?.close().catch(() => {}) }
  },
  // Missing files count as removed, like Supabase Storage.
  async remove(paths) {
    const removed = []
    try {
      for (const path of Array.isArray(paths) ? paths : []) {
        // A path this store could never have written has nothing to remove.
        const key = privateFileKey(bucket, path)
        if (!key) continue
        let location
        try { location = await locate(key, false, configuredRoot) } catch (error) { if (error?.code === 'ENOENT') continue; throw error }
        try { checkFile(await fs.lstat(location.path)); await fs.unlink(location.path); await syncPath(location.parent); removed.push({ name: path }) }
        catch (error) { if (error?.code !== 'ENOENT') throw error }
      }
      return { data: removed, error: null }
    } catch { return { data: null, error: problem('Could not remove the file.') } }
  }
})

const unknownBucket = { upload: async () => ({ data: null, error: problem('Storage bucket is not available.', '404') }),
  download: async () => ({ data: null, error: problem('Storage bucket is not available.', '404') }),
  remove: async () => ({ data: null, error: problem('Storage bucket is not available.', '404') }) }
export const vpsStorage = Object.freeze({ from: bucket => Object.hasOwn(PRIVATE_BUCKET_LIMITS, bucket) ? createPrivateBucket(bucket) : unknownBucket })
