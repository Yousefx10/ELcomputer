<template>
  <div class="space-y-3">
    <label v-if="label" class="block text-sm font-semibold text-gray-700">
      {{ label }}
    </label>

    <div class="rounded-2xl border bg-gray-50 p-4">
      <div class="flex flex-col gap-4 md:flex-row">
        <div
          v-if="showPreview"
          class="flex w-full items-center justify-center overflow-hidden rounded-xl bg-white p-3 md:w-48"
          :class="previewHeightClass"
        >
          <img
            v-if="modelValue"
            :src="modelValue"
            :alt="previewAlt"
            class="h-full w-full"
            :class="previewImageClass"
          >

          <p v-else class="text-center text-sm text-gray-400">
            {{ emptyText }}
          </p>
        </div>

        <div class="flex-1 space-y-3">
          <p v-if="helpText" class="text-sm text-gray-500">
            {{ helpText }}
          </p>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="disabled || uploading"
              class="rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              @click="openFilePicker"
            >
              {{ uploading ? 'Uploading...' : modelValue ? replaceButtonText : uploadButtonText }}
            </button>

            <button
              v-if="modelValue"
              type="button"
              :disabled="disabled || uploading"
              class="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              @click="clearImage"
            >
              Remove
            </button>
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
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

const { uploadImage } = useAdminUploads()

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
