<template>
  <div class="file-workspace">
    <div class="grid gap-3 sm:grid-cols-3" aria-label="Media summary">
      <div class="file-stat !border-gray-950 !bg-gray-950 text-white">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gray-300"><Icon name="lucide:images" size="22" /></span>
        <div><p class="text-xs text-gray-400">{{ search.trim() ? 'Matching images' : 'All images' }}</p><p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{{ loaded ? totalItems.toLocaleString() : '—' }}</p></div>
      </div>
      <div class="file-stat"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"><Icon name="lucide:folders" size="21" /></span><div><p class="file-label">{{ search.trim() ? 'Matching sections' : 'Sections' }}</p><p class="mt-1 text-2xl font-semibold tabular-nums">{{ loaded ? totalSections : '—' }}</p></div></div>
      <div class="file-stat"><span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500"><Icon name="lucide:hard-drive" size="21" /></span><div><p class="file-label">Size on this page</p><p class="mt-1 text-2xl font-semibold tracking-tight">{{ loaded ? formatSize(pageBytes) : '—' }}</p></div></div>
    </div>

    <section class="file-surface" aria-label="Browse media" :aria-busy="loading">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div class="flex items-center gap-2"><Icon name="lucide:image" size="18" class="text-gray-500" /><h3 class="text-sm font-semibold">{{ search.trim() ? 'Search results' : 'All images' }}</h3><span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{{ totalItems }}</span></div>
        <DashboardFileViewToggle v-model="viewMode" />
      </div>
      <div class="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-4">
        <label class="relative min-w-0 flex-[1_1_220px]"><span class="sr-only">Search image names</span><Icon name="lucide:search" size="17" class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input v-model="search" type="search" placeholder="Search image names…" class="file-search" /></label>
        <button v-if="search" type="button" class="file-button" @click="search = ''"><Icon name="lucide:x" size="15" /> Clear</button>
        <button type="button" class="file-button" :disabled="loading" aria-label="Refresh media" @click="$emit('refresh')"><Icon name="lucide:refresh-cw" size="16" :class="{ 'motion-safe:animate-spin': loading }" /></button>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/50 px-5 py-3 text-xs text-gray-500"><span>{{ viewMode === 'grid' ? 'Grouped by section on this page' : 'Images on this page' }}</span><span class="inline-flex items-center gap-1.5"><Icon name="lucide:arrow-down-wide-narrow" size="14" /> Last modified</span></div>

      <div v-if="error" role="alert" class="m-5 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"><Icon name="lucide:circle-alert" size="18" class="shrink-0" /><p class="flex-1">{{ error }}</p><button type="button" class="font-semibold" @click="$emit('refresh')">Retry</button></div>
      <div class="file-content" :class="{ 'has-selection': selectedImage }">
        <div class="min-w-0">
          <div v-if="loading" class="file-item-grid p-5" role="status"><span class="sr-only">Loading media…</span><div v-for="n in 8" :key="n" class="h-48 rounded-xl bg-gray-100 motion-safe:animate-pulse" aria-hidden="true" /></div>
          <div v-else-if="!images.length" class="file-empty"><span class="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"><Icon :name="error ? 'lucide:cloud-off' : 'lucide:image'" size="27" /></span><h4 class="text-sm font-semibold">{{ error ? 'Images could not load' : search.trim() ? 'No matching images' : 'Your library is empty' }}</h4><p class="text-sm text-gray-500">{{ error ? 'Try refreshing the library.' : search.trim() ? 'Try another file name.' : 'Images uploaded across your store appear here.' }}</p></div>
          <div v-else-if="viewMode === 'grid'" class="space-y-6 p-5">
            <section v-for="group in imageGroups" :key="group.name" :aria-label="group.name">
              <div class="mb-3 flex items-center gap-2"><Icon name="lucide:folder" size="16" class="text-gray-400" /><h4 class="text-sm font-semibold">{{ group.name }}</h4><span class="file-label">{{ group.images.length }}</span></div>
              <div class="file-item-grid">
                <button v-for="image in group.images" :key="image.publicPath" type="button" class="file-card group" :aria-pressed="selectedImage?.publicPath === image.publicPath" :aria-label="`Details for ${image.name}`" @click="selectedImage = image" @dblclick="openPreview(image)">
                  <div class="file-thumbnail relative !h-40 !p-4">
                    <Icon v-if="failedImages[image.publicPath]" name="lucide:image-off" size="30" class="text-gray-400" />
                    <img v-else :src="image.publicPath" :alt="image.name" loading="lazy" class="h-full w-full object-contain transition-transform duration-200 motion-safe:group-hover:scale-105" @error="failedImages[image.publicPath] = true" />
                    <span class="absolute end-2 top-2 rounded-md border border-white/70 bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{{ fileType(image) }}</span>
                  </div>
                  <div class="border-t border-gray-100 p-3.5"><p class="truncate text-xs font-semibold" :title="image.name">{{ image.name }}</p><p class="mt-2 text-[11px] text-gray-500">{{ formatSize(image.size) }}</p></div>
                </button>
              </div>
            </section>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="file-table"><caption class="sr-only">Uploaded images. Select an image to view details.</caption><thead><tr><th scope="col">Name</th><th scope="col">Section</th><th scope="col">Size</th><th scope="col">Modified</th><th scope="col"><span class="sr-only">Preview</span></th></tr></thead>
              <tbody><tr v-for="image in images" :key="image.publicPath" :aria-selected="selectedImage?.publicPath === image.publicPath">
                <td><button type="button" class="flex max-w-64 items-center gap-3 rounded text-left" :aria-label="`Details for ${image.name}`" @click="selectedImage = image"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 p-1"><Icon v-if="failedImages[image.publicPath]" name="lucide:image-off" size="20" class="text-gray-400" /><img v-else :src="image.publicPath" alt="" loading="lazy" class="h-full w-full object-contain" @error="failedImages[image.publicPath] = true" /></span><span class="truncate text-xs font-semibold" :title="image.name">{{ image.name }}</span></button></td>
                <td class="text-xs text-gray-500">{{ image.section }}</td><td class="whitespace-nowrap text-xs text-gray-500">{{ formatSize(image.size) }}</td><td class="whitespace-nowrap text-xs text-gray-500">{{ formatDate(image.updated_at) }}</td><td><button type="button" class="file-button !min-h-8 !p-2" :aria-label="`Preview ${image.name}`" @click="openPreview(image)"><Icon name="lucide:expand" size="15" /></button></td>
              </tr></tbody>
            </table>
          </div>
        </div>

        <DashboardFileDetailsPanel v-if="selectedImage" :key="selectedImage.publicPath" title="Image details" @close="selectedImage = null">
          <button type="button" class="file-thumbnail mb-4 w-full rounded-xl border border-gray-200" aria-label="Expand image preview" @click="openPreview(selectedImage)"><Icon v-if="failedImages[selectedImage.publicPath]" name="lucide:image-off" size="30" class="text-gray-400" /><img v-else :src="selectedImage.publicPath" :alt="selectedImage.name" class="h-full w-full object-contain" @error="failedImages[selectedImage.publicPath] = true" /></button>
          <h4 class="break-words text-sm font-semibold">{{ selectedImage.name }}</h4><p class="mt-1 text-xs text-gray-500">{{ selectedImage.section }}</p>
          <dl class="my-5 space-y-3 border-y border-gray-200 py-5 text-xs"><div class="flex justify-between gap-3"><dt class="text-gray-500">Format</dt><dd>{{ fileType(selectedImage) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-gray-500">Size</dt><dd>{{ formatSize(selectedImage.size) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-gray-500">Modified</dt><dd>{{ formatDate(selectedImage.updated_at) }}</dd></div></dl>
          <div class="flex flex-col gap-2"><button type="button" class="file-button file-button-primary" @click="openPreview(selectedImage)"><Icon name="lucide:expand" size="15" /> Preview image</button><a :href="downloadUrl(selectedImage)" :download="selectedImage.name" class="file-button"><Icon name="lucide:download" size="16" /> Download</a><button v-if="canEdit" type="button" class="file-button !border-transparent !bg-transparent !text-red-600 hover:!bg-red-50" :disabled="deleting" @click="$emit('delete', selectedImage)"><Icon name="lucide:trash-2" size="15" /> {{ deleting ? 'Deleting…' : 'Delete image' }}</button></div>
        </DashboardFileDetailsPanel>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
        <p class="text-xs text-gray-500" aria-live="polite">{{ loading ? 'Loading images…' : `${pageStart}–${pageEnd} of ${totalItems} images` }}</p>
        <div class="flex items-center gap-2"><span class="me-2 text-xs tabular-nums text-gray-500">Page {{ page }} of {{ totalPages }}</span><button type="button" class="file-button !px-2.5" :disabled="page <= 1 || loading" aria-label="Previous page" @click="$emit('page', page - 1)"><Icon name="lucide:chevron-left" size="16" /></button><button type="button" class="file-button !px-2.5" :disabled="page >= totalPages || loading" aria-label="Next page" @click="$emit('page', page + 1)"><Icon name="lucide:chevron-right" size="16" /></button></div>
      </footer>
    </section>

    <Teleport to="body">
      <dialog ref="previewDialog" class="media-preview m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-950/60" aria-labelledby="media-preview-title" @click="closePreviewOnBackdrop">
        <template v-if="previewImage">
          <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4"><h3 id="media-preview-title" class="min-w-0 truncate text-sm font-semibold">{{ previewImage.name }}</h3><button type="button" class="file-button !px-2.5" aria-label="Close image preview" autofocus @click="previewDialog?.close()"><Icon name="lucide:x" size="17" /></button></div>
          <div class="flex h-[60vh] items-center justify-center bg-gray-50 p-6"><Icon v-if="failedImages[previewImage.publicPath]" name="lucide:image-off" size="40" class="text-gray-400" /><img v-else :src="previewImage.publicPath" :alt="previewImage.name" class="h-full w-full object-contain" @error="failedImages[previewImage.publicPath] = true" /></div>
          <div class="flex items-center justify-between gap-3 px-5 py-4"><span class="text-xs text-gray-500">{{ previewImage.section }} · {{ formatSize(previewImage.size) }}</span><a :href="downloadUrl(previewImage)" :download="previewImage.name" class="file-button file-button-primary"><Icon name="lucide:download" size="16" /> Download</a></div>
        </template>
      </dialog>
    </Teleport>
  </div>
</template>

<script setup>
const props = defineProps({
  images: { type: Array, default: () => [] },
  totalItems: { type: Number, default: 0 },
  totalSections: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 24 },
  totalPages: { type: Number, default: 1 },
  loading: Boolean,
  loaded: Boolean,
  error: { type: String, default: '' },
  canEdit: Boolean,
  deleting: Boolean
})
const search = defineModel('search', { type: String, default: '' })
const selectedImage = defineModel('selectedImage', { type: Object, default: null })
defineEmits(['refresh', 'page', 'delete'])
const viewMode = ref('grid')
const failedImages = reactive({})
const previewDialog = ref(null)
const previewImage = ref(null)
const pageBytes = computed(() => props.images.reduce((sum, image) => sum + Number(image.size || 0), 0))
const pageStart = computed(() => props.totalItems ? (props.page - 1) * props.pageSize + 1 : 0)
const pageEnd = computed(() => Math.min(props.page * props.pageSize, props.totalItems))
const imageGroups = computed(() => {
  const groups = new Map()
  props.images.forEach((image) => {
    const name = image.section || 'Other images'
    if (!groups.has(name)) groups.set(name, { name, images: [] })
    groups.get(name).images.push(image)
  })
  return [...groups.values()]
})
const formatSize = (value) => {
  const bytes = Number(value || 0)
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const fileType = (image) => image.name?.includes('.') ? image.name.split('.').pop().toUpperCase() : 'Image'
const downloadUrl = (image) => `${image.publicPath}?download=1`
const openPreview = async (image) => {
  previewImage.value = image
  await nextTick()
  previewDialog.value?.showModal()
}
const closePreviewOnBackdrop = (event) => {
  if (event.target !== previewDialog.value) return
  const rect = previewDialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) previewDialog.value.close()
}
</script>
