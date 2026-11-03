<script setup>
import { optionDimensionKeys } from '~/utils/productOptions'
const props = defineProps({ modelValue: { type: Object, default: null }, productId: { type: String, required: true }, names: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:modelValue'])
const confirmed = ref(false)
const labels = { color: ['Color', 'اللون'], model: ['Model', 'الموديل'], switch: ['Keyboard switch', 'نوع المفتاح'], capacity: ['Capacity', 'السعة'], size: ['Size', 'المقاس'], version: ['Version', 'الإصدار'] }
const axis = key => ({ key, label: labels[key][0], label_ar: labels[key][1] })
const update = change => { const next = JSON.parse(JSON.stringify(props.modelValue)); change(next); emit('update:modelValue', next) }
const start = () => emit('update:modelValue', { id: crypto.randomUUID(), axes: [axis('color')], members: [{ product_id: props.productId, values: { color: '' }, values_ar: {} }] })
const add = item => {
  if (!confirmed.value || !props.modelValue || props.modelValue.members.length >= 32 || props.modelValue.members.some(row => row.product_id === item.id)) return
  update(next => next.members.push({ product_id: item.id, values: Object.fromEntries(next.axes.map(a => [a.key, ''])), values_ar: {} }))
}
const remove = id => {
  if (id === props.productId || props.modelValue.members.length <= 2) emit('update:modelValue', null)
  else update(next => { next.members = next.members.filter(row => row.product_id !== id) })
}
const move = (index, delta) => update(next => { const row = next.members.splice(index, 1)[0]; next.members.splice(index + delta, 0, row) })
const changeAxis = (index, key) => update(next => {
  const old = next.axes[index].key; next.axes[index] = axis(key)
  for (const row of next.members) { row.values[key] = row.values[old] || ''; delete row.values[old]; delete row.values_ar[old] }
})
const addAxis = () => update(next => { const key = optionDimensionKeys.find(k => !next.axes.some(a => a.key === k)); if (!key) return; next.axes.push(axis(key)); for (const row of next.members) row.values[key] = '' })
const removeAxis = index => update(next => { const [removed] = next.axes.splice(index, 1); for (const row of next.members) { delete row.values[removed.key]; delete row.values_ar[removed.key] } })
defineExpose({ add, confirmed })
</script>

<template>
  <div data-product-family-editor>
    <h4 class="text-sm font-semibold">{{ $t('productFamily.standalone') }}</h4>
    <p class="mt-1 text-xs text-gray-500">{{ $t('productFamily.editorHelp') }}</p>
    <button v-if="!modelValue" type="button" class="mt-3 min-h-11 rounded border px-3 text-sm" @click="start">{{ $t('productFamily.start') }}</button>
    <template v-else>
      <label class="mt-3 flex items-center gap-2 text-sm"><input v-model="confirmed" type="checkbox">{{ $t('productFamily.confirmRelated') }}</label>
      <p class="mt-1 text-xs text-gray-500">{{ $t('productFamily.searchHelp') }}</p>
      <div v-for="(item, index) in modelValue.axes" :key="item.key" class="mt-3 grid gap-2 sm:grid-cols-3">
        <label class="text-xs">{{ $t('productFamily.attribute') }}<select :value="item.key" class="mt-1 w-full rounded border p-2" @change="changeAxis(index, $event.target.value)"><option v-for="key in optionDimensionKeys" :key="key" :value="key" :disabled="key !== item.key && modelValue.axes.some(a => a.key === key)">{{ $t(`modernProduct.options.${key}`) }}</option></select></label>
        <label class="text-xs">{{ $t('productFamily.label') }}<input v-model="item.label" maxlength="120" class="mt-1 w-full rounded border p-2"></label>
        <label class="text-xs">{{ $t('productPage.arabicLabel') }}<input v-model="item.label_ar" maxlength="120" dir="rtl" class="mt-1 w-full rounded border p-2"></label>
        <button v-if="modelValue.axes.length > 1" type="button" class="justify-self-start text-xs text-red-700" @click="removeAxis(index)">{{ $t('productPage.remove') }}</button>
      </div>
      <button v-if="modelValue.axes.length < 6" type="button" class="mt-2 min-h-11 rounded border px-3 text-xs" @click="addAxis">{{ $t('productFamily.addAttribute') }}</button>
      <div v-for="(row, index) in modelValue.members" :key="row.product_id" class="mt-3 rounded border p-3 text-sm">
        <div class="flex flex-wrap items-center justify-between gap-2"><span class="min-w-0 [overflow-wrap:anywhere]">{{ names[row.product_id]?.title || row.product_id }} <span v-if="names[row.product_id]?.is_published === false" class="text-xs text-gray-500">{{ $t('productEditor.draft') }}</span></span><div class="flex gap-2"><button type="button" class="min-h-11 rounded border px-2 disabled:opacity-40" :disabled="index === 0" :aria-label="$t('modernProduct.moveUp')" @click="move(index, -1)">↑</button><button type="button" class="min-h-11 rounded border px-2 disabled:opacity-40" :disabled="index === modelValue.members.length - 1" :aria-label="$t('modernProduct.moveDown')" @click="move(index, 1)">↓</button><button type="button" class="text-red-700" @click="remove(row.product_id)">{{ $t('productPage.remove') }}</button></div></div>
        <div v-for="a in modelValue.axes" :key="a.key" class="mt-2 grid gap-2 sm:grid-cols-2"><label class="text-xs">{{ a.label }}<input v-model="row.values[a.key]" required maxlength="120" class="mt-1 w-full rounded border p-2"></label><label class="text-xs">{{ a.label_ar || $t('productPage.arabicLabel') }}<input v-model="row.values_ar[a.key]" maxlength="120" dir="rtl" class="mt-1 w-full rounded border p-2"></label></div>
        <label v-if="modelValue.axes.some(a => a.key === 'color')" class="mt-2 block text-xs">{{ $t('productFamily.swatch') }}<input :value="row.color_hex || ''" maxlength="7" placeholder="#RRGGBB" class="ms-2 w-28 rounded border p-2" @input="row.color_hex = $event.target.value || null"></label>
      </div>
    </template>
  </div>
</template>
