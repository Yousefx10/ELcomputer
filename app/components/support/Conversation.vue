<script setup>
defineProps({
  messages: { type: Array, default: () => [] },
  attachments: { type: Array, default: () => [] },
  currentUserId: { type: String, default: '' }
})
defineEmits(['download'])
const formatDate = value => value ? new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value)) : '—'
</script>

<template>
  <ol class="space-y-4" aria-label="Ticket conversation">
    <li v-for="message in messages" :key="message.id" class="rounded-2xl border p-4 sm:p-5"
      :class="message.is_internal ? 'border-amber-200 bg-amber-50' : message.sender_type === 'staff' ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-white'">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-bold text-gray-900">{{ message.sender_id === currentUserId ? 'You' : message.sender_name }}</span>
          <span v-if="message.is_internal" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Internal note</span>
          <span v-else-if="message.sender_type === 'staff'" class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">Support</span>
        </div>
        <time class="text-xs text-gray-500" :datetime="message.created_at">{{ formatDate(message.created_at) }}</time>
      </div>
      <p class="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{{ message.body }}</p>
      <ul v-if="attachments.some(file => file.message_id === message.id)" class="mt-4 flex flex-wrap gap-2">
        <li v-for="file in attachments.filter(item => item.message_id === message.id)" :key="file.id">
          <button type="button" class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-gray-50" @click="$emit('download', file)">
            <Icon name="lucide:paperclip" size="14" /> {{ file.original_name }}
          </button>
        </li>
      </ul>
    </li>
  </ol>
</template>
