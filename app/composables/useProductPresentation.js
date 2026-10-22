export const useProductPresentation = productId => {
  const client = useSupabaseClient(), { adminUser } = useAdminAccess()
  const content = ref({ videos: [], related: [], compatible: [] }), assets = ref([]), revision = ref(0)
  const baseline = ref(JSON.stringify(content.value)), status = ref('loading'), error = ref(''), saving = ref(false)
  const command = shallowRef(null), upload = shallowRef(null), uploading = ref(false), uploadError = ref(false)
  const dirty = computed(() => JSON.stringify(content.value) !== baseline.value)
  const busy = computed(() => saving.value || uploading.value || status.value === 'unknown')
  const { t } = useI18n()
  const actor = () => adminUser.value?.id || ''
  const storageKey = () => `product-presentation-command:${actor()}:${productId}`
  const stored = value => {
    if (!import.meta.client) return ''
    try { if (value === null) sessionStorage.removeItem(storageKey()); else if (value) sessionStorage.setItem(storageKey(), value); return sessionStorage.getItem(storageKey()) || '' } catch { return '' }
  }
  const headers = async () => {
    const { data } = await client.auth.getSession()
    if (!data.session?.access_token) throw new Error('session')
    return { Authorization: `Bearer ${data.session.access_token}` }
  }
  const request = async (suffix = '', options = {}) => {
    const expectedActor = actor(), authorization = await headers()
    if (expectedActor !== actor()) throw Object.assign(new Error('session changed'), { statusCode: 403 })
    const result = await $fetch(`/api/admin-products/${productId}/presentation${suffix}`, { headers: authorization, retry: 0, timeout: 20000, ...options })
    if (expectedActor !== actor()) throw Object.assign(new Error('session changed'), { statusCode: 403 })
    return result
  }
  const read = async ({ discard = false } = {}) => {
    if (status.value === 'unknown' || saving.value || uploading.value) return
    if (discard && dirty.value && !window.confirm(t('productEditor.discardSections'))) return
    status.value = 'loading'; error.value = ''
    try {
      const result = await request()
      content.value = result.content; assets.value = result.assets || []; revision.value = result.revision
      baseline.value = JSON.stringify(content.value); status.value = 'ready'; return true
    } catch { status.value = 'failed'; error.value = t('productPage.presentationUnavailable'); return false }
  }
  const resolveSaved = result => {
    revision.value = result.revision
    if (command.value) baseline.value = JSON.stringify(command.value.content)
    stored(null); command.value = null; status.value = 'saved'; error.value = ''
  }
  const check = async () => {
    const id = command.value?.request_id || stored()
    if (!id) return
    saving.value = true; error.value = ''
    try {
      const result = await request(`?request_id=${encodeURIComponent(id)}`)
      if (result.committed) {
        const hadBody = !!command.value
        resolveSaved(result)
        if (!hadBody) { saving.value = false; if (await read()) status.value = 'saved' }
      } else if (command.value) { status.value = 'unknown'; error.value = t('productPage.presentationUnknown') }
      else { stored(null); status.value = 'ready'; saving.value = false; await read() }
    } catch { status.value = 'unknown'; error.value = t('productPage.presentationUnknown') }
    finally { saving.value = false }
  }
  const save = async () => {
    if (saving.value || uploading.value || status.value === 'conflict' || (!dirty.value && !command.value)) return
    if (!command.value && content.value.videos.some(video => !Number.isInteger(video.sort_order) || video.sort_order < 0 || video.sort_order > 9999)) { error.value = t('productPage.invalidOrder'); return }
    if (!command.value) {
      command.value = { request_id: crypto.randomUUID(), expected_revision: revision.value, content: JSON.parse(JSON.stringify(content.value)) }
      stored(command.value.request_id)
    }
    saving.value = true; error.value = ''
    try { resolveSaved(await request('', { method: 'PUT', body: command.value })) }
    catch (failure) {
      const code = Number(failure.statusCode || failure.status || 0)
      if ([400, 401, 403, 404, 409, 413].includes(code)) {
        status.value = code === 409 ? 'conflict' : 'failed'
        error.value = t(code === 409 ? 'productPage.presentationConflict' : 'productPage.presentationUnavailable')
        stored(null); command.value = null
      } else { status.value = 'unknown'; error.value = t('productPage.presentationUnknown') }
    } finally { saving.value = false }
  }
  const uploadVideo = async file => {
    if (uploading.value || saving.value || status.value === 'unknown' || content.value.videos.length >= 6) return
    if (file) {
      if (!['video/mp4', 'video/webm'].includes(file.type) || file.size < 1 || file.size > 64 * 1024 * 1024) { error.value = t('productPage.fileLimit'); return }
      upload.value = { id: crypto.randomUUID(), file }
    }
    if (!upload.value) return
    uploading.value = true; uploadError.value = false; error.value = ''
    try {
      const job = upload.value, expectedActor = actor(), authorization = await headers()
      if (expectedActor !== actor()) throw Object.assign(new Error('session changed'), { statusCode: 403 })
      const result = await $fetch(`/api/admin-products/${productId}/videos/${job.id}`, { method: 'PUT', body: job.file, headers: { ...authorization, 'Content-Type': job.file.type }, retry: 0, timeout: 180000 })
      if (expectedActor !== actor()) throw Object.assign(new Error('session changed'), { statusCode: 403 })
      if (!assets.value.some(item => item.id === result.id)) assets.value.push(result)
      if (!content.value.videos.some(item => item.asset_id === result.id)) content.value.videos.push({ asset_id: result.id, label: job.file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200), label_ar: '', variant_id: null, sort_order: content.value.videos.length })
      upload.value = null
    } catch { uploadError.value = true; error.value = t('productPage.videoUploadFailed') }
    finally { uploading.value = false }
  }
  const discardUpload = () => { if (window.confirm(t('productEditor.discardSections'))) { upload.value = null; uploadError.value = false; error.value = '' } }
  onMounted(async () => { if (stored()) { status.value = 'unknown'; await check() } else await read() })
  watch(dirty, value => { if (value && status.value === 'saved') status.value = 'ready' })
  watch(() => adminUser.value?.id, () => { content.value = { videos: [], related: [], compatible: [] }; baseline.value = JSON.stringify(content.value); revision.value = 0; assets.value = []; command.value = null; upload.value = null; uploadError.value = false; status.value = 'failed'; error.value = t('productPage.presentationUnavailable') })
  return { content, assets, revision, status, error, dirty, busy, saving, uploading, uploadError, upload, command, read, save, check, uploadVideo, discardUpload }
}
