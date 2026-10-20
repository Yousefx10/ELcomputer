import { constants, promises as fs } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { isAbsolute, join, dirname, resolve } from 'node:path'
import { createError, getHeader, setHeader } from 'h3'

export const MAX_PACKING_VIDEO_BYTES = 500 * 1024 * 1024
export const PACKING_VIDEO_EXTENSIONS = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const keyPattern = new RegExp(`^vps-v1/${uuid}/${uuid}/${uuid}/${uuid}\\.(webm|mp4|mov)$`)
export const isVpsPackingVideoPath = path => typeof path === 'string' && keyPattern.test(path)
const fail = (statusCode, statusMessage) => { throw createError({ statusCode, statusMessage }) }
const inside = (path, parent) => path === parent || path.startsWith(parent + '/')
const syncDirectory = async path => {
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try { await handle.sync() } finally { await handle.close() }
}
const privateStat = (stat, directory = false) => {
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile()) || stat.mode & 0o077
    || typeof process.getuid === 'function' && stat.uid !== process.getuid() || !directory && stat.nlink !== 1) {
    fail(503, 'Private packing storage is not safe.')
  }
}
const assertDirectory = async path => {
  if (await fs.realpath(path) !== path) fail(503, 'Private packing storage is not safe.')
  privateStat(await fs.lstat(path), true)
}

export const getPackingVideosRoot = async ({ create = false } = {}) => {
  const config = useRuntimeConfig(), configured = config.packingVideosDir
  if (typeof configured !== 'string' || !configured || !isAbsolute(configured)) fail(503, 'Private packing storage is not configured.')
  const root = resolve(configured), app = resolve(process.cwd())
  const uploads = resolve(app, config.uploadsDir || 'storage/uploads')
  const publicRoots = [app, uploads, await fs.realpath(uploads).catch(() => uploads)]
  if (root === '/' || publicRoots.some(path => inside(root, path) || inside(path, root))) fail(503, 'Private packing storage must be separate from public files.')
  try {
    if (create) {
      // Check every existing ancestor before creating anything through it.
      let current = root
      const pending = []
      while (true) {
        try {
          if (await fs.realpath(current) !== current || !(await fs.lstat(current)).isDirectory()) fail(503, 'Private packing storage is not safe.')
          break
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
          pending.push(current); current = dirname(current)
        }
      }
      for (const path of pending.reverse()) {
        await fs.mkdir(path, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
        await syncDirectory(dirname(path))
      }
    }
    await assertDirectory(root)
  } catch (error) { if (error.statusCode) throw error; fail(503, 'Private packing storage is unavailable.') }
  return root
}

export const assertPackingVideoBinding = (video, session) => {
  if (!video || video.storage_backend !== 'vps' || !isVpsPackingVideoPath(video.storage_path)
    || video.packing_session_id !== session.id || video.order_id !== session.order_id
    || video.work_session_id !== session.work_session_id || video.recorded_by !== session.admin_user_id
    || video.storage_path !== `vps-v1/${video.recorded_by}/${video.order_id}/${video.packing_session_id}/${video.upload_id}.${PACKING_VIDEO_EXTENSIONS[video.mime_type]}`) {
    fail(409, 'A private VPS packing video is required.')
  }
}

const videoLocation = async (path, create = false) => {
  if (!isVpsPackingVideoPath(path)) fail(409, 'A private VPS packing video is required.')
  const root = await getPackingVideosRoot({ create })
  let parent = root
  for (const part of path.split('/').slice(0, -1)) {
    parent = join(parent, part)
    if (create) {
      await fs.mkdir(parent, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
      await syncDirectory(dirname(parent))
    }
    await assertDirectory(parent)
  }
  return { absolute: join(root, path), parent }
}

const fingerprint = async handle => {
  const before = await handle.stat()
  privateStat(before)
  if (before.size < 1 || before.size > MAX_PACKING_VIDEO_BYTES) fail(409, 'The packing video size does not match the recording.')
  const hash = createHash('sha256'), buffer = Buffer.alloc(256 * 1024)
  let position = 0
  while (position < before.size) {
    const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, before.size - position), position)
    if (!bytesRead) fail(409, 'The saved packing video changed.')
    hash.update(buffer.subarray(0, bytesRead)); position += bytesRead
  }
  const after = await handle.stat()
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || after.nlink !== 1) fail(409, 'The saved packing video changed.')
  return { stat: after, sha256: hash.digest('hex') }
}

export const openPackingVideo = async (video, { ready = true } = {}) => {
  let handle
  try {
    const { absolute } = await videoLocation(video.storage_path)
    handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW)
    const result = await fingerprint(handle)
    if (result.stat.size !== Number(video.size_bytes)) fail(409, 'The packing video size does not match the recording.')
    if (ready && (video.status !== 'ready' || !video.validated_at || result.sha256 !== video.sha256)) fail(409, 'The saved packing video changed.')
    return { handle, ...result }
  } catch (error) {
    await handle?.close()
    if (error.statusCode) throw error
    fail(409, 'The saved packing video is unavailable.')
  }
}

// ffprobe only sees a generated local filename. No shell or network protocol.
const runProbe = (path, args, consume, timeoutMs) => new Promise((resolve, reject) => {
  const binary = useRuntimeConfig().packingVideoProbePath || 'ffprobe'
  const child = spawn(binary, ['-v', 'error', '-max_alloc', '67108864', '-protocol_whitelist', 'file',
    '-format_whitelist', 'matroska,webm,mov,mp4,m4a,3gp,3g2,mj2', '-threads', '1', ...args, path], { stdio: ['ignore', 'pipe', 'pipe'] })
  let error, stderr = false
  const timer = setTimeout(() => { error = createError({ statusCode: 422, statusMessage: 'Packing video verification timed out.' }); child.kill('SIGKILL') }, timeoutMs)
  child.stderr.on('data', () => { stderr = true })
  child.stdout.on('data', chunk => {
    try { consume(chunk.toString('utf8')) }
    catch (failure) { error = failure; child.kill('SIGKILL') }
  })
  child.once('error', failure => { error = createError({ statusCode: 503, statusMessage: 'Packing video verification is unavailable.' }); if (failure.code !== 'ENOENT') child.kill('SIGKILL') })
  child.once('close', code => {
    clearTimeout(timer)
    if (error) reject(error)
    else if (code !== 0 || stderr) reject(createError({ statusCode: 422, statusMessage: 'The packing video is invalid or incomplete.' }))
    else resolve()
  })
})

export const probePackingVideo = async (path, mimeType, { timeoutMs = 30000 } = {}) => {
  if (!Object.hasOwn(PACKING_VIDEO_EXTENSIONS, mimeType)) fail(415, 'This video format is not supported.')
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  const prefix = Buffer.alloc(4096)
  try { await handle.read(prefix, 0, prefix.length, 0) } finally { await handle.close() }
  const webm = prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && prefix.includes(Buffer.from('webm'))
  const iso = prefix.toString('ascii', 4, 8) === 'ftyp'
  const quicktime = iso && prefix.toString('ascii', 8, 12) === 'qt  '
  if (mimeType === 'video/webm' ? !webm : !iso || (mimeType === 'video/quicktime') !== quicktime) fail(415, 'The video content does not match its format.')
  let json = ''
  await runProbe(path, ['-show_entries', 'format=format_name:stream=codec_type', '-of', 'json'], chunk => {
    json += chunk
    if (json.length > 65536) fail(422, 'The packing video is invalid or incomplete.')
  }, timeoutMs)
  let metadata
  try { metadata = JSON.parse(json) } catch { fail(422, 'The packing video is invalid or incomplete.') }
  const formats = String(metadata.format?.format_name || '').split(',')
  if (!formats.includes(mimeType === 'video/webm' ? 'webm' : 'mov')) fail(415, 'The video content does not match its format.')
  if (!metadata.streams?.some(stream => stream.codec_type === 'video')) fail(415, 'The recording must contain video.')
  // Decode video frames: an audio track or container header is not evidence.
  // Frame timestamps also work for MediaRecorder WebM without a duration header.
  let pending = '', first = Infinity, end = -Infinity, packets = 0
  const packet = line => {
    if (!line.trim()) return
    const [pts, ...durations] = line.trim().split(',').map(Number)
    const duration = Math.max(0, ...durations.filter(Number.isFinite))
    if (Number.isFinite(pts)) { first = Math.min(first, pts); end = Math.max(end, pts + duration); packets++ }
    if (packets > 3000000) fail(422, 'The packing video is invalid or incomplete.')
  }
  await runProbe(path, ['-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time,pkt_duration_time,duration_time:frame_side_data=', '-of', 'csv=p=0'], chunk => {
    pending += chunk
    const lines = pending.split('\n'); pending = lines.pop()
    if (pending.length > 1024) fail(422, 'The packing video is invalid or incomplete.')
    for (const line of lines) packet(line)
  }, timeoutMs)
  if (pending) packet(pending)
  const duration = end - first
  if (!packets || !Number.isFinite(duration) || duration <= 0 || duration > 86400) fail(422, 'The packing video is invalid or incomplete.')
  return Math.round(duration * 1000) / 1000
}

export const assertPackingVideoDuration = (video, duration) => {
  const expected = (new Date(video.recording_ended_at) - new Date(video.recording_started_at)) / 1000
  if (!Number.isFinite(expected) || Math.abs(duration - expected) > Math.max(3, duration * 0.05)) fail(422, 'The video duration does not match the recording.')
}

export const persistPackingVideo = async (event, video) => {
  const mime = String(getHeader(event, 'content-type') || '').split(';')[0].trim().toLowerCase()
  if (mime !== video.mime_type || getHeader(event, 'content-encoding') && getHeader(event, 'content-encoding') !== 'identity') fail(415, 'The video content does not match its format.')
  const expected = Number(video.size_bytes), length = getHeader(event, 'content-length')
  if (!Number.isSafeInteger(expected) || expected < 1 || expected > MAX_PACKING_VIDEO_BYTES) fail(413, 'The packing video must be under 500 MB.')
  if (length && Number(length) > MAX_PACKING_VIDEO_BYTES) fail(413, 'The packing video must be under 500 MB.')
  if (length && Number(length) !== expected) fail(409, 'The packing video size does not match the recording.')
  let location
  try { location = await videoLocation(video.storage_path, true) }
  catch (error) { if (error.statusCode) throw error; fail(503, 'Private packing storage is unavailable.') }
  const { absolute, parent } = location
  const staging = join(parent, '.' + randomUUID() + '.pending')
  let handle, bytes = 0, published = false
  const req = event.node.req
  const timeout = () => req.destroy(createError({ statusCode: 408, statusMessage: 'Packing video upload timed out.' }))
  const absoluteTimer = setTimeout(timeout, 15 * 60 * 1000)
  let idleTimer = setTimeout(timeout, 60000)
  try {
    handle = await fs.open(staging, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length
      if (bytes > expected || bytes > MAX_PACKING_VIDEO_BYTES) fail(413, 'The packing video exceeds its declared size.')
      clearTimeout(idleTimer); idleTimer = setTimeout(timeout, 60000)
      await handle.writeFile(chunk)
    }
    clearTimeout(absoluteTimer); clearTimeout(idleTimer)
    if (bytes !== expected || !req.complete) fail(409, 'The packing video upload is incomplete.')
    await handle.sync(); await handle.close(); handle = null
    const duration = await probePackingVideo(staging, video.mime_type)
    assertPackingVideoDuration(video, duration)
    // Validate and fingerprint before publishing complete bytes atomically.
    const reader = await fs.open(staging, constants.O_RDONLY | constants.O_NOFOLLOW)
    let evidence
    try { evidence = await fingerprint(reader) } finally { await reader.close() }
    try { await fs.link(staging, absolute); published = true }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const existing = await openPackingVideo(video, { ready: false })
      try { if (existing.sha256 !== evidence.sha256) fail(409, 'The saved packing video changed.') }
      finally { await existing.handle.close() }
    }
    await fs.unlink(staging); await syncDirectory(parent)
    return { sha256: evidence.sha256, duration, published }
  } catch (error) {
    if (!req.complete && !req.destroyed) {
      setHeader(event, 'Connection', 'close')
      event.node.res.once('finish', () => req.destroy())
    }
    if (error.statusCode) throw error
    fail(503, 'Could not save the private packing video. Retry the same recording.')
  } finally {
    clearTimeout(absoluteTimer); clearTimeout(idleTimer)
    await handle?.close()
    await fs.unlink(staging).catch(error => { if (error.code !== 'ENOENT') fail(503, 'Could not clean the incomplete packing upload.') })
  }
}

// Only reset manifests may remove saved files. Missing files make retry safe.
export const removePrivatePackingVideos = async paths => {
  for (const path of paths) {
    try {
      const { absolute, parent } = await videoLocation(path)
      const stat = await fs.lstat(absolute)
      privateStat(stat)
      await fs.unlink(absolute); await syncDirectory(parent)
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}
