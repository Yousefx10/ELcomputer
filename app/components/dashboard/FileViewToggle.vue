<template>
  <div class="inline-flex shrink-0 gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1" role="group" aria-label="Display files">
    <button v-for="view in views" :key="view.value" type="button" :aria-label="view.label" :aria-pressed="modelValue === view.value" class="inline-flex h-8 w-8 items-center justify-center rounded-lg transition" :class="modelValue === view.value ? 'bg-white text-gray-950 shadow-sm ring-1 ring-gray-200/70' : 'text-gray-400 hover:text-gray-700'" @click="$emit('update:modelValue', view.value)">
      <Icon :name="view.icon" size="16" />
    </button>
  </div>
</template>

<script setup>
defineProps({ modelValue: { type: String, default: 'grid' } })
defineEmits(['update:modelValue'])
const views = [
  { value: 'grid', label: 'Grid view', icon: 'lucide:layout-grid' },
  { value: 'list', label: 'List view', icon: 'lucide:list' }
]
</script>
