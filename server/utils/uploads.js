import { randomBytes } from 'node:crypto'
import { promises as fs, constants } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { createError } from 'h3'
import { hasAdminPermission } from '~/utils/adminPermissions'
import { validateImageContent, MAX_IMAGE_BYTES } from './imageContent'

const EXTENSION_CONTENT_TYPE_MAP = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.avif':'image/avif', '.svg':'image/svg+xml' }
const UPLOAD_SECTION_DEFINITIONS = {
  products: {
    label: 'Products',
    directory: 'products',
    permissions: ['products.add', 'products.edit']
  },
  product_gallery: {
    label: 'Product Gallery',
    directory: 'products/gallery',
    permissions: ['products.add', 'products.edit']
  },
  categories: {
    label: 'Categories',
    directory: 'categories',
    permissions: ['categories.add', 'categories.edit']
  },
  brands: {
    label: 'Brands',
    directory: 'brands',
    permissions: ['brands.add', 'brands.edit']
  },
  site_pages: {
    label: 'Pages', directory: 'pages', permissions: ['pages.edit']
  },
  site_logo: {
    label: 'Site Logo',
    directory: 'settings/site-logo',
    permissions: ['settings.edit']
  },
  auth_page: {
    label: 'Authentication Page',
    directory: 'settings/auth-page',
    permissions: ['settings.edit']
  },
  hero_banners: {
    label: 'Hero Banners',
    directory: 'settings/hero-banners',
    permissions: ['settings.edit']
  },
  banner_ads: {
    label: 'Banner Ads',
    directory: 'settings/banner-ads',
    permissions: ['settings.edit']
  },
  footer: {
    label: 'Footer',
    directory: 'settings/footer',
    permissions: ['settings.edit']
  },
  offer_cards: {
    label: 'Offer Cards',
    directory: 'settings/offer-cards',
    permissions: ['settings.edit']
  }
}

const BLANK_IMAGE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" fill="none">
  <rect width="1200" height="1200" fill="white"/>
</svg>`

const fail = (statusCode, statusMessage, code) => { throw createError({ statusCode, statusMessage, data: { code } }) }
const sanitizeRelativePath = value => {
  if (typeof value !== 'string' || !value || value.length > 500 || !/^[A-Za-z0-9_./-]+$/.test(value)
      || value.startsWith('/') || value.includes('//') || value.split('/').some(x => x === '.' || x === '..' || !x)) {
    fail(400, 'Invalid image path.', 'MEDIA_PATH_INVALID')
  }
  return value
}
export const getUploadsRootDirectory = () => {
  const app=process.cwd(), root=resolve(app,useRuntimeConfig().uploadsDir||'storage/uploads')
  if(root==='/' || root===app || app.startsWith(root+'/')) fail(400,'The upload directory is not safe.','MEDIA_PATH_INVALID')
  return root
}
export const getUploadSectionDefinition = key => {
  const definition = Object.hasOwn(UPLOAD_SECTION_DEFINITIONS,key) ? UPLOAD_SECTION_DEFINITIONS[key] : null
  if (!definition) fail(400, 'Unsupported upload section.', 'MEDIA_SECTION_INVALID')
  return definition
}
const sectionForPath = path => Object.entries(UPLOAD_SECTION_DEFINITIONS)
  .sort((a,b) => b[1].directory.length-a[1].directory.length)
  .find(([,d]) => path.startsWith(d.directory + '/') && !path.slice(d.directory.length + 1).includes('/'))
const isImagePath = path => Object.hasOwn(EXTENSION_CONTENT_TYPE_MAP, extname(path).toLowerCase())
const isPublicImagePath = path => isImagePath(path) && (sectionForPath(path) || !path.includes('/'))
export const ensureAdminUploadPermission = (adminUser, section) => {
  const definition = getUploadSectionDefinition(section)
  if (!definition.permissions.some(p => hasAdminPermission(adminUser,p))) fail(403, 'You do not have permission to manage these images.', 'MEDIA_FORBIDDEN')
  return definition
}
export const getAllowedMediaSections = (adminUser, requestedSection) => {
  if (requestedSection) ensureAdminUploadPermission(adminUser, requestedSection)
  // Settings viewers retain the existing public image library, never other files.
  const settings = hasAdminPermission(adminUser,'settings.view')
  const keys = Object.keys(UPLOAD_SECTION_DEFINITIONS).filter(key => settings || UPLOAD_SECTION_DEFINITIONS[key].permissions.some(p => hasAdminPermission(adminUser,p)))
  if (!keys.length) fail(403, 'You do not have permission to browse images.', 'MEDIA_FORBIDDEN')
  return { keys, legacy: settings }
}
export const getPublicUploadPath = path => '/uploads/' + sanitizeRelativePath(path)
export const getRelativeUploadPathFromPublicPath = path => {
  if (typeof path !== 'string' || !path.startsWith('/uploads/')) fail(400, 'Invalid image path.', 'MEDIA_PATH_INVALID')
  return sanitizeRelativePath(path.slice(9))
}
export const getAbsoluteUploadPathFromRelativePath = path => resolve(getUploadsRootDirectory(),sanitizeRelativePath(path))

// Do not follow links in the root, any ancestor, directories or individual files.
export const assertSafeUploadPath = async (path, { directory = false, missing = false } = {}) => {
  const root=getUploadsRootDirectory(), absolute=getAbsoluteUploadPathFromRelativePath(path)
  if (!isPublicImagePath(path) && !directory) fail(404,'Image not found.','MEDIA_NOT_FOUND')
  try {
    if (await fs.realpath(root) !== root) fail(400,'The image path is not safe.','MEDIA_PATH_INVALID')
    const parent=directory ? absolute : resolve(absolute,'..')
    if (await fs.realpath(parent) !== parent) fail(400,'The image path is not safe.','MEDIA_PATH_INVALID')
    const stat=await fs.lstat(absolute)
    if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) fail(400,'The image path is not safe.','MEDIA_PATH_INVALID')
    return { absolute, stat }
  } catch(error) { if (missing && error.code==='ENOENT') return {absolute,stat:null}; throw error }
}
const ensureDirectory = async directory => {
  const root=getUploadsRootDirectory()
  // Check each existing ancestor before mkdir; never create through a symlink.
  let current=root
  const pending=[]
  while (true) {
    try { if (await fs.realpath(current)!==current) fail(400,'The image path is not safe.','MEDIA_PATH_INVALID'); break }
    catch(error) { if(error.code!=='ENOENT') throw error; pending.push(current); const parent=resolve(current,'..'); if(parent===current) throw error; current=parent }
  }
  for(const path of pending.reverse()) {
    await fs.mkdir(path,{mode:0o750})
    await syncDirectory(resolve(path,'..'))
  }
  current=root
  for(const part of directory.split('/')) {
    current=join(current,part)
    try { await fs.mkdir(current,{mode:0o750}); await syncDirectory(resolve(current,'..')) } catch(error) { if(error.code!=='EEXIST') throw error }
    if(await fs.realpath(current)!==current || !(await fs.lstat(current)).isDirectory()) fail(400,'The image path is not safe.','MEDIA_PATH_INVALID')
  }
  return current
}
const syncDirectory = async path => {
  const handle=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try { await handle.sync() } finally { await handle.close() }
}
export const saveUploadedImageFile = async (file, section) => {
  const {extension}=validateImageContent(file?.data,file?.type)
  const definition=getUploadSectionDefinition(section), target=await ensureDirectory(definition.directory)
  const filename=Date.now()+'-'+randomBytes(16).toString('hex')+extension
  const absolute=join(target,filename), relativePath=definition.directory+'/'+filename
  const staging=join(target,'.'+filename+'.pending')
  let handle, published=false
  try {
    handle=await fs.open(staging,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o640)
    await handle.writeFile(file.data); await handle.sync()
    // Publish complete bytes atomically without overwriting another file.
    // After publication, preserve the valid file even if acknowledgement fails.
    await fs.link(staging,absolute); published=true
    await fs.unlink(staging); await syncDirectory(target)
  } catch(error) { if(handle && !published) await fs.unlink(staging).catch(()=>{}); throw error }
  finally { await handle?.close() }
  return { filename,section:definition.label,relativePath,publicPath:getPublicUploadPath(relativePath) }
}
const walk = async (directory, root, allowed) => {
  let entries
  try { if(await fs.realpath(directory)!==directory) return []; entries=await fs.readdir(directory,{withFileTypes:true}) }
  catch(error) { if(error.code==='ENOENT') return []; throw error }
  const files=[]
  for(const entry of entries) {
    if(entry.isSymbolicLink()) continue
    const absolute=join(directory,entry.name), path=relative(root,absolute)
    if(entry.isDirectory()) {
      if(allowed.keys.some(key => {const d=UPLOAD_SECTION_DEFINITIONS[key].directory;return d===path||d.startsWith(path+'/')||path.startsWith(d+'/')})) files.push(...await walk(absolute,root,allowed))
      continue
    }
    if(!entry.isFile() || !isImagePath(path)) continue
    try { sanitizeRelativePath(path) } catch { continue }
    const match=sectionForPath(path)
    if(match ? !allowed.keys.includes(match[0]) : !(allowed.legacy&&!path.includes('/'))) continue
    const {stat}=await assertSafeUploadPath(path)
    files.push({ name:basename(path),relativePath:path,publicPath:getPublicUploadPath(path),section:match?.[1].label||'Images',directory:match?.[1].directory||'',size:stat.size,updated_at:stat.mtime.toISOString() })
  }
  return files
}
export const listUploadedImages = async (search='',options={}) => {
  const allowed=getAllowedMediaSections(options.adminUser,options.section)
  const files=(await walk(getUploadsRootDirectory(),getUploadsRootDirectory(),allowed)).filter(f=>f.name.toLowerCase().includes(String(search).trim().toLowerCase())).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))
  const limit=Math.min(60,Math.max(1,Number.isSafeInteger(options.limit)?options.limit:24)), totalItems=files.length,totalPages=Math.max(1,Math.ceil(totalItems/limit)),page=Math.min(totalPages,Math.max(1,Number.isSafeInteger(options.page)?options.page:1))
  return {items:files.slice((page-1)*limit,page*limit),pagination:{page,pageSize:limit,totalItems,totalPages},totalSections:new Set(files.map(f=>f.section)).size}
}
const deleteCommand = async (client,adminUser,path,finish=false) => {
  const {data,error}=await client.rpc('catalog_media_delete',{p_admin_id:adminUser.id,p_path:path,p_finish:finish})
  if(error) {
    const reason=error.message||''
    if(reason.includes('MEDIA_REFERENCED')) fail(409,'This image is in use. Remove its references first.','MEDIA_REFERENCED')
    if(reason.includes('MEDIA_FORBIDDEN')) fail(403,'You do not have permission to delete images.','MEDIA_FORBIDDEN')
    if(reason.includes('MEDIA_PATH_INVALID')) fail(400,'Invalid image path.','MEDIA_PATH_INVALID')
    fail(503,'Deletion was not confirmed. Refresh and retry.','MEDIA_DELETE_PENDING')
  }
  if(!data?.state) fail(503,'Deletion was not confirmed. Refresh and retry.','MEDIA_DELETE_PENDING')
  return data
}
export const deleteUploadedImageByPublicPath = async (path,{supabaseAdmin,adminUser}) => {
  const relativePath=getRelativeUploadPathFromPublicPath(path)
  if(!isPublicImagePath(relativePath)) fail(400,'Invalid image path.','MEDIA_PATH_INVALID')
  const {absolute,stat}=await assertSafeUploadPath(relativePath,{missing:true})
  // Persist the reservation before filesystem changes. Never cancel after uncertainty.
  const result=await deleteCommand(supabaseAdmin,adminUser,path)
  if(result.state!=='deleted') {
    try {
      if(stat) {
        const fresh=await assertSafeUploadPath(relativePath,{missing:true})
        if(fresh.stat && (fresh.stat.ino!==stat.ino||fresh.stat.size!==stat.size||fresh.stat.mtimeMs!==stat.mtimeMs)) fail(409,'The image changed. Refresh and retry.','MEDIA_CHANGED')
        await fs.unlink(absolute).catch(error=>{if(error.code!=='ENOENT')throw error})
        await syncDirectory(resolve(absolute,'..'))
      }
    } catch(error) { if(error.statusCode) throw error; fail(503,'Could not delete the image. Refresh and retry.','MEDIA_DELETE_PENDING') }
    await deleteCommand(supabaseAdmin,adminUser,path,true)
  }
  return {relativePath,publicPath:path}
}
export const openUploadImage = async path => {
  await assertSafeUploadPath(path)
  const handle=await fs.open(getAbsoluteUploadPathFromRelativePath(path),constants.O_RDONLY|constants.O_NOFOLLOW)
  try {
    const stat=await handle.stat()
    if(!stat.isFile()||stat.size>MAX_IMAGE_BYTES) fail(404,'Image not found.','MEDIA_NOT_FOUND')
    return {handle,stat}
  } catch(error) { await handle.close(); throw error }
}
export const getUploadContentType = path => EXTENSION_CONTENT_TYPE_MAP[extname(path).toLowerCase()]||'application/octet-stream'
export const getBlankImageSvg = () => BLANK_IMAGE_SVG
