import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { createReadStream } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { createError } from 'h3'
import { hasAdminPermission } from '~/utils/adminPermissions'

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif'
])

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif'
}

const EXTENSION_CONTENT_TYPE_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
}

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
  site_logo: {
    label: 'Site Logo',
    directory: 'settings/site-logo',
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

const sanitizeRelativePath = (value = '') => {
  const normalizedPath = String(value || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/')

  if (!normalizedPath || normalizedPath.includes('..')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid upload path.'
    })
  }

  return normalizedPath
}

const getRandomSuffix = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const bytes = randomBytes(4)

  return Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join('')
}

const buildUploadFilename = ({ filename = '', mimeType = '' } = {}) => {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String(now.getFullYear())
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const originalExtension = extname(String(filename || '')).toLowerCase()
  const mimeExtension = MIME_EXTENSION_MAP[mimeType] || ''
  const fileExtension = mimeExtension || originalExtension || '.jpg'

  return `${day}${month}${year}-${hours}${minutes}${seconds}-${getRandomSuffix()}${fileExtension}`
}

const getSectionDefinitionFromRelativePath = (relativePath = '') => {
  const normalizedPath = sanitizeRelativePath(relativePath)

  return Object.values(UPLOAD_SECTION_DEFINITIONS).find((definition) => {
    return normalizedPath === definition.directory || normalizedPath.startsWith(`${definition.directory}/`)
  }) || {
    label: 'Uploads',
    directory: normalizedPath.split('/')[0] || 'uploads',
    permissions: []
  }
}

export const getUploadsRootDirectory = () => {
  const config = useRuntimeConfig()
  return resolve(process.cwd(), config.uploadsDir || 'storage/uploads')
}

export const getUploadSectionDefinition = (sectionKey = '') => {
  const matchedDefinition = UPLOAD_SECTION_DEFINITIONS[String(sectionKey || '').trim()]

  if (!matchedDefinition) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported upload section.'
    })
  }

  return matchedDefinition
}

export const ensureAdminUploadPermission = (adminUser, sectionKey = '') => {
  const sectionDefinition = getUploadSectionDefinition(sectionKey)
  const hasRequiredPermission = sectionDefinition.permissions.some((permissionKey) => {
    return hasAdminPermission(adminUser, permissionKey)
  })

  if (!hasRequiredPermission) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to upload images here.'
    })
  }

  return sectionDefinition
}

export const getPublicUploadPath = (relativePath = '') => {
  return `/uploads/${sanitizeRelativePath(relativePath)}`
}

export const getRelativeUploadPathFromPublicPath = (publicPath = '') => {
  const normalizedPath = String(publicPath || '').trim()

  if (!normalizedPath.startsWith('/uploads/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only host-uploaded images can be managed from the gallery.'
    })
  }

  return sanitizeRelativePath(normalizedPath.slice('/uploads/'.length))
}

export const getAbsoluteUploadPathFromRelativePath = (relativePath = '') => {
  const uploadsRootDirectory = getUploadsRootDirectory()
  const sanitizedRelativePath = sanitizeRelativePath(relativePath)
  const absolutePath = resolve(uploadsRootDirectory, sanitizedRelativePath)
  const relativeToRoot = relative(uploadsRootDirectory, absolutePath)

  if (!relativeToRoot || relativeToRoot.startsWith('..') || relativeToRoot.includes(`..${sep}`)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid upload path.'
    })
  }

  return absolutePath
}

export const saveUploadedImageFile = async (file, sectionKey = '') => {
  if (!file?.data?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose an image file first.'
    })
  }

  if (!IMAGE_MIME_TYPES.has(file.type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only image uploads are allowed.'
    })
  }

  const maxFileSizeInBytes = 8 * 1024 * 1024

  if (file.data.length > maxFileSizeInBytes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image size must be 8 MB or smaller.'
    })
  }

  const sectionDefinition = getUploadSectionDefinition(sectionKey)
  const uploadsRootDirectory = getUploadsRootDirectory()
  const targetDirectory = resolve(uploadsRootDirectory, sectionDefinition.directory)
  const filename = buildUploadFilename({
    filename: file.filename,
    mimeType: file.type
  })
  const absoluteFilePath = resolve(targetDirectory, filename)
  const relativeFilePath = sanitizeRelativePath(`${sectionDefinition.directory}/${filename}`)

  await fs.mkdir(targetDirectory, { recursive: true })
  await fs.writeFile(absoluteFilePath, file.data)

  return {
    filename,
    section: sectionDefinition.label,
    relativePath: relativeFilePath,
    publicPath: getPublicUploadPath(relativeFilePath)
  }
}

const walkUploadDirectory = async (directoryPath, rootDirectory) => {
  let entries = []

  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return []
    }

    throw error
  }

  const nestedEntries = await Promise.all(entries.map(async (entry) => {
    const absoluteEntryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      return await walkUploadDirectory(absoluteEntryPath, rootDirectory)
    }

    const extension = extname(entry.name).toLowerCase()

    if (!Object.hasOwn(EXTENSION_CONTENT_TYPE_MAP, extension)) {
      return []
    }

    const stats = await fs.stat(absoluteEntryPath)
    const relativeEntryPath = sanitizeRelativePath(relative(rootDirectory, absoluteEntryPath))
    const sectionDefinition = getSectionDefinitionFromRelativePath(relativeEntryPath)

    return [{
      name: basename(entry.name),
      relativePath: relativeEntryPath,
      publicPath: getPublicUploadPath(relativeEntryPath),
      section: sectionDefinition.label,
      directory: sectionDefinition.directory,
      size: stats.size,
      updated_at: stats.mtime.toISOString()
    }]
  }))

  return nestedEntries.flat()
}

const normalizePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number.parseInt(String(value ?? ''), 10)

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue
  }

  return parsedValue
}

export const listUploadedImages = async (searchTerm = '', options = {}) => {
  const uploadsRootDirectory = getUploadsRootDirectory()
  const normalizedSearchTerm = String(searchTerm || '').trim().toLowerCase()
  const requestedPage = normalizePositiveInteger(options.page, 1)
  const pageSize = Math.min(60, normalizePositiveInteger(options.limit, 24))
  const files = await walkUploadDirectory(uploadsRootDirectory, uploadsRootDirectory)

  const filteredFiles = files
    .filter((file) => {
      if (!normalizedSearchTerm) {
        return true
      }

      return file.name.toLowerCase().includes(normalizedSearchTerm)
    })
    .sort((firstFile, secondFile) => {
      return new Date(secondFile.updated_at).getTime() - new Date(firstFile.updated_at).getTime()
    })

  const totalItems = filteredFiles.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(requestedPage, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    items: filteredFiles.slice(startIndex, endIndex),
    pagination: {
      page: currentPage,
      pageSize,
      totalItems,
      totalPages
    },
    totalSections: new Set(filteredFiles.map((file) => file.section)).size
  }
}

export const deleteUploadedImageByPublicPath = async (publicPath = '') => {
  const relativePath = getRelativeUploadPathFromPublicPath(publicPath)
  const absolutePath = getAbsoluteUploadPathFromRelativePath(relativePath)

  try {
    await fs.unlink(absolutePath)
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }

  return {
    relativePath,
    publicPath: getPublicUploadPath(relativePath)
  }
}

export const getUploadContentType = (filePath = '') => {
  const extension = extname(String(filePath || '')).toLowerCase()
  return EXTENSION_CONTENT_TYPE_MAP[extension] || 'application/octet-stream'
}

export const createUploadReadStream = (relativePath = '') => {
  const absolutePath = getAbsoluteUploadPathFromRelativePath(relativePath)
  return createReadStream(absolutePath)
}

export const getBlankImageSvg = () => {
  return BLANK_IMAGE_SVG
}
