export const useMediaErrors = () => {
  const { t } = useI18n()
  const keys = { MEDIA_REFERENCED:'inUse', MEDIA_UNAVAILABLE:'unavailable', MEDIA_INVALID_IMAGE:'invalid', MEDIA_SVG_UNSUPPORTED:'svg', MEDIA_TOO_LARGE:'size', MEDIA_PATH_INVALID:'path', MEDIA_SECTION_INVALID:'path', MEDIA_FORM_INVALID:'invalid', MEDIA_DELETE_PENDING:'pending', MEDIA_CHANGED:'changed', MEDIA_FORBIDDEN:'permission' }
  const mediaErrorMessage = (error, fallback='upload') => {
    const code=error?.data?.data?.code || error?.data?.code
    const status=error?.statusCode || error?.status || error?.response?.status
    const key=keys[code] || (status===401?'session':status===403?'permission':fallback)
    // Existing media components translate API messages at their UI boundary.
    return t('mediaSafety.'+key, {}, { locale: 'en' })
  }
  return { mediaErrorMessage }
}
