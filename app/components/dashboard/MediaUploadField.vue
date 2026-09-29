<template>
  <div class="space-y-3">
    <label v-if="label" class="block text-sm font-semibold text-gray-700">
      {{ $uiLabel(label) }}
    </label>

    <div class="rounded-2xl border bg-gray-50 p-4">
      <div class="flex flex-col gap-4 md:flex-row">
        <div
          v-if="showPreview"
          class="flex w-full items-center justify-center overflow-hidden rounded-xl bg-white p-3 md:w-48"
          :class="previewHeightClass"
          :style="previewTheme ? { backgroundColor: `var(--branding-preview-${previewTheme})` } : undefined"
        >
          <img
            v-if="modelValue"
            :src="modelValue"
            :alt="previewAlt"
            class="h-full w-full"
            :class="previewImageClass"
          >

          <p v-else class="text-center text-sm text-gray-400">
            {{ $uiLabel(emptyText) }}
          </p>
        </div>

        <div class="flex-1 space-y-3">
          <p v-if="helpText" class="text-sm text-gray-500">
            {{ $uiLabel(helpText) }}
          </p>

          <div class="flex flex-wrap gap-2">
            <button type="button" :disabled="disabled || uploading" class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium" @click="openLibrary">
              {{ $t('common.selectFromLibrary') }}
            </button>
            <button
              type="button"
              :disabled="disabled || uploading"
              class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              @click="openFilePicker"
            >
              {{ uploading ? $t('common.uploading') : modelValue ? $uiLabel(replaceButtonText) : $uiLabel(uploadButtonText) }}
            </button>

            <button
              v-if="modelValue"
              type="button"
              :disabled="disabled || uploading"
              class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              @click="clearImage"
            >
              {{ $t('common.remove') }}
            </button>
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600">
            {{ $uiMessage(errorMessage) }}
          </p>

          <p v-else-if="modelValue" class="break-all text-xs text-gray-500">
            {{ modelValue }}
          </p>
        </div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      :disabled="disabled || uploading"
      @change="handleFileChange"
    >
    <Teleport to="body">
      <dialog ref="libraryDialog" class="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl backdrop:bg-black/50" :aria-labelledby="libraryTitleId">
        <header class="mb-4 flex items-center justify-between gap-3">
          <h3 :id="libraryTitleId" class="font-semibold">{{ $t('common.chooseAnExistingImage') }}</h3>
          <button type="button" class="min-h-11 rounded-lg border px-3" @click="libraryDialog.close()">{{ $t('common.close') }}</button>
        </header>
        <DashboardMediaLibrary v-model:search="librarySearch" v-model:selected-image="librarySelection" :images="libraryImages" :total-items="libraryTotal" :total-sections="librarySections" :total-pages="libraryPages" :page="libraryPage" :loaded="libraryLoaded" :loading="libraryLoading" :error="libraryError" @refresh="loadLibrary" @page="changeLibraryPage" />
        <footer class="sticky bottom-0 mt-4 flex justify-end rounded-lg bg-white p-3">
          <button type="button" :disabled="!librarySelection || disabled" class="min-h-11 rounded-lg bg-blue-600 px-4 font-semibold text-white disabled:opacity-50" @click="chooseLibraryImage">{{ $t('common.useImage') }}</button>
        </footer>
      </dialog>
    </Teleport>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  section: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  helpText: {
    type: String,
    default: ''
  },
  previewAlt: {
    type: String,
    default: 'Uploaded image'
  },
  emptyText: {
    type: String,
    default: 'No image uploaded yet.'
  },
  uploadButtonText: {
    type: String,
    default: 'Upload Image'
  },
  replaceButtonText: {
    type: String,
    default: 'Replace Image'
  },
  previewHeightClass: {
    type: String,
    default: 'h-40'
  },
  previewTheme: {
    type: String,
    default: '',
    validator: value => ['', 'light', 'dark'].includes(value)
  },
  previewImageClass: {
    type: String,
    default: 'object-contain'
  },
  showPreview: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'uploaded'])

const { uploadImage, fetchGalleryImages } = useAdminUploads()
const { uiMessage } = useUiLocale()
const libraryTitleId = useId()
const libraryDialog = ref(null)
const librarySearch = ref('')
const librarySelection = ref(null)
const libraryImages = ref([])
const libraryPage = ref(1)
const libraryPages = ref(1)
const libraryTotal = ref(0)
const librarySections = ref(0)
const libraryLoading = ref(false)
const libraryLoaded = ref(false)
const libraryError = ref('')
let libraryRequest = 0
let librarySearchTimeout
const loadLibrary = async () => {
  const request = ++libraryRequest
  libraryLoading.value = true
  libraryError.value = ''
  try {
    const result = await fetchGalleryImages({ q: librarySearch.value || undefined, page: libraryPage.value, limit: 24 })
    if (request !== libraryRequest) return
    libraryImages.value = result.items || []
    libraryTotal.value = result.pagination?.totalItems || 0
    librarySections.value = result.summary?.totalSections ?? result.totalSections ?? new Set(libraryImages.value.map(image => image.section)).size
    libraryPages.value = result.pagination?.totalPages || 1
    libraryLoaded.value = true
  } catch {
    if (request === libraryRequest) libraryError.value = uiMessage('Could not load images.')
  } finally {
    if (request === libraryRequest) libraryLoading.value = false
  }
}
const openLibrary = async () => {
  if (props.disabled || uploading.value) return
  librarySelection.value = null
  libraryDialog.value?.showModal()
  await loadLibrary()
}
const changeLibraryPage = page => { libraryPage.value = page; loadLibrary() }
const chooseLibraryImage = () => {
  if (!librarySelection.value || props.disabled) return
  emit('update:modelValue', librarySelection.value.publicPath)
  libraryDialog.value?.close()
}
watch(librarySearch, () => {
  clearTimeout(librarySearchTimeout)
  librarySearchTimeout = setTimeout(() => { libraryPage.value = 1; loadLibrary() }, 250)
})
onBeforeUnmount(() => { clearTimeout(librarySearchTimeout); libraryRequest++ })

const fileInputRef = ref(null)
const uploading = ref(false)
const errorMessage = ref('')

const openFilePicker = () => {
  if (props.disabled || uploading.value) {
    return
  }

  fileInputRef.value?.click()
}

const clearImage = () => {
  errorMessage.value = ''
  emit('update:modelValue', '')
}

const handleFileChange = async (event) => {
  const input = event.target
  const file = input?.files?.[0]

  if (!file) {
    return
  }

  uploading.value = true
  errorMessage.value = ''

  try {
    const response = await uploadImage(file, props.section)
    emit('update:modelValue', response.publicPath || '')
    emit('uploaded', response)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not upload image.'
  } finally {
    uploading.value = false

    if (input) {
      input.value = ''
    }
  }
}
</script>
