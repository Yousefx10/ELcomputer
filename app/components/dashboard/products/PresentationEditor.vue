<script setup>
const props = defineProps({ productId: { type: String, required: true }, variants: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['state'])
const { content, assets, status, error, dirty, busy, saving, uploading, uploadError, upload, command, read, save, check, uploadVideo, discardUpload } = useProductPresentation(props.productId)
const client = useSupabaseClient(), search = ref(''), results = ref([]), names = ref({}), searching = ref(false), searchFailed = ref(false)
const { adminUser } = useAdminAccess()
const { t } = useI18n()
let timer, generation = 0, controller
const familyEditor = ref(null)
watchEffect(() => emit('state', { dirty: dirty.value || !!upload.value, busy: busy.value }))
const selectedIds = computed(() => [...new Set([...content.value.related, ...content.value.compatible, props.productId, ...(content.value.family?.members || []).map(row => row.product_id)])])
watch(selectedIds, async ids => {
  if (!ids.length) return
  const expectedActor = adminUser.value?.id
  const { data } = await client.from('products').select('id,title,is_published').in('id', ids).limit(49)
  if (expectedActor !== adminUser.value?.id) return
  for (const item of data || []) names.value[item.id] = item
}, { immediate: true })
watch(search, value => {
  clearTimeout(timer); controller?.abort(); const ownGeneration = ++generation
  results.value = []; searchFailed.value = false
  if (!value.trim()) { searching.value = false; return }
  searching.value = true
  timer = setTimeout(async () => {
    controller = new AbortController()
    try {
      const { data } = await client.auth.getSession()
      if (!data.session?.access_token) throw new Error('session')
      const response = await $fetch('/api/admin-products/list', { query: { q: value.trim().slice(0, 200), status: 'all', page: 1 }, headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal, timeout: 15000, retry: 0 })
      if (ownGeneration !== generation) return
      results.value = (response.items || []).filter(item => item.id !== props.productId)
      for (const item of results.value) names.value[item.id] = item
    } catch { if (ownGeneration === generation) searchFailed.value = true }
    finally { if (ownGeneration === generation) searching.value = false }
  }, 300)
})
const add = (field, id) => { if (content.value[field].length < 8 && !content.value[field].includes(id)) content.value[field].push(id) }
const move = (field, id, delta) => {
  const index = content.value[field].indexOf(id), target = index + delta
  if (index < 0 || target < 0 || target >= content.value[field].length) return
  const [item] = content.value[field].splice(index, 1); content.value[field].splice(target, 0, item)
}
const remove = (field, id) => { content.value[field] = content.value[field].filter(value => value !== id) }
const fileChange = async event => { const file = event.target.files?.[0]; if (file) await uploadVideo(file); event.target.value = '' }
watch(() => adminUser.value?.id, () => { clearTimeout(timer); controller?.abort(); generation++; results.value = []; names.value = {}; search.value = '' })
onBeforeUnmount(() => { clearTimeout(timer); controller?.abort(); generation++ })
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white p-5" data-product-presentation-editor>
    <h3 class="text-lg font-semibold">{{ $t('productPage.presentationTitle') }}</h3><p class="mt-1 text-sm text-gray-500">{{ $t('productPage.presentationHelp') }}</p>
    <p v-if="status === 'loading'" role="status" class="mt-4 text-sm text-gray-500">{{ $t('common.loading') }}</p>
    <fieldset :disabled="disabled || busy || status === 'loading' || status === 'conflict'" class="mt-5 space-y-5">
      <legend class="sr-only">{{ $t('productPage.presentationTitle') }}</legend>
      <div>
        <h4 class="text-sm font-semibold">{{ $t('productPage.videos') }}</h4><p class="mt-1 text-xs text-gray-500">{{ $t('productPage.fileLimit') }}</p>
        <label class="mt-3 block w-fit cursor-pointer rounded-lg border px-3 py-2 text-sm">{{ $t('productPage.uploadVideo') }}<input type="file" accept="video/mp4,video/webm" class="mt-2 block max-w-full text-xs" :disabled="content.videos.length >= 6 || !!upload" @change="fileChange"></label>
        <div v-if="assets.some(asset => !content.videos.some(video => video.asset_id === asset.id))" class="mt-3 flex flex-wrap gap-2"><button v-for="asset in assets.filter(asset => !content.videos.some(video => video.asset_id === asset.id))" :key="asset.id" type="button" class="rounded border px-2 py-1 text-xs" :disabled="content.videos.length >= 6" @click="content.videos.push({ asset_id: asset.id, label: '', label_ar: '', variant_id: null, sort_order: content.videos.length })">{{ $t('productPage.add') }} {{ $t('productPage.video') }} · {{ Math.ceil(asset.size_bytes / 1024) }} KB</button></div>
        <div v-for="(video, index) in content.videos" :key="video.asset_id" class="mt-3 grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <label class="text-sm">{{ $t('productPage.videoLabel') }}<input v-model="video.label" maxlength="200" class="mt-1 w-full rounded-lg border p-2"></label>
          <label class="text-sm">{{ $t('productPage.arabicLabel') }}<input v-model="video.label_ar" dir="rtl" maxlength="200" class="mt-1 w-full rounded-lg border p-2"></label>
          <label class="text-sm">{{ $t('common.option') }}<select v-model="video.variant_id" class="mt-1 w-full rounded-lg border p-2"><option :value="null">{{ $t('productPage.unassignedMedia') }}</option><option v-for="variant in variants" :key="variant.id" :value="variant.id">{{ variant.name }}</option></select></label>
          <label class="text-sm">{{ $t('productPage.sequence') }}<input v-model.number="video.sort_order" type="number" min="0" max="9999" step="1" class="mt-1 w-full rounded-lg border p-2"></label>
          <p v-if="assets.find(item => item.id === video.asset_id)" class="text-xs text-gray-500">{{ Math.ceil(assets.find(item => item.id === video.asset_id).size_bytes / 1024) }} KB</p>
          <button type="button" class="justify-self-end text-sm text-red-700" @click="content.videos.splice(index, 1)">{{ $t('productPage.remove') }}</button>
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold">{{ $t('productPage.productSearch') }}<input v-model="search" type="search" maxlength="200" class="mt-2 w-full rounded-lg border p-2"></label>
        <p v-if="searching" role="status" class="mt-2 text-xs text-gray-500">{{ $t('common.loading') }}</p><p v-else-if="searchFailed" role="alert" class="mt-2 text-xs text-red-700">{{ $t('productPage.presentationUnavailable') }}</p><p v-else-if="search.trim() && !results.length" class="mt-2 text-xs text-gray-500">{{ $t('productPage.noMatches') }}</p>
        <div v-for="item in results" :key="item.id" class="mt-2 flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"><span class="max-w-lg">{{ item.title }}</span><div class="flex flex-wrap gap-2"><button v-for="field in ['related','compatible']" :key="field" type="button" :disabled="content[field].includes(item.id) || content[field].length >= 8" class="rounded border px-2 py-1 text-xs disabled:opacity-40" @click="add(field, item.id)">{{ $t(field === 'related' ? 'productPage.curatedRelated' : 'modernProduct.buyWithIt') }}</button><button v-if="content.family" type="button" class="min-h-11 rounded border px-2 text-xs disabled:opacity-40" :disabled="!familyEditor?.confirmed || content.family.members.length >= 32 || content.family.members.some(row => row.product_id === item.id)" @click="familyEditor.add(item)">{{ $t('productFamily.link') }}</button></div></div>
      </div>
      <DashboardProductsFamilyEditor ref="familyEditor" v-model="content.family" :product-id="productId" :names="names" />
      <div v-for="field in ['related','compatible']" :key="field">
        <h4 class="text-sm font-semibold">{{ $t(field === 'related' ? 'productPage.curatedRelated' : 'modernProduct.buyWithIt') }}</h4><p v-if="field === 'compatible'" class="mt-1 text-xs text-gray-500">{{ $t('productPage.compatibilityHelp') }}</p>
        <div v-for="id in content[field]" :key="id" class="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border px-3 py-2 text-sm [overflow-wrap:anywhere]"><span>{{ names[id]?.title || id }}<span v-if="names[id]?.is_published === false" class="ms-2 text-xs text-gray-500">{{ $t('productEditor.draft') }}</span></span><div class="flex shrink-0 flex-wrap gap-1"><button type="button" class="min-h-11 rounded border px-2 disabled:opacity-40" :disabled="content[field].indexOf(id) === 0" :aria-label="$t('modernProduct.moveUp')" @click="move(field, id, -1)"><Icon name="lucide:arrow-up" size="16" /></button><button type="button" class="min-h-11 rounded border px-2 disabled:opacity-40" :disabled="content[field].indexOf(id) === content[field].length - 1" :aria-label="$t('modernProduct.moveDown')" @click="move(field, id, 1)"><Icon name="lucide:arrow-down" size="16" /></button><button type="button" class="text-red-700" @click="remove(field, id)">{{ $t('productPage.remove') }}</button></div></div>
      </div>
    </fieldset>
    <p v-if="error" role="alert" class="mt-4 text-sm text-red-700">{{ error }}</p><p v-if="status === 'saved'" role="status" class="mt-4 text-sm text-green-700">{{ $t('productPage.presentationSaved') }}</p>
    <div class="mt-5 flex flex-wrap justify-end gap-3">
      <template v-if="uploadError"><button type="button" class="rounded-lg border px-3 py-2 text-sm" :disabled="disabled || uploading" @click="discardUpload">{{ $t('productPage.remove') }}</button><button type="button" class="rounded-lg border px-3 py-2 text-sm" :disabled="disabled || uploading" @click="uploadVideo()">{{ $t('productSave.retry') }}</button></template>
      <button v-if="status === 'unknown'" type="button" class="rounded-lg border px-3 py-2 text-sm" :disabled="saving || disabled" @click="check">{{ $t('productPage.checkSaved') }}</button>
      <button v-if="status === 'conflict' || status === 'failed'" type="button" class="rounded-lg border px-3 py-2 text-sm" :disabled="saving || disabled" @click="read({ discard: true })">{{ $t('productPage.reloadSection') }}</button>
      <button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="disabled || saving || uploading || !!upload || status === 'loading' || status === 'conflict' || !dirty && !command" @click="save">{{ saving ? $t('common.saving') : status === 'unknown' ? $t('productSave.retry') : $t('productPage.savePresentation') }}</button>
    </div>
  </section>
</template>
