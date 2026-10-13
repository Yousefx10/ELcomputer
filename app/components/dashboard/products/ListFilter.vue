<template>
  <div class="min-w-0">
    <label :for="inputId || `product-filter-${kind}`" class="mb-1 block text-xs font-semibold text-gray-700">{{ label }}</label>
    <input v-if="choices.total > 100 || term" v-model="term" type="search" maxlength="120" :aria-label="searchLabel" :placeholder="searchLabel" class="mb-1 w-full rounded-lg border bg-white p-2 text-sm outline-none focus:border-blue-500">
    <select :id="inputId || `product-filter-${kind}`" :value="modelValue" class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900 outline-none focus:border-blue-500" @change="choose($event.target.value)">
      <option value="">{{ emptyLabel || $t('productList.all') }}</option>
      <option v-if="selected && !choices.items.some(item => item.id === selected.id)" :value="selected.id">{{ name(selected) }}</option>
      <option v-if="modelValue && !selected && !choices.items.some(item => item.id === modelValue)" :value="modelValue">{{ $t('productList.unavailableChoice') }}</option>
      <option v-for="item in choices.items" :key="item.id" :value="item.id">{{ name(item) }}</option>
    </select>
    <p v-if="failed" role="alert" class="mt-1 text-xs text-red-600">{{ $t('productList.filterFailed') }} <button type="button" class="underline" @click="load">{{ $t('common.retry') }}</button></p>
    <p v-else-if="loading" class="mt-1 text-xs text-gray-500" role="status">{{ $t('common.loading') }}</p>
    <p v-else-if="choices.matches > 100" class="mt-1 text-xs text-gray-500">{{ $t('productList.findChoice') }}</p>
  </div>
</template>

<script setup>
import { getLocalizedCategoryName } from '~/utils/categoryLocale'
const props = defineProps({ kind: { type: String, required: true }, label: { type: String, required: true }, searchLabel: { type: String, required: true }, modelValue: { type: String, default: '' }, inputId: { type: String, default: '' }, emptyLabel: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue','selection'])
const { locale } = useI18n()
const { adminUser } = useAdminAccess()
const { getAdminAuthHeaders } = useAdminLogs()
const choices = ref({ items: [], total: 0, matches: 0 })
const selected = ref(null), term = ref(''), loading = ref(false), failed = ref(false)
let generation = 0, controller, timer
const name = item => props.kind === 'category' ? getLocalizedCategoryName(item, locale.value) : item.name
const selection = item => emit('selection', item ? { id: item.id, name: name(item) } : null)
const choose = id => { emit('update:modelValue',id); selection(choices.value.items.find(item => item.id === id) || (selected.value?.id === id ? selected.value : null)) }
const load = async () => {
  const id = ++generation; controller?.abort(); controller = new AbortController()
  const signal = controller.signal
  loading.value = true; failed.value = false
  try {
    const headers = await getAdminAuthHeaders()
    if (id !== generation) return
    const data = await $fetch('/api/admin-products/filter-options', { headers, query: { kind: props.kind, q: term.value.trim(), selected: props.modelValue }, signal, retry: 0, timeout: 15000 })
    if (id !== generation) return
    if (!Array.isArray(data?.items) || data.items.length > 100 || !Number.isSafeInteger(data.total) || !Number.isSafeInteger(data.matches)) throw Error('Invalid filter response')
    choices.value = data; selected.value = data.selected; selection(data.selected)
  } catch { if (id === generation && !signal.aborted) { failed.value = true; choices.value = { items: [], total: 0, matches: 0 }; selected.value = null; selection(null) } }
  finally { if (id === generation) loading.value = false }
}
watch(term, () => { generation++; controller?.abort(); clearTimeout(timer); timer = setTimeout(load,300) })
watch(() => props.modelValue, load)
watch(() => JSON.stringify([adminUser.value?.id,adminUser.value?.permissions,adminUser.value?.is_active]), () => { choices.value = { items: [], total: 0, matches: 0 }; selected.value = null; load() })
onMounted(load)
onBeforeUnmount(() => { generation++; controller?.abort(); clearTimeout(timer) })
</script>
