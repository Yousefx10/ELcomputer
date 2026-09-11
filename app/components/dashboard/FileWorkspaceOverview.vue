<template>
  <section class="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]" aria-label="Document shortcuts">
    <article class="file-surface p-5 sm:p-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-bold text-gray-950">Quick access</h3>
          <p class="mt-1 text-xs text-gray-500">Pin important files and folders.</p>
        </div>
        <span class="file-count">{{ quickAccess.length }}</span>
      </div>

      <div v-if="loading" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="index in 4" :key="index" class="h-28 animate-pulse rounded-2xl bg-gray-100" />
      </div>

      <div v-else-if="quickAccess.length" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article v-for="item in quickAccess" :key="`${item.type}-${item.id}`" class="group relative rounded-2xl border border-gray-200 bg-gray-50/60 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm">
          <button type="button" class="block w-full text-left" @click="$emit('activate', item)">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl" :class="item.type === 'folder' ? 'bg-blue-600 text-white' : fileColor(item)">
              <Icon :name="item.type === 'folder' ? 'lucide:folder' : fileIcon(item)" size="20" />
            </span>
            <span class="mt-4 block truncate text-sm font-bold text-gray-900" :title="item.name">{{ item.name }}</span>
            <span class="mt-1 block truncate text-[11px] text-gray-500">{{ item.type === 'folder' ? item.location : formatBytes(item.size_bytes) }}</span>
          </button>
          <button type="button" class="absolute end-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 opacity-70 transition hover:bg-white hover:opacity-100" :aria-label="`Remove ${item.name} from quick access`" @click.stop="$emit('toggle-pin', item)">
            <Icon name="lucide:pin-off" size="15" />
          </button>
        </article>
      </div>

      <div v-else class="mt-5 flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 text-center">
        <div><Icon name="lucide:pin" size="22" class="mx-auto text-gray-300" /><p class="mt-2 text-xs text-gray-500">Pin items from the properties panel.</p></div>
      </div>
    </article>

    <article class="file-surface p-5 sm:p-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-bold text-gray-950">Recent files</h3>
          <p class="mt-1 text-xs text-gray-500">Files you opened recently.</p>
        </div>
        <Icon name="lucide:history" size="18" class="text-gray-400" />
      </div>

      <div v-if="loading" class="mt-4 space-y-2">
        <div v-for="index in 3" :key="index" class="h-14 animate-pulse rounded-xl bg-gray-100" />
      </div>

      <div v-else-if="recentFiles.length" class="mt-4 space-y-1">
        <button v-for="item in recentFiles.slice(0, 5)" :key="item.id" type="button" class="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-gray-50" @click="$emit('activate', item)">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" :class="fileColor(item)"><Icon :name="fileIcon(item)" size="18" /></span>
          <span class="min-w-0 flex-1"><span class="block truncate text-xs font-bold text-gray-900">{{ item.name }}</span><span class="mt-0.5 block truncate text-[11px] text-gray-500">{{ relativeDate(item.last_opened_at) }}</span></span>
          <Icon name="lucide:chevron-right" size="15" class="text-gray-300" />
        </button>
      </div>

      <div v-else class="mt-4 flex min-h-40 items-center justify-center text-center">
        <div><Icon name="lucide:file-clock" size="24" class="mx-auto text-gray-300" /><p class="mt-2 text-xs text-gray-500">Opened files will appear here.</p></div>
      </div>
    </article>
  </section>
</template>

<script setup>
defineProps({
  quickAccess: { type: Array, default: () => [] },
  recentFiles: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

defineEmits(['activate', 'toggle-pin'])

const extension = (item) => String(item?.name || '').split('.').pop()?.toLowerCase()

const fileIcon = (item) => {
  const type = String(item?.mime_type || '')
  const ext = extension(item)
  if (type.includes('pdf') || ext === 'pdf') return 'lucide:file-text'
  if (type.startsWith('image/')) return 'lucide:file-image'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'lucide:sheet'
  if (['ppt', 'pptx'].includes(ext)) return 'lucide:presentation'
  if (['zip', 'rar', '7z'].includes(ext)) return 'lucide:file-archive'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'lucide:file-type-2'
  return 'lucide:file'
}

const fileColor = (item) => {
  const ext = extension(item)
  if (ext === 'pdf') return 'bg-red-50 text-red-600'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'bg-emerald-50 text-emerald-600'
  if (['ppt', 'pptx'].includes(ext)) return 'bg-orange-50 text-orange-600'
  if (String(item?.mime_type || '').startsWith('image/')) return 'bg-violet-50 text-violet-600'
  return 'bg-blue-50 text-blue-600'
}

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes
  let index = -1
  do { size /= 1024; index += 1 } while (size >= 1024 && index < units.length - 1)
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
}

const relativeDate = (value) => {
  if (!value) return 'Recently opened'
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  return formatter.format(Math.round(hours / 24), 'day')
}
</script>
