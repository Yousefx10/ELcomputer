// Only the public image library belongs to Media/Full reset. Other local files
// and private Storage belong to their separate, explicitly reviewed policies.
export const resetImageDirectories = [
  'products', 'products/gallery', 'categories', 'brands', 'pages',
  'settings/site-logo', 'settings/auth-page', 'settings/hero-banners',
  'settings/banner-ads', 'settings/footer', 'settings/offer-cards'
]
export const resetManifestLimit = 10000
export const isResetImagePath = (path) => {
  if (typeof path !== 'string' || path.length > 500 || !/^[A-Za-z0-9_./-]+\.(jpe?g|png|webp|gif|svg|avif)$/i.test(path)) return false
  const parts = path.split('/')
  if (parts.some(part => !part || part.startsWith('.'))) return false
  return parts.length === 1 || resetImageDirectories.includes(parts.slice(0, -1).join('/'))
}
export const isResetImageDirectory = (path) => resetImageDirectories.some(directory =>
  directory === path || directory.startsWith(path + '/'))
