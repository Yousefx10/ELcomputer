import { promises as fs, constants } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { isResetImagePath, isResetImageDirectory, resetManifestLimit } from './resetFilePolicy.js'

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
      const item = relative(base, path)
      if (!isResetImagePath(item) && !isResetImageDirectory(item)) continue
      if (entry.isSymbolicLink()) throw new Error('Upload symlinks must be removed before resetting media.')
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && isResetImagePath(item)) {
        const stat = await fs.lstat(path)
        files.push({ path: item, root: base, size: stat.size, modifiedAt: stat.mtimeMs, inode: stat.ino, device: stat.dev })
        if (files.length > resetManifestLimit) throw new Error('Too many files. Reset a smaller scope first.')
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
  if (!Array.isArray(files) || files.length > resetManifestLimit) throw new Error('Invalid reset upload manifest.')
  for (const file of files) {
    if (file.root !== base || typeof file.path !== 'string') throw new Error('The upload directory changed. Cleanup is paused.')
    const path = resolve(base, file.path)
    if (!path.startsWith(`${base}${sep}`) || !isResetImagePath(file.path)) throw new Error('Invalid reset upload path.')
    try {
      if (await fs.realpath(path) !== path) throw new Error('An upload path now contains a symlink.')
      const stat = await fs.lstat(path)
      if (!stat.isFile()) throw new Error('An upload is no longer a regular file.')
      if (stat.size !== file.size || stat.mtimeMs !== file.modifiedAt ||
        (file.inode !== undefined && stat.ino !== file.inode) || (file.device !== undefined && stat.dev !== file.device)) {
        throw new Error('An upload changed during cleanup. Review it before retrying.')
      }
      await fs.unlink(path)
      const directory = await fs.open(resolve(path, '..'), constants.O_RDONLY | constants.O_NOFOLLOW)
      try { await directory.sync() } finally { await directory.close() }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}
