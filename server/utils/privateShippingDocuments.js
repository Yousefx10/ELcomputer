import { constants, promises as fs } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute, resolve, dirname, join } from 'node:path'
import { createError } from 'h3'

export const MAX_SHIPPING_DOCUMENT_BYTES = 5 * 1024 * 1024
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const keyPattern = new RegExp(`^vps-v1/(orders|claims)/${uuid}/${uuid}\\.pdf$`)
export const isVpsShippingDocumentPath = key => typeof key === 'string' && keyPattern.test(key)
const fail = () => { throw createError({ statusCode: 503, statusMessage: 'Private shipping document is unavailable.' }) }
const inside = (a, b) => a === b || a.startsWith(b + '/')
const safe = (s, directory) => {
  if (s.isSymbolicLink() || !(directory ? s.isDirectory() : s.isFile()) || s.mode & 0o077
    || typeof process.getuid === 'function' && s.uid !== process.getuid() || !directory && s.nlink !== 1) fail()
}
const sync = async path => { const h = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { await h.sync() } finally { await h.close() } }
const directory = async path => { if (await fs.realpath(path) !== path) fail();safe(await fs.lstat(path), true) }
export const getShippingDocumentsRoot = async ({ create = false } = {}) => {
  const config = useRuntimeConfig(), configured = config.shippingDocumentsDir
  if (typeof configured !== 'string' || !isAbsolute(configured)) fail()
  const root = resolve(configured), app = resolve(process.cwd()), uploads = resolve(app, config.uploadsDir || 'storage/uploads')
  const publicRoots = [app, uploads, await fs.realpath(uploads).catch(() => uploads)]
  if (root === '/' || publicRoots.some(p => inside(root, p) || inside(p, root))) fail()
  try {
    if (create) {
      let p = root;const missing = []
      for (;;) {
        try { if (await fs.realpath(p) !== p || !(await fs.lstat(p)).isDirectory()) fail();break }
        catch (e) { if (e.code !== 'ENOENT') throw e;missing.push(p);p = dirname(p) }
      }
      for (const p of missing.reverse()) { await fs.mkdir(p, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e });await sync(dirname(p)) }
    }
    await directory(root);return root
  } catch { fail() }
}
const location = async (key, create) => {
  if (typeof key !== 'string' || !keyPattern.test(key)) fail()
  let parent = await getShippingDocumentsRoot({ create })
  for (const part of key.split('/').slice(0, -1)) {
    parent = join(parent, part)
    if (create) { await fs.mkdir(parent, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e });await sync(dirname(parent)) }
    await directory(parent)
  }
  return { path: join(parent, key.split('/').at(-1)), parent }
}
const validate = bytes => { if (!Buffer.isBuffer(bytes) || bytes.length < 5 || bytes.length > MAX_SHIPPING_DOCUMENT_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') fail() }
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export const saveShippingDocument = async (key, bytes) => {
  validate(bytes)
  const { path, parent } = await location(key, true), temporary = join(parent, '.' + randomUUID() + '.pending')
  let file
  try {
    file = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    await file.writeFile(bytes);await file.sync();await file.close();file = null
    // Publish once; a lost metadata acknowledgement reuses the complete file.
    // An expired worker cannot replace a newer worker's accepted evidence.
    let saved = bytes
    try { await fs.link(temporary, path) }
    catch (e) {
      if (e.code !== 'EEXIST') throw e
      const existing = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const stat = await existing.stat();safe(stat, false)
        if (stat.size > MAX_SHIPPING_DOCUMENT_BYTES) fail()
        saved = await existing.readFile();validate(saved)
      } finally { await existing.close() }
    }
    await fs.unlink(temporary);await sync(parent)
    return { path: key, sha256: sha(saved), size_bytes: saved.length }
  } catch { fail() }
  finally { await file?.close();await fs.unlink(temporary).catch(e => { if (e.code !== 'ENOENT') fail() }) }
}
export const readShippingDocument = async evidence => {
  if (!/^[a-f0-9]{64}$/.test(evidence?.sha256 || '') || !Number.isSafeInteger(Number(evidence.size_bytes))) fail()
  let file
  try {
    const { path } = await location(evidence.path, false)
    file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const before = await file.stat();safe(before, false)
    if (before.size > MAX_SHIPPING_DOCUMENT_BYTES || before.size !== Number(evidence.size_bytes)) fail()
    const bytes = await file.readFile(), after = await file.stat();validate(bytes)
    if (before.dev !== after.dev || before.ino !== after.ino || before.mtimeMs !== after.mtimeMs || sha(bytes) !== evidence.sha256) fail()
    return bytes
  } catch { fail() }
  finally { await file?.close() }
}
// Only an already-authorized reset manifest calls this; no directory scanning.
export const removePrivateShippingDocuments = async keys => {
  for (const key of keys) {
    try { const { path, parent } = await location(key, false);safe(await fs.lstat(path), false);await fs.unlink(path);await sync(parent) }
    catch (e) { if (e.code !== 'ENOENT') throw e }
  }
}
