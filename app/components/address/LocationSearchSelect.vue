<script setup>
const props = defineProps({ modelValue: { type: String, default: '' }, label: { type: String, required: true },
  options: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const { locale, t } = useI18n()
const id = useId(), root = ref(null), open = ref(false), query = ref(''), active = ref(0)
const primary = option => locale.value.startsWith('ar') ? option.name_ar || option.name_en : option.name_en
const secondary = option => option.name_ar && option.name_ar !== option.name_en ? (locale.value.startsWith('ar') ? option.name_en : option.name_ar) : ''
const selected = computed(() => props.options.find(option => option.id === props.modelValue))
const filtered = computed(() => {
  const q = query.value.normalize('NFKC').trim().toLocaleLowerCase()
  return props.options.filter(option => [option.name_en, option.name_ar, ...(option.aliases || [])].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q))
})
const close = () => { open.value = false; query.value = ''; active.value = 0 }
const choose = option => { if (!props.disabled && option) emit('update:modelValue', option.id); close() }
const keydown = event => {
  if (props.disabled) return
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key === 'Enter' && open.value) { event.preventDefault(); choose(filtered.value[active.value]); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault(); open.value = true
  const count = filtered.value.length
  active.value = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1
    : Math.max(0, Math.min(count - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)))
  nextTick(() => root.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
}
watch(() => props.modelValue, close)
watch(() => props.options, () => { active.value = 0 })
watch(query, () => { active.value = 0 })
</script>

<template>
  <div ref="root" class="relative min-w-0" @focusout="event => { if (!root?.contains(event.relatedTarget)) close() }">
    <label :for="id" class="mb-1.5 block text-sm font-semibold text-slate-700">{{ label }}</label>
    <input :id="id" role="combobox" aria-autocomplete="list" :aria-expanded="open" :aria-controls="`${id}-list`"
      :aria-activedescendant="open && filtered[active] ? `${id}-${active}` : undefined" :disabled="disabled"
      :value="open ? query : selected ? primary(selected) : ''" :placeholder="t('deliveryLocations.search')" autocomplete="off"
      class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-start text-sm text-slate-900 focus:border-blue-600 focus:outline-none disabled:opacity-50"
      @focus="open = true; query = ''" @input="query = $event.target.value; open = true" @keydown="keydown">
    <ul v-if="open && !disabled" :id="`${id}-list`" role="listbox" :aria-label="label" class="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-300 bg-white p-1 shadow-lg">
      <li v-for="(option, index) in filtered" :id="`${id}-${index}`" :key="option.id" role="option" :aria-selected="option.id === modelValue" :data-active="active === index"
        class="cursor-pointer rounded px-3 py-2 text-start text-sm text-slate-900" :class="active === index ? 'bg-blue-50' : ''"
        @mousedown.prevent @mousemove="active = index" @click="choose(option)">
        <span class="block break-words">{{ primary(option) }}</span><span v-if="secondary(option)" class="block break-words text-xs text-slate-500"><bdi>{{ secondary(option) }}</bdi></span>
      </li>
      <li v-if="!filtered.length" role="presentation" class="px-3 py-3 text-sm text-slate-500">{{ t('deliveryLocations.noMatch') }}</li>
    </ul>
  </div>
</template>
