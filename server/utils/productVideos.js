import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { resolve, join } from 'node:path'
import { createError, getHeader, sendStream, setHeader, setResponseStatus } from 'h3'
import { createClient } from '@supabase/supabase-js'
import { getUploadsRootDirectory } from './uploads'
import { probePackingVideo } from './privatePackingVideos'
import { PDP_MAX_VIDEO_BYTES } from './productPresentation'

export const productVideoPattern = /^product_videos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(mp4|webm)$/
const fail = status => { throw createError({ statusCode: status, statusMessage: 'Product video is unavailable.' }) }
const syncDirectory = async path => { const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { await handle.sync() } finally { await handle.close() } }
async function directory(create = false) {
  const root = getUploadsRootDirectory(), target = join(root, 'product_videos')
  if (create) {
    const missing = []; let current = target
    while (true) {
      try { if (await fs.realpath(current) !== current || !(await fs.lstat(current)).isDirectory()) fail(400); break }
      catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(current); const parent = resolve(current, '..'); if (parent === current) fail(400); current = parent }
    }
    for (const path of missing.reverse()) {
      try { await fs.mkdir(path, { mode: 0o750 }); await syncDirectory(resolve(path, '..')) } catch (error) { if (error.code !== 'EEXIST') throw error }
      if (await fs.realpath(path) !== path || !(await fs.lstat(path)).isDirectory()) fail(400)
    }
  }
  if (await fs.realpath(root) !== root || await fs.realpath(target) !== target || !(await fs.lstat(target)).isDirectory()) fail(404)
  return target
}
async function fingerprint(handle) {
  const stat = await handle.stat()
  if (!stat.isFile() || stat.size < 1 || stat.size > PDP_MAX_VIDEO_BYTES) fail(404)
  const hash = createHash('sha256')
  for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) hash.update(chunk)
  return { size: stat.size, sha256: hash.digest('hex') }
}

// The only accepted paths are generated, public product-media names. Private
// packing evidence never passes through this directory or publication lookup.
export async function saveProductVideo(bytes, id, mime) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > PDP_MAX_VIDEO_BYTES) fail(413)
  if (!['video/mp4', 'video/webm'].includes(mime) || !productVideoPattern.test(`product_videos/${id}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`)) fail(415)
  const folder = await directory(true), extension = mime === 'video/mp4' ? 'mp4' : 'webm'
  const key = `${id}.${extension}`, pending = join(folder, `.pending-${randomUUID()}`), final = join(folder, key)
  const hash = createHash('sha256').update(bytes).digest('hex')
  let handle, createdPending = false
  try {
    handle = await fs.open(pending, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o640)
    createdPending = true
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null
    let duration
    try { duration = await probePackingVideo(pending, mime) } catch (error) { fail(error.statusCode === 503 ? 503 : 422) }
    if (duration <= 0 || duration > 600) fail(422)
    try { await fs.link(pending, final); await syncDirectory(folder) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const existing = await fs.open(final, constants.O_RDONLY | constants.O_NOFOLLOW)
      try { const proof = await fingerprint(existing); if (proof.size !== bytes.length || proof.sha256 !== hash) fail(409) } finally { await existing.close() }
    }
    return { storage_key: key, size_bytes: bytes.length, sha256: hash, duration_seconds: duration, mime_type: mime }
  } finally {
    await handle?.close()
    if (createdPending) await fs.unlink(pending).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
}

export function productVideoRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) fail(416)
  let start, end
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix < 1) fail(416); start = Math.max(0, size - suffix); end = size - 1 }
  else { start = Number(match[1]); end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1 }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) fail(416)
  return { start, end, partial: true }
}

export async function serveProductVideo(event, path) {
  const match = productVideoPattern.exec(path)
  if (!match) fail(404)
  const config = useRuntimeConfig(event), url = config.public.supabase?.url || config.public.supabaseUrl, key = config.public.supabase?.key
  if (!url || !key) fail(404)
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: asset, error } = await client.rpc('get_public_product_video', { p_asset_id: match[1] }, { get: true }).abortSignal(AbortSignal.timeout(10000))
  if (error || !asset || asset.storage_key !== path.slice('product_videos/'.length)) fail(404)
  let handle
  try {
    handle = await fs.open(join(await directory(), asset.storage_key), constants.O_RDONLY | constants.O_NOFOLLOW)
    const proof = await fingerprint(handle)
    if (proof.size !== Number(asset.size_bytes) || proof.sha256 !== asset.sha256) fail(404)
    const etag = `"${asset.sha256}"`
    setHeader(event, 'Content-Type', asset.mime_type); setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Cache-Control', 'no-cache'); setHeader(event, 'Accept-Ranges', 'bytes'); setHeader(event, 'ETag', etag)
    if (getHeader(event, 'if-none-match') === etag) { setResponseStatus(event, 304); await handle.close(); return null }
    let range
    try { range = productVideoRange(getHeader(event, 'range'), proof.size) } catch (error) { setHeader(event, 'Content-Range', `bytes */${proof.size}`); throw error }
    setHeader(event, 'Content-Length', String(range.end - range.start + 1))
    if (range.partial) { setResponseStatus(event, 206); setHeader(event, 'Content-Range', `bytes ${range.start}-${range.end}/${proof.size}`) }
    if (event.method === 'HEAD') { await handle.close(); return null }
    const stream = handle.createReadStream({ start: range.start, end: range.end, autoClose: true }); handle = null
    return sendStream(event, stream)
  } catch (error) { await handle?.close(); if (error.statusCode) throw error; fail(404) }
}
