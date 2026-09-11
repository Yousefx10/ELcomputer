import { promises as fs } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const imageExtension = /\.(jpe?g|png|webp|gif|svg|avif)$/i

export const assertResetUploadRoot = (root, appRoot = process.cwd()) => {
  const resolved = resolve(root)
  const app = resolve(appRoot)
  if (resolved === app || app.startsWith(`${resolved}${sep}`) || resolved === sep) {
    throw new Error('The upload directory is not safe to reset.')
  }
  return resolved
}

// Snapshot individual uploads. Never recursively remove a configured directory.
export const listResetMediaFiles = async (root) => {
  const base = assertResetUploadRoot(root)
  const files = []
  const visit = async (directory) => {
    let entries
    try { entries = await fs.readdir(directory, { withFileTypes: true }) } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const path = resolve(directory, entry.name)
      if (entry.isSymbolicLink()) throw new Error('Upload symlinks must be removed before resetting media.')
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && imageExtension.test(entry.name)) {
        const stat = await fs.stat(path)
        files.push({ path: relative(base, path), root: base, size: stat.size, modifiedAt: stat.mtimeMs })
      }
    }
  }
  try {
    const stat = await fs.lstat(base)
    if (stat.isSymbolicLink()) throw new Error('The upload directory cannot be a symlink.')
    if (await fs.realpath(base) !== base) throw new Error('The upload path must not contain symlinks.')
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  await visit(base)
  return files
}

export const removeResetMediaFiles = async (root, files) => {
  const base = assertResetUploadRoot(root)
  for (const file of files) {
    if (file.root !== base || typeof file.path !== 'string') throw new Error('The upload directory changed. Cleanup is paused.')
    const path = resolve(base, file.path)
    if (!path.startsWith(`${base}${sep}`) || !imageExtension.test(path)) throw new Error('Invalid reset upload path.')
    try {
      if (await fs.realpath(path) !== path) throw new Error('An upload path now contains a symlink.')
      const stat = await fs.lstat(path)
      if (!stat.isFile()) throw new Error('An upload is no longer a regular file.')
      if (stat.size !== file.size || stat.mtimeMs !== file.modifiedAt) {
        throw new Error('An upload changed during cleanup. Review it before retrying.')
      }
      await fs.unlink(path)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}
