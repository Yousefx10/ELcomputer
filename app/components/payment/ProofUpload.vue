<template>
  <div class="rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-4">
    <div class="flex items-start gap-3">
      <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
        <Icon name="lucide:file-up" size="20" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-slate-900">Proof of payment</p>
        <p class="mt-1 text-sm text-slate-600">Choose a JPG, PNG, WEBP, or PDF up to 8 MB.</p>
      </div>
    </div>

    <div v-if="selectedFile" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">{{ selectedFile.name }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ formatFileSize(selectedFile.size) }}</p>
      </div>
      <button type="button" class="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50" @click="clearFile">Remove</button>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" @click="openPicker">
        {{ selectedFile ? 'Replace proof' : 'Choose proof' }}
      </button>
      <button v-if="showSubmit" type="button" :disabled="!selectedFile" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-600 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400" @click="$emit('submit', selectedFile)">
        Submit proof
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-3 text-sm text-red-700">{{ error }}</p>
    <p v-if="backendNotice" class="mt-3 text-xs text-slate-500">{{ backendNotice }}</p>

    <input ref="fileInput" type="file" class="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" @change="selectFile">
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, default: null },
  showSubmit: { type: Boolean, default: false },
  backendNotice: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'submit'])
const fileInput = ref(null)
const error = ref('')
const selectedFile = computed(() => props.modelValue)
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const maximumSize = 8 * 1024 * 1024

const openPicker = () => fileInput.value?.click()

const clearFile = () => {
  error.value = ''
  emit('update:modelValue', null)
  if (fileInput.value) fileInput.value.value = ''
}

const selectFile = event => {
  const file = event.target?.files?.[0]
  error.value = ''
  if (!file) return
  if (!allowedTypes.has(file.type)) {
    error.value = 'Choose a JPG, PNG, WEBP, or PDF file.'
    emit('update:modelValue', null)
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  if (file.size > maximumSize) {
    error.value = 'Proof must be 8 MB or smaller.'
    emit('update:modelValue', null)
    if (fileInput.value) fileInput.value.value = ''
    return
  }
  emit('update:modelValue', file)
}

const formatFileSize = value => {
  const size = Number(value || 0)
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
</script>
