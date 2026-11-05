export const normalizePublicImageCache = value => {
  const row=value&&typeof value==='object'&&!Array.isArray(value)?value:{}
  return {enabled:row.enabled===true,maxAge:[0,3600,86400,604800].includes(row.maxAge)?row.maxAge:86400,
    version:/^[a-zA-Z0-9-]{1,40}$/.test(row.version||'')?row.version:'1'}
}
// Stored media references remain unchanged. Only public-image delivery URLs vary.
export function versionedPublicImageUrl(source,settings){
  if(typeof source!=='string'||!/^\/uploads\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?[^#]*)?$/i.test(source))return source
  const config=normalizePublicImageCache(settings),url=new URL(source,'https://images.invalid')
  url.searchParams.set('v',config.version);return url.pathname+url.search
}
