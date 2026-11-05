import {versionedPublicImageUrl} from '~/utils/publicImageCache'
export const usePublicImageUrl=()=>{
  const {data:content}=useSiteContent()
  return source=>versionedPublicImageUrl(source,content.value?.settings?.public_image_cache)
}
